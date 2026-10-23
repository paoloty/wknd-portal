// Service worker for the players app, served at /app/sw.js (scope /app) with __VER__
// replaced by the deployed version (server.js). Keeps as much on the phone as is useful, so
// the app opens at once and still works offline:
//   shell   CSS, script, fonts, icons — per version, cache first.
//   pages   the app's screens (tabs, games, posts) — the copy on the phone answers a launch
//           at once while a fresh one is fetched behind it (the page then swaps it in:
//           app.js "Launch from the phone's copy"); in-app navigation goes to the network
//           first and falls back to the copy when offline or slow.
//   data    the feed's and notifications' pages and Home's rail (JSON) — network first,
//           the copy offline.
//   img     feed and game pictures, player photos, announcement photos — versioned ones
//           cache first, the rest answered from the copy while refreshed; trimmed to the
//           newest 300. (Not YouTube's thumbnails: another site's pictures are stored
//           padded to megabytes each, which would eat the phone's quota.)
// Screens and data belong to whoever is signed in: both are wiped when a request lands on
// the sign-in page (signed out, or the session ended) and on log out (app.js).
const VER = '__VER__';
const SHELL_CACHE = 'wknd-app-' + VER;
const PAGES = 'wknd-pages', DATA = 'wknd-data', IMG = 'wknd-img';
const SHELL = ['/app/offline', '/app.css?v=' + VER, '/app.js?v=' + VER, '/fonts/fonts.css', '/app-icon-192.png', '/favicon-32.png'];
const IMG_MAX = 300;
const NET_WAIT = 4000; // in-app navigation: use the phone's copy if the network takes longer

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('wknd-app-') && k !== SHELL_CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

// app.js asks for a wipe on log out (and when a different player signs in on this phone).
self.addEventListener('message', (e) => {
  if (e.data === 'wipe') e.waitUntil(wipe().then(() => e.source && e.source.postMessage('wiped')));
});
const wipe = () => Promise.all([PAGES, DATA].map((k) => caches.delete(k)));

const isShellAsset = (url) => url.origin === location.origin
  && (/^\/(app\.css|app\.js|app-icon-[\w-]+\.png|favicon-\d+\.png)$/.test(url.pathname) || url.pathname.startsWith('/fonts/'));
// Screens worth keeping: the tabs, settings, notifications, games and news posts. Not
// sign-in, setup, Face ID or anything that posts.
const isScreen = (url) => url.origin === location.origin
  && /^\/app(\/(picks|papawis|papawis\/[^/]+\/players|settle|team|me|settings|notifications|games\/[^/]+|posts\/[^/]+))?\/?$/.test(url.pathname);
const isData = (url) => url.origin === location.origin && (/^\/app\/(feed|notifications)\/items$/.test(url.pathname) || url.pathname === '/app/rail');
const isImage = (url) => url.origin === location.origin
  && (/^\/api\/photo\/[^/]+$/.test(url.pathname) || /^\/api\/player\/[^/]+\/photo$/.test(url.pathname) || /^\/app\/announcements\/[^/]+\/image$/.test(url.pathname));
const keyOf = (url) => url.pathname + url.search;

// A screen response worth keeping: a real page from this app, not a redirect to sign-in.
async function keepPage(key, res) {
  if (!res.ok || res.type !== 'basic') return;
  const to = new URL(res.url);
  if (/^\/app\/login/.test(to.pathname)) { await wipe(); return; }
  if (res.redirected) return; // e.g. /app → setup: not the screen this key stands for
  const c = await caches.open(PAGES);
  await c.put(key, res.clone());
}

async function launch(e, url) {
  const key = keyOf(url);
  const copy = await caches.match(key, { cacheName: PAGES });
  const fresh = fetch(e.request).then(async (res) => { await keepPage(key, res); return res; });
  if (copy) { e.waitUntil(fresh.catch(() => {})); return copy; }
  return fresh.catch(async () => (await caches.match('/app/offline')) || Response.error());
}

async function inAppNav(e, url) {
  const key = keyOf(url);
  const net = fetch(e.request).then(async (res) => { await keepPage(key, res); return res; });
  const late = new Promise((ok) => setTimeout(ok, NET_WAIT, null));
  const first = await Promise.race([net.catch(() => null), late]);
  if (first) return first;
  const copy = await caches.match(key, { cacheName: PAGES });
  if (copy) { e.waitUntil(net.catch(() => {})); return copy; }
  return net; // nothing on the phone: wait it out (or fail, and app.js loads the page normally)
}

async function data(e, url) {
  const key = keyOf(url);
  try {
    const res = await fetch(e.request);
    if (res.ok) { const c = await caches.open(DATA); await c.put(key, res.clone()); }
    return res;
  } catch (err) {
    const copy = await caches.match(key, { cacheName: DATA });
    if (copy) return copy;
    throw err;
  }
}

async function trim() {
  const c = await caches.open(IMG);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - IMG_MAX; i++) await c.delete(keys[i]); // oldest first
}
async function image(e, url) {
  const c = await caches.open(IMG);
  const copy = await c.match(e.request);
  const versioned = url.searchParams.has('v');
  const fresh = fetch(e.request).then(async (res) => {
    if (res.ok) { await c.put(e.request, res.clone()); trim(); }
    return res;
  });
  if (copy) { if (!versioned) e.waitUntil(fresh.catch(() => {})); return copy; }
  return fresh;
}

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') {
    if (isScreen(url)) return e.respondWith(launch(e, url));
    e.respondWith(fetch(req).then((res) => {
      if (url.origin === location.origin && /^\/app\/login/.test(new URL(res.url).pathname)) e.waitUntil(wipe());
      return res;
    }).catch(() => caches.match('/app/offline')));
    return;
  }
  if (isShellAsset(url)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(SHELL_CACHE).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  if (req.headers.get('X-App-Nav') && isScreen(url)) return e.respondWith(inAppNav(e, url));
  if (isData(url)) return e.respondWith(data(e, url));
  if (isImage(url) && !url.searchParams.has('r')) return e.respondWith(image(e, url));
});

// ── Push notifications (lib/push.js) ──
// payload: { title, body, url, tag, badge }. The app icon's badge follows the unread count.
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: 'WKND', body: e.data ? e.data.text() : '' }; }
  const shown = self.registration.showNotification(d.title || 'WKND', {
    body: d.body || '', tag: d.tag || undefined, renotify: !!d.tag,
    icon: '/app-icon-192.png', badge: '/favicon-32.png', data: { url: d.url || '/app' },
  });
  const badge = typeof d.badge === 'number' && self.navigator.setAppBadge
    ? (d.badge ? self.navigator.setAppBadge(d.badge) : self.navigator.clearAppBadge()).catch(() => {}) : Promise.resolve();
  e.waitUntil(Promise.all([shown, badge]));
});

// Tapped: the open app goes to that screen (app.js listens), else the app opens on it.
self.addEventListener('notificationclick', (e) => {
  e.notification.close();
  const url = new URL((e.notification.data && e.notification.data.url) || '/app', self.location.origin).href;
  e.waitUntil(self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
    const win = list.find((c) => new URL(c.url).pathname.startsWith('/app'));
    if (win) { win.postMessage({ type: 'open', url }); return win.focus(); }
    return self.clients.openWindow(url);
  }));
});

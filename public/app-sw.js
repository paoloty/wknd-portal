// Service worker for the players app, served at /app/sw.js (scope /app) with __VER__
// replaced by the deployed version (server.js). Keeps as much on the phone as is useful, so
// the app opens at once and still works offline:
//   shell   CSS, scripts (app.js, share-cards.js), icons — per version, cache first.
//   fonts   the woff2 files — kept across versions (a changed font gets a new file name).
//   pages   the app's screens (tabs, games, posts; never Settle: money is always fresh, and
//           offline it's the offline page) — newest 40. The copy on the phone answers a launch
//           at once while a fresh one is fetched behind it (the page then swaps it in:
//           app.js "Launch from the phone's copy"); in-app navigation shows the copy from
//           a day at most (app.js phoneCopy) while the fresh screen loads, and here falls back
//           to the copy when offline or slow. A push fetches its screen ahead (Android, warm).
//   data    the first page of the feed and notifications lists, and Home's rail (JSON) —
//           network first, the copy offline; newest 30.
//   img     feed and game pictures, player photos and covers, announcement photos — versioned ones
//           cache first, the rest answered from the copy while refreshed; trimmed to the
//           newest 300. (Not YouTube's thumbnails: another site's pictures are stored
//           padded to megabytes each, which would eat the phone's quota.)
// Screens and data belong to whoever is signed in: both are wiped when a request lands on
// the sign-in page (signed out, or the session ended) and on log out (app.js).
const VER = '__VER__';
const SHELL_CACHE = 'wknd-app-' + VER;
const PAGES = 'wknd-pages', DATA = 'wknd-data', IMG = 'wknd-img', FONTS = 'wknd-fonts';
const SHELL = ['/app/offline', '/app.css?v=' + VER, '/app.js?v=' + VER, '/fonts/fonts.css', '/app-icon-180.png?v=2', '/app-icon-192.png', '/favicon-32.png'];
const PAGES_MAX = 40, DATA_MAX = 30, IMG_MAX = 300;
const NET_WAIT = 4000; // in-app navigation: use the phone's copy if the network takes longer

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL_CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('wknd-app-') && k !== SHELL_CACHE).map((k) => caches.delete(k))))
    // Settle copies kept before it stopped being stored.
    .then(() => caches.open(PAGES)).then((c) => c.keys().then((keys) => Promise.all(keys
      .filter((r) => new URL(r.url).pathname.startsWith('/app/settle')).map((r) => c.delete(r)))))
    .then(() => self.clients.claim()));
});

// app.js asks for a wipe on log out (and when a different player signs in on this phone).
self.addEventListener('message', (e) => {
  if (e.data === 'wipe') e.waitUntil(wipe().then(() => e.source && e.source.postMessage('wiped')));
});
const wipe = () => Promise.all([PAGES, DATA].map((k) => caches.delete(k)));

const isShellAsset = (url) => url.origin === location.origin
  && (/^\/(app\.css|app\.js|table-scroll\.js|share-cards\.js|scorer\.js|score-engine\.js|live-score\.js|live-chat\.js|barkadahan\.js|app-icon-[\w-]+\.png|favicon-\d+\.png)$/.test(url.pathname) || url.pathname.startsWith('/fonts/'));
// Screens worth keeping: the tabs, settings, notifications, games, news posts, profiles and the
// Season screen. Not
// sign-in, setup, Face ID, Settle (money) or anything that posts.
const isScreen = (url) => url.origin === location.origin
  && /^\/app(\/(picks|papawis|papawis\/(?!past$)[^/]+|team|me|settings|players\/[^/]+|season|season\/(bracket|games)|notifications|games\/[^/]+|games\/[^/]+\/share|posts\/[^/]+|score|score\/[^/]+|practice|help\/scoring|help\/scoring\/[^/]+))?\/?$/.test(url.pathname);
const isData = (url) => url.origin === location.origin && (/^\/app\/(feed|notifications)\/items$/.test(url.pathname) || url.pathname === '/app/papawis/past' || url.pathname === '/app/rail');
const isImage = (url) => url.origin === location.origin
  && (/^\/api\/photo\/[^/]+$/.test(url.pathname) || /^\/api\/player\/[^/]+\/(photo|cover)$/.test(url.pathname) || /^\/app\/announcements\/[^/]+\/image$/.test(url.pathname));
const keyOf = (url) => url.pathname + url.search;

// A screen response worth keeping: a real page from this app, not a redirect to sign-in.
async function keepPage(key, res) {
  if (!res.ok || res.type !== 'basic') return;
  // A screen the server says not to keep (an admin's game screen with its Review card): drop any
  // old copy, so the next visit loads it fresh.
  if (res.headers.get('X-App-No-Copy')) { const c = await caches.open(PAGES); await c.delete(key); return; }
  const to = new URL(res.url);
  if (/^\/app\/login/.test(to.pathname)) { await wipe(); return; }
  if (res.redirected) return; // e.g. /app → setup: not the screen this key stands for
  const c = await caches.open(PAGES);
  await c.put(key, res.clone());
  trim(PAGES, PAGES_MAX);
}

async function launch(e, url) {
  const key = keyOf(url);
  const copy = await caches.match(key, { cacheName: PAGES });
  const fresh = fetch(e.request).then(async (res) => { await keepPage(key, res); return res; });
  if (copy) { e.waitUntil(fresh.then((res) => handOver(e, key, res)).catch(() => {})); return copy; }
  return fresh.catch(async () => (await caches.match('/app/offline')) || Response.error());
}
// The fresh screen fetched behind a launch's copy goes to the page (app.js launchFresh), which
// swaps it in: the page used to fetch it again. html null: not a plain screen (signed out,
// redirected), so the page asks the server itself. The page may not be there yet: tried for 5 s.
async function handOver(e, key, res) {
  const html = res.ok && res.type === 'basic' && !res.redirected ? await res.text() : null;
  for (let i = 0; i < 20; i++) {
    const c = e.resultingClientId ? await self.clients.get(e.resultingClientId) : null;
    if (c) { c.postMessage({ type: 'fresh', url: key, html }); return; }
    await new Promise((ok) => setTimeout(ok, 250));
  }
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
    // Only a list's first page is read back (app.js lazy lists); later ones (before=) carry
    // per-visit params and would pile up.
    if (res.ok && !url.searchParams.has('before')) { const c = await caches.open(DATA); await c.put(key, res.clone()); trim(DATA, DATA_MAX); }
    return res;
  } catch (err) {
    const copy = await caches.match(key, { cacheName: DATA });
    if (copy) return copy;
    throw err;
  }
}

async function trim(name, max) {
  const c = await caches.open(name);
  const keys = await c.keys();
  for (let i = 0; i < keys.length - max; i++) await c.delete(keys[i]); // oldest first
}
async function image(e, url) {
  const c = await caches.open(IMG);
  const copy = await c.match(e.request);
  const versioned = url.searchParams.has('v');
  // Only asked for when needed: a versioned picture already here never goes to the network.
  const fresh = () => fetch(e.request).then(async (res) => {
    if (res.ok) { await c.put(e.request, res.clone()); trim(IMG, IMG_MAX); }
    return res;
  });
  if (copy) { if (!versioned) e.waitUntil(fresh().catch(() => {})); return copy; }
  return fresh();
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
      if (res.ok) { const copy = res.clone(); caches.open(/\.woff2$/.test(url.pathname) ? FONTS : SHELL_CACHE).then((c) => c.put(req, copy)); }
      return res;
    })));
    return;
  }
  if (req.headers.get('X-App-Nav') && isScreen(url)) return e.respondWith(inAppNav(e, url));
  if (isData(url)) return e.respondWith(data(e, url));
  if (isImage(url) && !url.searchParams.has('r')) return e.respondWith(image(e, url));
});

// ── Push notifications (lib/push.js) ──
// payload: { title, body, url, tag, badge, icon, face }. The app icon's badge follows the
// unread count. icon: the sender's photo (Android shows it; iPhone always shows the app icon).
// With the app open on screen, the app drops its own banner instead (public/app.js "Push
// banner"). Android lets a push show nothing while the app is in front. iPhone doesn't: every
// push must show a notification or the phone stops sending them, so there it's shown and
// closed straight away.
const APPLE = /iPhone|iPad|iPod|Macintosh/.test(self.navigator.userAgent) && !/Chrome|CriOS|Android|Firefox|FxiOS/.test(self.navigator.userAgent);
self.addEventListener('push', (e) => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (err) { d = { title: 'WKND', body: e.data ? e.data.text() : '' }; }
  const tag = d.tag || 'wknd-' + Date.now();
  const show = () => self.registration.showNotification(d.title || 'WKND', {
    body: d.body || '', tag, renotify: !!d.tag,
    icon: d.icon || '/app-icon-192.png', badge: '/favicon-32.png', data: { url: d.url || '/app' },
  });
  const shown = self.clients.matchAll({ type: 'window' }).then((list) => {
    const open = list.find((c) => c.visibilityState === 'visible' && c.focused !== false && new URL(c.url).pathname.startsWith('/app'));
    if (!open) return show();
    open.postMessage({ type: 'push', title: d.title || 'WKND', body: d.body || '', url: d.url || '/app', face: d.face || null });
    if (!APPLE) return;
    return show().then(() => self.registration.getNotifications({ tag })).then((ns) => ns.forEach((n) => n.close()));
  });
  const badge = typeof d.badge === 'number' && self.navigator.setAppBadge
    ? (d.badge ? self.navigator.setAppBadge(d.badge) : self.navigator.clearAppBadge()).catch(() => {}) : Promise.resolve();
  e.waitUntil(Promise.all([shown, badge, warm(d.url)]));
});
// The screen a push points to is fetched as it arrives and kept on the phone, so tapping the
// notification opens it at once (launch) and in-app it goes up from the copy. Android only:
// iPhone gives a push little time and must show it first. Never fails the push.
function warm(path) {
  if (APPLE || !path) return Promise.resolve();
  const url = new URL(path, self.location.origin);
  if (!isScreen(url)) return Promise.resolve();
  return fetch(url.href, { credentials: 'same-origin', headers: { 'X-App-Nav': '1' } })
    .then((res) => keepPage(keyOf(url), res)).catch(() => {});
}

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

// Service worker for the players app, served at /app/sw.js (scope /app) with __VER__
// replaced by the deployed version (server.js). Pages always come from the network —
// they're personal and change with every game — with /app/offline as the fallback.
// Only the shell is kept on the phone: CSS, script, fonts and icons.
const VER = '__VER__';
const CACHE = 'wknd-app-' + VER;
const SHELL = ['/app/offline', '/app.css?v=' + VER, '/app.js?v=' + VER, '/fonts/fonts.css', '/app-icon-192.png', '/favicon.svg'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys()
    .then((keys) => Promise.all(keys.filter((k) => k.startsWith('wknd-app-') && k !== CACHE).map((k) => caches.delete(k))))
    .then(() => self.clients.claim()));
});

const isShellAsset = (url) => url.origin === location.origin
  && (/^\/(app\.css|app\.js|app-icon-\d+\.png|favicon\.svg)$/.test(url.pathname) || url.pathname.startsWith('/fonts/'));

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (req.mode === 'navigate') {
    e.respondWith(fetch(req).catch(() => caches.match('/app/offline')));
    return;
  }
  if (isShellAsset(url)) {
    e.respondWith(caches.match(req).then((hit) => hit || fetch(req).then((res) => {
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then((c) => c.put(req, copy)); }
      return res;
    })));
  }
});

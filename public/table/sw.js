// Offline copy of the table display (/table, public/table/). The page, its scripts, the code
// reader and the fonts are kept on the tablet after one visit with internet; offline they come
// from here. Online, the copy shows at once and is refreshed behind it.
const CACHE = 'wknd-table';
const FILES = ['/table', '/table/table.js', '/table-link.js', '/table/vendor/qrcode.js', '/table/vendor/jsqr.js', '/fonts/fonts.css'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  const mine = url.pathname === '/table' || url.pathname.startsWith('/table/') || url.pathname === '/table-link.js' || url.pathname.startsWith('/fonts/');
  if (e.request.method !== 'GET' || url.origin !== location.origin || !mine) return;
  const key = url.pathname;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(key);
    const net = fetch(e.request).then((r) => { if (r.ok) c.put(key, r.clone()); return r; });
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net;
  }));
});

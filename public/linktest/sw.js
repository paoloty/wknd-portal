// Offline copy of the phone ↔ tablet link test (the page at /linktest, files in public/linktest/). The page and its three
// scripts are kept on the device after one visit with internet; offline they come from here.
// Online, the copy shows at once and is refreshed behind it.
const CACHE = 'wknd-linktest';
const FILES = ['/linktest', '/linktest/linktest.js', '/linktest/vendor/qrcode.js', '/linktest/vendor/jsqr.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(FILES)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => { e.waitUntil(self.clients.claim()); });
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin || !(url.pathname === '/linktest' || url.pathname.startsWith('/linktest/'))) return;
  const key = url.pathname;
  e.respondWith(caches.open(CACHE).then(async (c) => {
    const hit = await c.match(key);
    const net = fetch(e.request).then((r) => { if (r.ok) c.put(key, r.clone()); return r; });
    if (hit) { e.waitUntil(net.catch(() => {})); return hit; }
    return net;
  }));
});

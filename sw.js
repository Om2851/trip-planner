// Keeps the app shell (and the Firebase SDK) available offline.
// Bump VERSION when you deploy changes so phones pick them up.
const VERSION = 'v1';
const SHELL = ['./', 'index.html', 'style.css', 'app.js', 'cloud.js', 'firebase-config.js', 'manifest.webmanifest', 'icons/icon-192.png'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  const cacheable = url.origin === location.origin || url.host === 'www.gstatic.com' || url.host.startsWith('fonts.');
  if (!cacheable) return; // Firestore/Auth traffic goes straight to the network.
  // Stale-while-revalidate: answer from cache instantly, refresh in the background.
  e.respondWith(caches.open(VERSION).then(async (cache) => {
    const hit = await cache.match(e.request);
    const net = fetch(e.request).then((res) => { if (res.ok) cache.put(e.request, res.clone()); return res; }).catch(() => hit);
    return hit || net;
  }));
});

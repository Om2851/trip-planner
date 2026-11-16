// Network-first: always try the latest files; use the saved copy only when offline.
// Bump VERSION when you deploy changes.
const VERSION = 'yatri-v2';
const SHELL = ['./', 'index.html', 'style.css', 'manifest.webmanifest', 'firebase-config.js', 'icons/icon-192.png',
  'js/main.js', 'js/store.js', 'js/art.js', 'js/ui.js', 'js/geo.js', 'js/cloud.js',
  'js/views/plan.js', 'js/views/bookings.js', 'js/views/bag.js', 'js/views/money.js', 'js/views/chat.js', 'js/views/settings.js', 'js/views/trips.js'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(VERSION).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== VERSION).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  if (e.request.method !== 'GET') return;
  const url = new URL(e.request.url);
  const cacheable = url.origin === location.origin || url.host === 'www.gstatic.com' || url.host.startsWith('fonts.');
  if (!cacheable) return; // Firebase, place search and routing go straight to the network
  e.respondWith(
    fetch(e.request, { cache: 'no-cache' })
      .then((res) => { if (res.ok) { const copy = res.clone(); caches.open(VERSION).then((c) => c.put(e.request, copy)); } return res; })
      .catch(() => caches.match(e.request, { ignoreSearch: true }))
  );
});

// Open Edition app: keeps the shell available offline (useful on the boat).
// API calls always go to the network; photos are cached as they're viewed.
const SHELL = 'oe-shell-v1';
const FILES = ['/app/', '/app/app.js', '/app/upload.js', '/app/itinerary.json', '/app/manifest.webmanifest', '/app/icons/icon-192.png', '/assets/fonts/Aspekta-400.woff2', '/assets/fonts/Aspekta-550.woff2'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(SHELL).then((c) => c.addAll(FILES).catch(() => {})).then(() => self.skipWaiting()));
});
self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== SHELL && k !== 'oe-media').map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET') return;
  if (url.pathname.startsWith('/api/')) return; // always live
  if (url.hostname.endsWith('blob.vercel-storage.com') || url.pathname.startsWith('/assets/')) {
    e.respondWith(caches.open('oe-media').then((c) => c.match(e.request).then((hit) => hit || fetch(e.request).then((r) => { if (r.ok) c.put(e.request, r.clone()); return r; }))));
    return;
  }
  if (url.origin === location.origin && url.pathname.startsWith('/app')) {
    // network first, fall back to cache
    e.respondWith(fetch(e.request).then((r) => { if (r.ok) caches.open(SHELL).then((c) => c.put(e.request, r.clone())); return r; }).catch(() => caches.match(e.request)));
  }
});

// Service worker sederhana: aplikasi tetap terbuka saat sinyal jelek. Data (/api) selalu diambil langsung.
const CACHE = 'jatuh-tempo-v4';
const SHELL = ['/', '/app.css', '/js/app.js', '/js/jadwal.js', '/js/teks.js', '/ikon/ikon.svg', '/ikon/padel.webp', '/manifest.webmanifest'];

self.addEventListener('install', (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.startsWith('/api/') || url.pathname.startsWith('/kal/')) return;
  // Utamakan jaringan supaya versi terbaru langsung terpakai; cache hanya cadangan.
  e.respondWith(
    fetch(e.request)
      .then((res) => {
        const salinan = res.clone();
        caches.open(CACHE).then((c) => c.put(e.request, salinan));
        return res;
      })
      .catch(() => caches.match(e.request).then((r) => r || caches.match('/'))),
  );
});

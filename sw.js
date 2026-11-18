/* One for All — service worker: bisa dibuka tanpa internet, dan membuka app saat notifikasi diketuk.
   Naikkan angka VERSI setiap kali file app diubah supaya HP mengambil versi terbaru. */
const VERSI = 'ofa-v2';
const SHELL = [
  './', 'index.html', 'core.js', 'app.js', 'manifest.webmanifest',
  'icons/icon-192.png', 'icons/icon-512.png', 'icons/maskable-512.png', 'icons/apple-touch-icon.png', 'icons/badge-96.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSI).then((c) => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== VERSI).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // Halaman app (termasuk ?aksi=… dan bagikan): ambil dari cache, perbarui diam-diam
  if (req.mode === 'navigate') {
    event.respondWith(
      caches.match('index.html').then((cached) => {
        const fresh = fetch(req).then((res) => {
          if (res.ok) caches.open(VERSI).then((c) => c.put('index.html', res.clone()));
          return res;
        }).catch(() => cached);
        return cached || fresh;
      })
    );
    return;
  }

  // File app dan font: cache dulu, lalu perbarui di latar
  if (url.origin === self.location.origin || /fonts\.(googleapis|gstatic)\.com$/.test(url.hostname)) {
    event.respondWith(
      caches.match(req).then((cached) => {
        const fresh = fetch(req).then((res) => {
          if (res && (res.ok || res.type === 'opaque')) {
            const copy = res.clone();
            caches.open(VERSI).then((c) => c.put(req, copy));
          }
          return res;
        }).catch(() => cached);
        return cached || fresh;
      })
    );
  }
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      for (const c of list) { if ('focus' in c) return c.focus(); }
      return self.clients.openWindow('./');
    })
  );
});

/* LOSY Turbo SW v71: Network-First for HTML + Stale-While-Revalidate for Assets
   Гарантирует 100% свежесть игровых режимов и оболочки без устаревшего кэша. */

const CACHE = 'losy-turbo-cache-v71';

const PRECACHE_ASSETS = [
  '/',
  '/dist/shell.bundle.css?v=71',
  '/dist/app.bundle.js?v=71',
  '/assets/sounds/losy-ambient-soft-v71.mp3',
  '/assets/fonts/Unbounded-Variable.woff2',
  '/assets/fonts/Inter-Variable.woff2',
  '/logo/losyvpn-logo.png',
  '/assets/covers/bombs.webp',
  '/assets/covers/rocket.webp',
  '/assets/covers/upgrade.webp',
  '/modes/losy-upgrade-v24.html?v=71',
  '/modes/losy-bombs.html?v=71',
  '/modes/losy-rocket.html?v=71'
];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS).catch((err) => {
        console.warn('SW pre-cache warning:', err);
      });
    })
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  // Видео, аудио и range-запросы обходят SW напрямую в нативный стек стриминга
  if (
    req.headers.has('range') ||
    req.destination === 'video' ||
    req.destination === 'audio' ||
    /\.(mp4|webm|ogv|m4v)(\?.*)?$/i.test(req.url)
  ) {
    return;
  }

  const url = new URL(req.url);
  if (url.origin !== location.origin) return; // telegram sdk / сторонние — мимо

  // REST API запросы не кэшируем через SW
  if (url.pathname.startsWith('/api/')) {
    return;
  }

  // ДЛЯ HTML (ДОКУМЕНТОВ И РЕЖИМОВ): NETWORK-FIRST (СНАЧАЛА СЕТЬ, КЭШ ТОЛЬКО ЕСЛИ ОФФЛАЙН)
  if (req.destination === 'document' || url.pathname.endsWith('.html') || url.pathname === '/') {
    event.respondWith(
      fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const copy = networkResponse.clone();
            caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return networkResponse;
        })
        .catch(() => caches.match(req))
    );
    return;
  }

  // ДЛЯ СТАТИЧЕСКИХ АССЕТОВ (ШРИФТЫ, ИЗОБРАЖЕНИЯ, BUNDLES): STALE-WHILE-REVALIDATE
  event.respondWith(
    caches.match(req).then((cachedResponse) => {
      const fetchPromise = fetch(req)
        .then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE).then((cache) => cache.put(req, responseToCache));
          }
          return networkResponse;
        })
        .catch(() => cachedResponse);

      return cachedResponse || fetchPromise;
    })
  );
});

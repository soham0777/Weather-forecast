// Aurora Weather service worker — app-shell caching + best-effort offline API fallback.
const CACHE_VERSION = 'aurora-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/base.css',
  './css/sky.css',
  './css/layout.css',
  './css/components.css',
  './js/app.js',
  './js/api.js',
  './js/config.js',
  './js/icons.js',
  './js/charts.js',
  './js/forecast.js',
  './js/format.js',
  './js/aqi.js',
  './js/ui.js',
  './js/sky-fx.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/maskable-192.png',
  './icons/maskable-512.png',
  './icons/apple-touch-icon.png',
  './icons/favicon-32.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION)
      .then((cache) => cache.addAll(APP_SHELL))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  const isApi = url.hostname.includes('openweathermap.org');

  if (isApi) {
    // Network-first: fresh data when online, last-known response when offline.
    event.respondWith(
      fetch(request)
        .then((response) => {
          const clone = response.clone();
          caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
          return response;
        })
        .catch(() => caches.match(request)),
    );
    return;
  }

  if (url.origin === self.location.origin) {
    // Cache-first for the app shell, with a network fallback that refreshes the cache.
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request).then((response) => {
        const clone = response.clone();
        caches.open(CACHE_VERSION).then((cache) => cache.put(request, clone));
        return response;
      })),
    );
  }
});

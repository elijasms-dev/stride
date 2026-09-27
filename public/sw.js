const CACHE = 'stride-offline-shell-v1';
const FILES = [
  '/offline.html',
  '/offline.js',
  '/offline.css',
  '/journal-store.js',
  '/favicon.svg',
];
self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(FILES)));
});
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter(
              (key) => key.startsWith('stride-offline-shell-') && key !== CACHE,
            )
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin || event.request.method !== 'GET')
    return;
  // Authentication, API data, exports and private HTML never enter CacheStorage.
  if (
    event.request.mode === 'navigate' &&
    (url.pathname === '/' || url.pathname === '/offline.html')
  ) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match('/offline.html')),
    );
  } else if (FILES.includes(url.pathname)) {
    event.respondWith(
      caches
        .match(url.pathname)
        .then((cached) => cached || fetch(event.request)),
    );
  }
});

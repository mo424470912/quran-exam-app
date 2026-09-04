// Service worker for برنامج اختبارات حفظ القرآن الكريم.
// Goal: once the app has been opened online at least once, it should
// open instantly with no network at all (mosque/offline use case).
// Firebase Firestore's own offline persistence (enabled in index.html)
// handles the *data* (exams/students/schedule/accounts). This service
// worker only handles the *app shell* — the HTML/CSS/JS/fonts/icons —
// so the page itself loads even with zero connectivity.

const CACHE_NAME = 'quran-exam-app-v1';
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  './icon-512-maskable.png',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js',
  'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js',
  'https://cdnjs.cloudflare.com/ajax/libs/exceljs/4.4.0/exceljs.min.js',
  'https://fonts.googleapis.com/css2?family=Amiri:wght@400;700&family=Tajawal:wght@400;500;700;900&display=swap',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => Promise.all(
        APP_SHELL.map((url) =>
          cache.add(url).catch((err) => console.warn('تعذّر تخزين', url, err))
        )
      ))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((names) =>
      Promise.all(names.filter((n) => n !== CACHE_NAME).map((n) => caches.delete(n)))
    ).then(() => self.clients.claim())
  );
});

// Strategy: try the network first (to pick up app updates when online),
// fall back to the cache when offline. Firestore reads/writes go
// straight to Firebase's own SDK (not through this fetch handler in a
// way that matters), so this only needs to cover the app shell files.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
        return response;
      })
      .catch(() => caches.match(event.request).then((cached) => cached || caches.match('./index.html')))
  );
});

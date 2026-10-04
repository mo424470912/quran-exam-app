// Service worker for برنامج اختبارات حفظ القرآن الكريم.
// Goal: once the app has been opened online at least once, it should
// open instantly with no network at all (mosque/offline use case).
// Firebase Firestore's own offline persistence (enabled in index.html)
// handles the *data* (exams/students/schedule/accounts). This service
// worker only handles the *app shell* — the HTML/CSS/JS/fonts/icons —
// so the page itself loads even with zero connectivity.

const CACHE_NAME = 'quran-exam-app-v2';
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
  'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js',
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

// Strategy: cache-first, network-in-the-background ("stale-while-
// revalidate"). Respond from the cached app shell IMMEDIATELY when
// it's there — that's what makes offline/weak-connection opens instant
// instead of hanging while the browser waits on a network request that
// may stall for many seconds before it finally fails. Any fresher
// version fetched from the network quietly replaces the cached copy
// for the *next* open; it never delays the current one. Only when
// nothing is cached yet (first-ever visit) do we wait on the network,
// since there's nothing else to show.
self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cached) => {
      const networkUpdate = fetch(event.request)
        .then((response) => {
          if (response && response.ok) {
            const copy = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy)).catch(() => {});
          }
          return response;
        })
        .catch(() => null);

      if (cached) {
        // Fire the network update in the background; don't make the
        // page wait on it. Swallow any rejection so it doesn't surface
        // as an "unhandled promise rejection" with nothing awaiting it.
        networkUpdate.catch(() => {});
        return cached;
      }

      // Nothing cached for this request yet — our only option is to
      // wait for the network, falling back to the cached app shell
      // (index.html) if even that fails, so navigation still works.
      return networkUpdate.then((r) => r || caches.match('./index.html'));
    })
  );
});

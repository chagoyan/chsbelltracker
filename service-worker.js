// Bumping CACHE_NAME (e.g. to "chs-bell-v2") forces browsers to fetch fresh
// copies of every file below next load — do this whenever you edit the app,
// especially if you update the First Day of School times next year.
const CACHE_NAME = "chs-bell-v10";

const FILES_TO_CACHE = [
  "./",
  "./index.html",
  "./styles.css",
  "./app.js",
  "./manifest.json",
  "./alarm.wav",
  "./chime.wav",
  "./logo.png",
  "./favicon.ico",
  "./icon-192.png",
  "./icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(FILES_TO_CACHE))
  );
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k)))
    )
  );
  self.clients.claim();
});

// Cache-first strategy — this app's content rarely changes and needs to
// work reliably even when school wifi drops.
self.addEventListener("fetch", (event) => {
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});

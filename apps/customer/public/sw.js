// Minimal service worker: makes the app installable and shows an offline page.
// It deliberately caches nothing that could hold personal data (no pages, no API responses).
const OFFLINE = "offline-v1";
self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(OFFLINE).then((c) => c.add(new Request("/offline.html", { cache: "reload" }))));
  self.skipWaiting();
});
self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== OFFLINE).map((k) => caches.delete(k)))));
  self.clients.claim();
});
self.addEventListener("fetch", (e) => {
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.open(OFFLINE).then((c) => c.match("/offline.html"))));
  }
});

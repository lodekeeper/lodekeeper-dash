// Minimal service worker for PWA installability
const CACHE_NAME = "lodekeeper-v1";

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", () => self.clients.claim());

// Network-first strategy — dashboard needs live data
self.addEventListener("fetch", (event) => {
  event.respondWith(
    fetch(event.request).catch(() => caches.match(event.request))
  );
});

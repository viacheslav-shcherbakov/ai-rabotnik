/* AI-Rabotnik Service Worker — offline-first для статики */
const CACHE = "ai-rabotnik-v3";
const ASSETS = [
  "/",
  "/index.html",
  "/styles.css",
  "/app.js",
  "/manifest.json",
  "/robots.txt",
  "/sitemap.xml",
  "/assets/icons/favicon.svg",
  "/assets/icons/icon-192.png"
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(caches.keys().then((keys) => {
    return Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)));
  }).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  // Только GET
  if (e.request.method !== "GET") return;
  // Для навигации — network-first
  if (e.request.mode === "navigate") {
    e.respondWith(fetch(e.request).catch(() => caches.match("/index.html")));
    return;
  }
  // Статика — cache-first
  e.respondWith(
    caches.match(e.request).then((cached) =>
      cached || fetch(e.request).then((resp) => {
        // Кэшируем только same-origin успешные ответы
        if (resp.ok && new URL(e.request.url).origin === location.origin) {
          const clone = resp.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return resp;
      }).catch(() => cached)
    )
  );
});
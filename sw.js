/* 简单的离线缓存 Service Worker —— 让「添加到主屏幕」后可离线游玩 */
const CACHE = "naoli-v1";
const ASSETS = [
  ".",
  "index.html",
  "assets/style.css",
  "assets/app.js",
  "manifest.webmanifest",
  "icon-192.png",
  "icon-512.png",
  "apple-touch-icon.png",
];

self.addEventListener("install", (e) => {
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (e) => {
  e.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k)))).then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  e.respondWith(
    caches.match(e.request).then((cached) =>
      cached ||
      fetch(e.request)
        .then((resp) => { const copy = resp.clone(); caches.open(CACHE).then((c) => c.put(e.request, copy)); return resp; })
        .catch(() => caches.match("index.html"))
    )
  );
});

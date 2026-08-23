/* عامل الخدمة — يمكّن العمل دون اتصال والتثبيت على الجهاز */
const CACHE = "smart-trader-v3";
const CORE = ["/", "/index.html", "/manifest.webmanifest"];

/** مسارات تخص أدوات التطوير يجب ألا تُخزَّن مؤقتاً إطلاقاً */
const isDevAsset = (pathname) =>
  pathname.startsWith("/src/") ||
  pathname.startsWith("/@vite") ||
  pathname.startsWith("/@id") ||
  pathname.startsWith("/@fs") ||
  pathname.startsWith("/node_modules/") ||
  pathname.endsWith(".ts") ||
  pathname.endsWith(".tsx");

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then((cache) => cache.addAll(CORE)).then(() => self.skipWaiting()),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (isDevAsset(url.pathname)) return;

  if (req.mode === "navigate") {
    event.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put("/index.html", copy));
          return res;
        })
        .catch(() => caches.match("/index.html")),
    );
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req)),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skipWaiting") self.skipWaiting();
});

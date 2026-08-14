const CACHE = "raku-score-v3";
const PRECACHE = [
  "/",
  "/icon.svg",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-512-maskable.png",
  "/apple-touch-icon.png",
  "/manifest.webmanifest",
];

function isNextRouterRequest(req) {
  const url = new URL(req.url);
  if (url.pathname.startsWith("/_next/")) return true;
  return (
    req.headers.has("RSC") ||
    req.headers.has("Next-Url") ||
    req.headers.has("Next-Router-State-Tree") ||
    req.headers.has("Next-Router-Prefetch") ||
    req.headers.has("Next-Router-Segment-Prefetch")
  );
}

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE).then(async (cache) => {
      await Promise.all(PRECACHE.map((url) => cache.add(url).catch(() => undefined)));
      await self.skipWaiting();
    }),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("fetch", (event) => {
  const req = event.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;
  if (isNextRouterRequest(req)) return;

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/")));
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res.ok && (url.pathname.startsWith("/icon") || url.pathname.endsWith(".webmanifest"))) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req)),
  );
});

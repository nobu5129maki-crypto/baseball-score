const scopePath = new URL("./", self.location).pathname;
const BASE = scopePath === "/" ? "" : scopePath.replace(/\/$/, "");

function abs(path) {
  if (path.charAt(0) !== "/") path = "/" + path;
  if (BASE === "") return path;
  if (path === "/") return BASE + "/";
  return BASE + path;
}

const CACHE = "raku-score-v5";
const PRECACHE = [
  abs("/"),
  abs("/icon.svg"),
  abs("/icon-192.png"),
  abs("/icon-512.png"),
  abs("/icon-512-maskable.png"),
  abs("/apple-touch-icon.png"),
  abs("/manifest.webmanifest"),
];

function isNextRouterRequest(req) {
  const url = new URL(req.url);
  if (url.pathname.indexOf("/_next/") !== -1) return true;
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
  if (url.pathname.indexOf(scopePath) !== 0) return;
  if (isNextRouterRequest(req)) return;

  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match(abs("/"))));
    return;
  }

  event.respondWith(
    fetch(req)
      .then((res) => {
        const iconish = url.pathname.indexOf("/icon") !== -1 || url.pathname.endsWith(".webmanifest");
        if (res.ok && iconish) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() => caches.match(req)),
  );
});

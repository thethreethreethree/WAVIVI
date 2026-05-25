/* WAVIVI service worker — keeps installed users on the latest version.
 *
 * Strategy: network-first for everything, so any deploy or changed asset is
 * picked up immediately. Only immutable, content-hashed build files
 * (/_next/static/) are cached long-term — their URLs change when content
 * changes, so they can never go stale. The cache is just an offline safety
 * net, never a source of stale code or images. */

const CACHE = "wavivi-v4";
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.add(OFFLINE_URL)));
  // Activate this new worker immediately instead of waiting for old tabs.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data === "skip-waiting") self.skipWaiting();
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  // Leave cross-origin requests alone (map tiles, Supabase, fonts…).
  if (url.origin !== self.location.origin) return;

  // Immutable hashed build assets — cache-first (safe, URL-versioned).
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            const copy = res.clone();
            caches.open(CACHE).then((c) => c.put(request, copy));
            return res;
          }),
      ),
    );
    return;
  }

  // Page navigations — always network; offline page as the fallback.
  if (request.mode === "navigate") {
    event.respondWith(
      fetch(request).catch(
        async () =>
          (await caches.match(request)) || caches.match(OFFLINE_URL),
      ),
    );
    return;
  }

  // Everything else (images, /public assets, API) — network-first, so an
  // updated file shows up right away; cached copy is the offline fallback.
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((c) => c.put(request, copy));
        }
        return res;
      })
      .catch(() => caches.match(request)),
  );
});

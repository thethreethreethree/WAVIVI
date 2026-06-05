/* WAVIVI service worker — keeps installed users on the latest version.
 *
 * Strategy: network-first for everything, so any deploy or changed asset is
 * picked up immediately. Only immutable, content-hashed build files
 * (/_next/static/) are cached long-term — their URLs change when content
 * changes, so they can never go stale. The cache is just an offline safety
 * net, never a source of stale code or images. */

// Bumped v6 → v7 on 2026-06-06 to roll out web-push handlers (Layer 2
// of the notifications system). Existing v6 service workers don't have
// the `push` / `notificationclick` listeners below; installed-PWA users
// need this update to receive notifications when the app is closed.
// Bump this number every deploy that needs to reach installed clients
// (UI / chat / SW behaviour) rather than waiting for them to manually
// refresh.
const CACHE = "wavivi-v7";
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

  // Cache.put() rejects partial (206) and opaque responses — that
  // rejection becomes an unhandled promise that pollutes the console
  // and can break the navigate handler downstream. Centralised guard.
  const isCacheable = (res) =>
    res && res.ok && res.status === 200 && res.type === "basic";

  // Immutable hashed build assets — cache-first (safe, URL-versioned).
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.match(request).then(
        (cached) =>
          cached ||
          fetch(request).then((res) => {
            if (isCacheable(res)) {
              const copy = res.clone();
              caches
                .open(CACHE)
                .then((c) => c.put(request, copy))
                .catch(() => {});
            }
            return res;
          }),
      ),
    );
    return;
  }

  // Page navigations — always network; offline page as the fallback.
  // Wrap in an async IIFE so we always resolve to a Response (never
  // `undefined`) — otherwise respondWith rejects with
  // "Failed to convert value to 'Response'" and the page errors.
  if (request.mode === "navigate") {
    event.respondWith(
      (async () => {
        try {
          return await fetch(request);
        } catch {
          const cached = await caches.match(request);
          if (cached) return cached;
          const offline = await caches.match(OFFLINE_URL);
          if (offline) return offline;
          // Last-resort fallback so respondWith never sees undefined.
          return new Response("Offline", {
            status: 503,
            headers: { "content-type": "text/plain; charset=utf-8" },
          });
        }
      })(),
    );
    return;
  }

  // Everything else (images, /public assets, API) — network-first, so an
  // updated file shows up right away; cached copy is the offline fallback.
  event.respondWith(
    fetch(request)
      .then((res) => {
        if (isCacheable(res)) {
          const copy = res.clone();
          caches
            .open(CACHE)
            .then((c) => c.put(request, copy))
            .catch(() => {});
        }
        return res;
      })
      .catch(async () => {
        const cached = await caches.match(request);
        if (cached) return cached;
        return new Response("", { status: 504 });
      }),
  );
});

/* -- Web push (Layer 2 of the notifications system) -------------------
 *
 * The server's lib/push/send.ts ships JSON payloads of shape:
 *   { type, title, body, url, data? }
 *
 * `push` fires when a payload arrives. We surface a native OS-level
 * notification with the title/body, tagged by `type` so a newer push
 * of the same kind replaces a stale one in the OS tray (no spam if a
 * busy group fires five messages back-to-back). The `data.url` carries
 * the route the notificationclick handler navigates to.
 *
 * `notificationclick` runs when the user taps an OS notification. We
 * close the notification, then either focus an already-open Wondavu
 * tab and navigate it to the right URL, or open a fresh window if no
 * client is open.
 *
 * Failures here are silent — the OS already silently drops malformed
 * pushes, and there's no user to surface a JS error to.
 */
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload;
  try {
    payload = event.data.json();
  } catch {
    return;
  }
  const title = String(payload.title ?? "Wondavu");
  const body = String(payload.body ?? "");
  const url = String(payload.url ?? "/notifications");
  // Tag: collapsing key. Multiple pushes with the same tag replace
  // each other in the OS tray instead of stacking. Per-type tagging
  // means a chat-message burst collapses to one notification per
  // group, not one per message.
  const tag = String(payload.type ?? "wondavu");
  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/wondavu-icon-192.png",
      badge: "/wondavu-icon-192.png",
      tag,
      renotify: false,
      data: { url },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) ||
    "/notifications";
  event.waitUntil(
    (async () => {
      const all = await self.clients.matchAll({
        type: "window",
        includeUncontrolled: true,
      });
      // Same-origin client open? Focus + navigate it.
      for (const client of all) {
        if (client.url.startsWith(self.location.origin)) {
          await client.focus();
          if ("navigate" in client) {
            await client.navigate(target).catch(() => {});
          }
          return;
        }
      }
      // No open window — fresh tab/window pointing at the target route.
      await self.clients.openWindow(target);
    })(),
  );
});

/**
 * Lightweight image preloader.
 *
 * Warming the browser HTTP cache so a soon-to-be-viewed image is already
 * downloaded when the user navigates to it. Used on list pages where we
 * know which detail page (and which photos) the user is most likely to
 * tap next — we don't blanket-prefetch the whole catalog because the
 * Instagram CDN photos are large enough that 178 stays × 6 photos would
 * eat tens of MB of cellular data.
 *
 * Dedupes by URL so the same image is never requested twice in a session.
 * On slow connections (2G / save-data) we skip the warm-up entirely.
 */

import { photoThumb } from "./images";

const requested = new Set<string>();

/** True when the user is on a "slow" connection — skip preloading. */
function shouldSkip(): boolean {
  if (typeof navigator === "undefined") return true;
  const c = (
    navigator as unknown as {
      connection?: { saveData?: boolean; effectiveType?: string };
    }
  ).connection;
  if (!c) return false;
  if (c.saveData) return true;
  return c.effectiveType === "2g" || c.effectiveType === "slow-2g";
}

/**
 * Schedule one image for background download. Sized via `photoThumb` so we
 * fetch the same right-sized variant the gallery later renders — no extra
 * traffic, just earlier traffic.
 */
export function preloadImage(url: string | null | undefined, width = 800) {
  if (!url || requested.has(url) || shouldSkip()) return;
  requested.add(url);
  // `new Image()` triggers an HTTP GET that lands in the browser's cache.
  // We never attach it to the DOM; the request happens, the response is
  // cached, and the Image object is garbage-collected.
  const img = new Image();
  img.referrerPolicy = "no-referrer";
  img.decoding = "async";
  img.src = photoThumb(url, width);
}

/**
 * Preload a list of URLs, deferred to browser-idle time so it doesn't
 * compete with the initial render. Useful for "user hovered a card" —
 * we want to fire off the whole gallery without blocking.
 */
export function preloadImages(urls: (string | null | undefined)[], width = 800) {
  const schedule =
    typeof window !== "undefined" &&
    typeof (window as unknown as { requestIdleCallback?: unknown })
      .requestIdleCallback === "function"
      ? (window as unknown as {
          requestIdleCallback: (fn: () => void) => void;
        }).requestIdleCallback
      : (fn: () => void) => setTimeout(fn, 0);
  schedule(() => {
    for (const u of urls) preloadImage(u, width);
  });
}

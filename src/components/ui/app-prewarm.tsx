"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { preloadImage } from "@/lib/utils/preload-images";

/**
 * App-wide warm-up: after the first paint, quietly fetch the chunks and
 * assets the user is most likely to need next, so navigating around the
 * app doesn't pause on cold loads.
 *
 * Runs strictly during browser-idle time so it never competes with the
 * initial render. Honours data-saver and 2G connections — does nothing
 * there. Idempotent within a tab (a module-level guard prevents a second
 * run if the component remounts on route change).
 *
 * What it warms:
 *   • Next.js route bundles for every main screen via router.prefetch()
 *     (chunk-level only — data is still fetched fresh on dynamic pages)
 *   • The Leaflet library, so /map, /tools/map and /nav don't block on
 *     a 60-90 kB dynamic import the first time you open them
 *   • The handful of always-visible PNG icons used by the bottom nav
 *     and theme-conditional backgrounds
 */

/** Main app screens — the ones reachable from the hub / bottom nav. */
const PREWARM_ROUTES = [
  "/stay",
  "/eat",
  "/todo",
  "/events",
  "/meet",
  "/map",
  "/tools",
  "/tools/map",
  "/susen",
  "/where-to-next",
  "/profile",
  "/feed",
  "/notes",
  "/notifications",
  "/settings",
  "/nav",
  "/welcome",
];

/** Bottom-nav icons + paper backgrounds we want decoded before first use. */
const PREWARM_IMAGES = [
  "/icons/icon.svg",
  "/travejor-logo.png",
  "/backgrounds/cute/bg-01.png",
  "/backgrounds/orange/bg.png",
];

let warmed = false;

export function AppPrewarm() {
  const router = useRouter();

  useEffect(() => {
    if (warmed) return;
    if (typeof window === "undefined") return;

    // Respect data-saver / 2G — skip entirely.
    const conn = (
      navigator as unknown as {
        connection?: { saveData?: boolean; effectiveType?: string };
      }
    ).connection;
    if (
      conn?.saveData ||
      conn?.effectiveType === "2g" ||
      conn?.effectiveType === "slow-2g"
    ) {
      return;
    }

    warmed = true;

    const idle =
      typeof (window as unknown as { requestIdleCallback?: unknown })
        .requestIdleCallback === "function"
        ? (window as unknown as {
            requestIdleCallback: (fn: () => void, opts?: { timeout: number }) => void;
          }).requestIdleCallback
        : (fn: () => void) => setTimeout(fn, 600);

    idle(
      () => {
        // 1. Route chunks — Next handles dedupe internally, safe to call
        //    repeatedly with the same path.
        for (const path of PREWARM_ROUTES) {
          try {
            router.prefetch(path);
          } catch {
            /* prefetch is best-effort */
          }
        }

        // 2. Leaflet — used by Vibe Map, Toolbox Map, and /nav. The dynamic
        //    `import("leaflet")` resolves from cache after this, so the map
        //    page boots without the ~60 kB parse stall.
        import("leaflet").catch(() => {});

        // 3. Decoded brand images that show up early on every screen.
        for (const src of PREWARM_IMAGES) preloadImage(src, 256);
      },
      { timeout: 2000 },
    );
  }, [router]);

  return null;
}

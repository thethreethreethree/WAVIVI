"use client";

import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/**
 * Thin top-of-screen progress bar that activates whenever a navigation
 * is in flight, so a slow network still feels responsive.
 *
 * Mechanism:
 *  - We intercept clicks on `<a>` elements that point at an in-app route
 *    and start the bar immediately. The user gets motion within ~50 ms
 *    of tapping — even before the server has done anything.
 *  - When the new pathname/searchParams commit (or after a 10 s safety
 *    timeout), we finish the bar.
 *
 * Why not Next's experimental `useLinkStatus`? It only covers `<Link>`
 * components, misses programmatic `router.push` and `<form action>` —
 * which are both used across this app. Click-interception is universal.
 */
export function NavigationProgress() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [active, setActive] = useState(false);
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const safetyRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cancel timers + reset bar.
  function finish() {
    setProgress(100);
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (safetyRef.current) {
      clearTimeout(safetyRef.current);
      safetyRef.current = null;
    }
    // Let the user see the full bar for one frame before fading out.
    setTimeout(() => {
      setActive(false);
      setProgress(0);
    }, 220);
  }

  function start() {
    if (active) return;
    setActive(true);
    setProgress(8);
    // Ease toward 85% asymptotically — never quite hits 100% until the
    // pathname commit calls finish().
    timerRef.current = setInterval(() => {
      setProgress((p) => {
        if (p >= 85) return p;
        const step = (85 - p) * 0.12;
        return p + Math.max(0.6, step);
      });
    }, 180);
    // Safety net: if the navigation truly hangs (10 s), drop the bar
    // so the user doesn't see a stuck loader forever.
    safetyRef.current = setTimeout(finish, 10000);
  }

  // Watch for route commits.
  useEffect(() => {
    if (active) finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  // Intercept clicks on internal links + programmatic navs.
  useEffect(() => {
    function isInternalLinkClick(e: MouseEvent): HTMLAnchorElement | null {
      if (e.defaultPrevented) return null;
      if (e.button !== 0) return null;
      if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return null;
      const target = e.target as Element | null;
      const a = target?.closest("a") as HTMLAnchorElement | null;
      if (!a) return null;
      if (a.target && a.target !== "_self") return null;
      if (a.hasAttribute("download")) return null;
      const href = a.getAttribute("href");
      if (!href) return null;
      if (href.startsWith("#") || href.startsWith("mailto:") || href.startsWith("tel:")) {
        return null;
      }
      // External absolute URL — same-origin only.
      try {
        const url = new URL(href, window.location.href);
        if (url.origin !== window.location.origin) return null;
        // Same path + query → no navigation will commit, don't start.
        if (
          url.pathname === window.location.pathname &&
          url.search === window.location.search
        ) {
          return null;
        }
      } catch {
        return null;
      }
      return a;
    }

    function onClick(e: MouseEvent) {
      const a = isInternalLinkClick(e);
      if (a) start();
    }

    document.addEventListener("click", onClick, { capture: true });
    return () => {
      document.removeEventListener("click", onClick, { capture: true } as EventListenerOptions);
      if (timerRef.current) clearInterval(timerRef.current);
      if (safetyRef.current) clearTimeout(safetyRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!active) return null;

  return (
    <div
      aria-hidden
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        height: 3,
        zIndex: 2147483646,
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          height: "100%",
          width: `${progress}%`,
          background: "linear-gradient(90deg, #ff7e3d 0%, #ffb55a 100%)",
          boxShadow: "0 0 8px rgba(255, 126, 61, 0.55)",
          transition: "width 180ms ease-out, opacity 220ms ease-out",
          opacity: progress >= 100 ? 0 : 1,
        }}
      />
    </div>
  );
}

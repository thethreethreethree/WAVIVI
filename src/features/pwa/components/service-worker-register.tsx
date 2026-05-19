"use client";

import { useEffect } from "react";

/**
 * Manages the PWA service worker.
 *
 * In production: registers `/sw.js` once after load.
 * In development: actively tears down any service worker left over from a
 * previous session (or the deployed site) and clears its caches — a stale
 * worker serves outdated JS chunks, which breaks hydration and leaves the
 * page's buttons unclickable.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    if (process.env.NODE_ENV !== "production") {
      void navigator.serviceWorker.getRegistrations().then((regs) => {
        regs.forEach((reg) => void reg.unregister());
      });
      if ("caches" in window) {
        void caches.keys().then((keys) => {
          keys.forEach((key) => void caches.delete(key));
        });
      }
      return;
    }

    // When a new service worker takes control, reload once so the user
    // immediately runs the latest version (no manual refresh needed).
    let refreshing = false;
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        if (refreshing) return;
        refreshing = true;
        window.location.reload();
      });
    }

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((reg) => {
          // Poll for a new deploy hourly + whenever the app refocuses.
          const check = () => reg.update().catch(() => {});
          setInterval(check, 60 * 60 * 1000);
          document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") check();
          });
        })
        .catch(() => {
          // Registration failures are non-fatal — the app still works online.
        });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register);
      return () => window.removeEventListener("load", register);
    }
  }, []);

  return null;
}

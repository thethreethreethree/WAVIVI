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

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
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

"use client";

import { THEME_COOKIE, type PersistedTheme } from "@/lib/theme/cookie";

/**
 * Apply a theme client-side: writes the cookie (so the next SSR has it),
 * mirrors to localStorage (for back-compat with existing readers), and
 * flips the html class so the live document updates immediately.
 *
 * Use this from every theme setter — toggle, logo-tap, settings page —
 * so the three storage locations never drift.
 */
export function applyTheme(next: PersistedTheme): void {
  if (typeof document === "undefined") return;

  const c = document.documentElement.classList;
  c.remove("cute", "orange", "sketch", "journal");
  if (next !== "light") c.add(next);

  try {
    localStorage.setItem(THEME_COOKIE, next);
  } catch {
    /* private mode */
  }

  // 1 year, root path, sent with same-site navigations so SSR sees it.
  document.cookie = `${THEME_COOKIE}=${next}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`;
}

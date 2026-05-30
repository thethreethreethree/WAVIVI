"use client";

import { createContext, useContext, useEffect, useState } from "react";

import { type PersistedTheme } from "@/lib/theme/cookie";

/**
 * Client-side theme context. Seeded from the cookie at SSR time so every
 * descendant client component can resolve the correct icon folder on the
 * first paint — no waiting for ThemeImgSwap, no orange flicker.
 *
 * After mount, an html-class observer keeps the context in sync with
 * client-side theme cycles (balloon tap → applyTheme(...) flips the
 * <html> class; this provider notices and re-renders all consumers
 * with the new value so the icons match the palette immediately).
 */
const ThemeCtx = createContext<PersistedTheme>("light");

function readTheme(): PersistedTheme {
  if (typeof document === "undefined") return "light";
  const c = document.documentElement.classList;
  if (c.contains("journal")) return "journal";
  if (c.contains("sketch")) return "sketch";
  return "light";
}

export function ThemeProvider({
  theme,
  children,
}: {
  theme: PersistedTheme;
  children: React.ReactNode;
}) {
  const [current, setCurrent] = useState<PersistedTheme>(theme);

  useEffect(() => {
    // Sync once on mount in case the inline head-script changed the
    // class after SSR (legacy localStorage → cookie migration path).
    const initial = readTheme();
    if (initial !== current) setCurrent(initial);

    const obs = new MutationObserver(() => {
      const next = readTheme();
      setCurrent((prev) => (prev === next ? prev : next));
    });
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return <ThemeCtx.Provider value={current}>{children}</ThemeCtx.Provider>;
}

export function useThemeContext(): PersistedTheme {
  return useContext(ThemeCtx);
}

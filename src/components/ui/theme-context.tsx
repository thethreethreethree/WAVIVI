"use client";

import { createContext, useContext } from "react";

import { type PersistedTheme } from "@/lib/theme/cookie";

/**
 * Client-side theme context. Provided once at the (app)/layout boundary
 * with the cookie value read on the server, so every descendant client
 * component can resolve the correct icon folder on first paint — no
 * waiting for ThemeImgSwap, no orange flicker.
 *
 * The class on <html> is still the source of truth at runtime (CSS,
 * applyTheme cycles), but for SSR-time path resolution this context is
 * the React-friendly way to thread the value down to leaf components
 * like <Icon /> without prop-drilling.
 */
const ThemeCtx = createContext<PersistedTheme>("light");

export function ThemeProvider({
  theme,
  children,
}: {
  theme: PersistedTheme;
  children: React.ReactNode;
}) {
  return <ThemeCtx.Provider value={theme}>{children}</ThemeCtx.Provider>;
}

export function useThemeContext(): PersistedTheme {
  return useContext(ThemeCtx);
}

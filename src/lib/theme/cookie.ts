/**
 * Shared theme-cookie helpers. Theme persistence has two layers:
 *  - cookie (`wavivi-theme`): read on the server so SSR can render the
 *    correct `<html class>` and the right colour palette / icon paths
 *    on the first paint.
 *  - localStorage (`wavivi-theme`): legacy + redundant client-side cache.
 *
 * The inline themeScript in src/app/layout.tsx keeps them in sync (mirrors
 * the cookie to localStorage if missing, and vice versa).
 */
export const THEME_COOKIE = "wavivi-theme";

export type PersistedTheme = "light" | "sketch" | "journal";

const ALL = new Set<PersistedTheme>(["light", "sketch", "journal"]);

export function parseTheme(value: string | null | undefined): PersistedTheme {
  if (value && ALL.has(value as PersistedTheme)) {
    return value as PersistedTheme;
  }
  return "light";
}

/** Convert a persisted theme into the CSS class that lives on <html>. */
export function themeClass(theme: PersistedTheme): "" | "sketch" | "journal" {
  return theme === "light" ? "" : theme;
}

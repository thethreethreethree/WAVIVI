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

/**
 * Resolve an /icons/orange/... path to the active theme's folder.
 * Pure function — pass a theme value, get the themed path. Used by
 * both server components (resolving on SSR for zero-flash icons) and
 * client components (taking the theme as a prop from the server).
 */
export function themedIconPath(orangePath: string, theme: PersistedTheme): string {
  if (theme === "light") return orangePath;
  if (theme === "sketch") return orangePath.replace("/icons/orange/", "/icons/sketch/");
  return orangePath.replace("/icons/orange/", "/icons/journal/");
}

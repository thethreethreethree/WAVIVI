import "server-only";

import { cookies } from "next/headers";

import { parseTheme, type PersistedTheme, THEME_COOKIE } from "@/lib/theme/cookie";

/**
 * Read the persisted theme from the cookie on the server. Use this from
 * any Server Component / Layout that needs to render an icon URL with
 * the correct theme folder on the first paint (no client-side swap, no
 * flash). Returns "light" if no cookie present.
 *
 * The path resolver `themedIconPath()` lives in ./cookie so client
 * components can import it without pulling in this server-only module.
 */
export async function getServerTheme(): Promise<PersistedTheme> {
  const store = await cookies();
  return parseTheme(store.get(THEME_COOKIE)?.value);
}

import "server-only";

import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";

import {
  DEFAULT_LANGUAGE,
  DICTIONARY,
  type Language,
  LANGUAGES,
} from "./dictionary";

/**
 * Server-side language resolution + translation.
 *
 * Resolution order (first hit wins):
 *   1. wv-language cookie — set by the toggle on /profile/language
 *      and the Susen header. Takes effect on the very next render.
 *   2. profiles.language column — survives a fresh device when the
 *      cookie isn't yet set (e.g. first visit on a phone after the
 *      user already chose ES on web).
 *   3. DEFAULT_LANGUAGE ('en').
 *
 * The order matches the wv-region resolution order so admins and
 * regular users see consistent behaviour across both prefs.
 */

const COOKIE_NAME = "wv-language";

function parseLanguage(raw: string | null | undefined): Language | null {
  if (!raw) return null;
  return (LANGUAGES as readonly string[]).includes(raw)
    ? (raw as Language)
    : null;
}

/** Resolve the current request's language. Server Components +
 *  Route Handlers + Server Actions should call this once at the top
 *  of their work. */
export async function getLanguage(): Promise<Language> {
  // Cookie first — instant switch even before the profile UPDATE
  // settles.
  const cookieJar = await cookies();
  const fromCookie = parseLanguage(cookieJar.get(COOKIE_NAME)?.value);
  if (fromCookie) return fromCookie;

  // Profile fallback for signed-in users without a cookie yet.
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const { data } = await supabase
        .from("profiles")
        .select("language")
        .eq("id", user.id)
        .maybeSingle<{ language: string }>();
      const fromProfile = parseLanguage(data?.language ?? null);
      if (fromProfile) return fromProfile;
    }
  } catch {
    // Fall through to default — language is non-critical UX, never
    // worth surfacing an error for.
  }
  return DEFAULT_LANGUAGE;
}

/**
 * Deep accessor used by t() — resolves a dotted key like
 * "susen.welcome" or "common.cancel" through the dictionary.
 *
 * Loose-typed on purpose so we can keep the dictionary nested and
 * the caller can read any leaf without ceremony. The dictionary
 * shape is the canonical contract; missing keys log once in dev.
 */
function lookup(key: string): { en: string; es: string } | null {
  const parts = key.split(".");
  let cur: unknown = DICTIONARY;
  for (const p of parts) {
    if (cur && typeof cur === "object" && p in (cur as object)) {
      cur = (cur as Record<string, unknown>)[p];
    } else {
      return null;
    }
  }
  if (
    cur &&
    typeof cur === "object" &&
    "en" in (cur as object) &&
    "es" in (cur as object)
  ) {
    return cur as { en: string; es: string };
  }
  return null;
}

const missingLogged = new Set<string>();
function logMissingOnce(key: string) {
  if (process.env.NODE_ENV === "production") return;
  if (missingLogged.has(key)) return;
  missingLogged.add(key);
  console.warn(`[i18n] missing translation key: ${key}`);
}

/** Interpolate {placeholder} tokens with the values map. Unknown
 *  tokens are left in place so the missing variable is visible. */
function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) =>
    vars[k] != null ? String(vars[k]) : `{${k}}`,
  );
}

/** Translate a key for the resolved request language. Server-side
 *  alternative to the client `useT()` hook. */
export async function t(
  key: string,
  vars?: Record<string, string | number>,
): Promise<string> {
  const lang = await getLanguage();
  const entry = lookup(key);
  if (!entry) {
    logMissingOnce(key);
    return key;
  }
  return interpolate(entry[lang], vars);
}

/** Translator factory bound to one language — useful for components
 *  that want to translate multiple keys without re-resolving the
 *  language every call. */
export async function getTranslator(): Promise<
  (key: string, vars?: Record<string, string | number>) => string
> {
  const lang = await getLanguage();
  return (key, vars) => {
    const entry = lookup(key);
    if (!entry) {
      logMissingOnce(key);
      return key;
    }
    return interpolate(entry[lang], vars);
  };
}

export { COOKIE_NAME as LANGUAGE_COOKIE };

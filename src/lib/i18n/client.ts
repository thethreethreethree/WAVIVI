"use client";

import { createContext, useContext } from "react";

import {
  DEFAULT_LANGUAGE,
  DICTIONARY,
  type Language,
} from "./dictionary";

/**
 * Client-side i18n.
 *
 * The current language is provided via React context (LanguageProvider
 * in src/app/(app)/layout.tsx wraps the app with the server-resolved
 * value). Components call `useT()` which returns a `t(key, vars?)`
 * function bound to the current language.
 *
 * Server components should use server.ts::t() instead — same
 * dictionary, same key format.
 */

export const LanguageContext = createContext<Language>(DEFAULT_LANGUAGE);

export function useLanguage(): Language {
  return useContext(LanguageContext);
}

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

function interpolate(
  s: string,
  vars?: Record<string, string | number>,
): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) =>
    vars[k] != null ? String(vars[k]) : `{${k}}`,
  );
}

/** Bound translator for the current language. Call inside any
 *  client component. */
export function useT() {
  const lang = useLanguage();
  return (key: string, vars?: Record<string, string | number>): string => {
    const entry = lookup(key);
    if (!entry) {
      if (process.env.NODE_ENV !== "production") {
        // eslint-disable-next-line no-console
        console.warn(`[i18n] missing client translation key: ${key}`);
      }
      return key;
    }
    return interpolate(entry[lang], vars);
  };
}

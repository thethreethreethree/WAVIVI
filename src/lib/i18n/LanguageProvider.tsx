"use client";

import { type ReactNode } from "react";

import { type Language } from "./dictionary";
import { LanguageContext } from "./client";

/** Wraps the app subtree with the server-resolved language so client
 *  components can read it via useLanguage() / useT() without prop-
 *  drilling. Used in src/app/(app)/layout.tsx. */
export function LanguageProvider({
  language,
  children,
}: {
  language: Language;
  children: ReactNode;
}) {
  return (
    <LanguageContext.Provider value={language}>
      {children}
    </LanguageContext.Provider>
  );
}

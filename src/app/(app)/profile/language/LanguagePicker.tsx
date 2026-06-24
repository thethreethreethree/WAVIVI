"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { setLanguageAction } from "@/lib/i18n/actions";
import { type Language } from "@/lib/i18n/dictionary";

interface LanguageOption {
  code: string;
  label: string;
  active: boolean;
}

/** Tappable language list. Active rows fire setLanguageAction which
 *  writes the wv-language cookie AND the profile column; the page
 *  then refreshes so the active-checkmark moves to the new row and
 *  Susen replies in the new language on her very next turn. Inactive
 *  rows still render with a "Coming soon" pill so travellers see the
 *  roadmap. */
export function LanguagePicker({
  languages,
  current,
}: {
  languages: LanguageOption[];
  current: Language;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [optimisticCurrent, setOptimisticCurrent] = useState<string>(current);
  const [error, setError] = useState<string | null>(null);

  function pick(code: string) {
    if (code === optimisticCurrent || pending) return;
    setError(null);
    setOptimisticCurrent(code); // optimistic tick before round-trip
    startTransition(async () => {
      const res = await setLanguageAction(code);
      if (!res.ok) {
        setError(res.error ?? "Couldn't save the language preference.");
        setOptimisticCurrent(current); // revert on failure
        return;
      }
      router.refresh();
    });
  }

  return (
    <>
      {error ? (
        <p className="rounded-xl bg-heat/10 px-3 py-2 text-xs font-medium text-heat">
          {error}
        </p>
      ) : null}
      <ul className="wc-frame rounded-2xl">
        {languages.map((l, i) => {
          const isCurrent = l.code === optimisticCurrent;
          return (
            <li
              key={l.code}
              className={`flex items-center gap-3 px-4 py-3.5 ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <button
                type="button"
                disabled={!l.active || pending}
                onClick={() => pick(l.code)}
                className={`flex min-w-0 flex-1 items-center text-left ${
                  l.active ? "" : "cursor-not-allowed opacity-70"
                }`}
              >
                <span className="block text-base font-bold text-foreground">
                  {l.label}
                </span>
              </button>
              {!l.active ? (
                <span className="shrink-0 rounded-full bg-muted/15 px-2.5 py-1 text-xs font-bold text-muted">
                  Coming soon
                </span>
              ) : isCurrent ? (
                <span className="shrink-0 rounded-full bg-glow/15 px-2.5 py-1 text-xs font-bold text-glow">
                  ✓ Active
                </span>
              ) : (
                <span className="shrink-0 rounded-full bg-cool/15 px-2.5 py-1 text-xs font-bold text-cool">
                  Switch
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </>
  );
}

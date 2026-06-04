"use client";

import { useState, useTransition } from "react";

import { saveInterestsAndContinue } from "../actions";

/**
 * Step 2 — pick 1-5 interest tags.
 *
 * These slugs are kebab-case and stable — they get written to a cookie
 * (wv-interests) and read by the feed ranker + Susen system prompt to
 * tilt recommendations. Adding or renaming a tag here means also
 * updating those consumers, so the list stays short on purpose.
 */
const VIBES: ReadonlyArray<{ slug: string; label: string; emoji: string }> = [
  { slug: "meet-travelers", label: "Meet travelers", emoji: "👋" },
  { slug: "events", label: "Find events", emoji: "🎉" },
  { slug: "local-tips", label: "Local tips", emoji: "🌶️" },
  { slug: "nature", label: "Nature & outdoors", emoji: "🌿" },
  { slug: "food", label: "Eat well", emoji: "🍜" },
  { slug: "quiet", label: "Quiet places", emoji: "🌅" },
  { slug: "nightlife", label: "Nightlife", emoji: "🪩" },
  { slug: "photo-spots", label: "Photo spots", emoji: "📷" },
];

const MAX_PICKS = 5;

export function VibeStepClient() {
  const [picked, setPicked] = useState<Set<string>>(new Set());
  const [pending, startTransition] = useTransition();

  function toggle(slug: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else if (next.size < MAX_PICKS) next.add(slug);
      return next;
    });
  }

  function continueWith(picks: string[]) {
    startTransition(async () => {
      await saveInterestsAndContinue(picks);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {VIBES.map((v) => {
          const on = picked.has(v.slug);
          const atMax = !on && picked.size >= MAX_PICKS;
          return (
            <button
              key={v.slug}
              type="button"
              onClick={() => toggle(v.slug)}
              disabled={pending || atMax}
              aria-pressed={on}
              className={`rounded-full px-3.5 py-2 text-sm font-bold transition active:scale-[0.98] ${
                on
                  ? "bg-glow text-white ring-2 ring-glow"
                  : atMax
                    ? "bg-surface text-muted/50 ring-1 ring-border"
                    : "bg-surface text-foreground ring-1 ring-border hover:ring-glow/40"
              }`}
            >
              <span className="mr-1.5">{v.emoji}</span>
              {v.label}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-muted">
        {picked.size === 0
          ? "Pick up to 5 — or skip if you'd rather not."
          : `${picked.size} of ${MAX_PICKS} picked`}
      </p>

      <button
        type="button"
        onClick={() => continueWith(Array.from(picked))}
        disabled={pending || picked.size === 0}
        className="wc-frame wc-frame-sunset mt-2 block w-full rounded-2xl py-3.5 text-center text-lg font-bold text-white disabled:opacity-50"
      >
        {pending ? "One second…" : "Continue"}
      </button>

      <button
        type="button"
        onClick={() => continueWith([])}
        disabled={pending}
        className="text-center text-sm font-bold text-muted underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
      >
        Skip for now
      </button>
    </div>
  );
}

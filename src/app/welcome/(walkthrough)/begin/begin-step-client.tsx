"use client";

import { useState, useTransition } from "react";

import { finishOnboarding } from "../actions";

/**
 * Step 3 — pick a starting surface. Every choice writes
 * profiles.onboarded_at, which is the gate the auth callbacks check —
 * so no matter which card the user taps, the walkthrough is "done"
 * for them and won't run again on next sign-in.
 *
 * The destination strings here must match the whitelist in
 * finishOnboarding() (welcome/actions.ts). Anything outside it falls
 * back to / silently rather than failing the action — the goal is to
 * never leave a user trapped on the walkthrough.
 */
const DESTINATIONS: ReadonlyArray<{
  dest: string;
  title: string;
  blurb: string;
  emoji: string;
}> = [
  {
    dest: "/tools/map",
    title: "See who's nearby",
    blurb: "Open the Vibe Map and find travelers around you.",
    emoji: "🗺️",
  },
  {
    dest: "/feed",
    title: "Browse the feed",
    blurb: "Photos, tips, and moments from people in your region.",
    emoji: "📸",
  },
  {
    dest: "/susen",
    title: "Ask Susen for tips",
    blurb: "Your local-in-your-pocket — chat for ideas tuned to right now.",
    emoji: "💬",
  },
];

export function BeginStepClient() {
  // Which destination card we're currently routing to — used to disable
  // the *other* cards (and show "Taking you there…" on the active one)
  // while the server action runs.
  const [going, setGoing] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function go(dest: string) {
    setGoing(dest);
    startTransition(async () => {
      await finishOnboarding(dest);
    });
  }

  return (
    <div className="flex flex-col gap-3">
      {DESTINATIONS.map((d) => {
        const active = going === d.dest;
        return (
          <button
            key={d.dest}
            type="button"
            onClick={() => go(d.dest)}
            disabled={pending}
            className={`wc-frame flex items-start gap-3 rounded-2xl p-4 text-left transition active:scale-[0.99] disabled:opacity-60 ${
              active ? "ring-2 ring-glow" : "hover:ring-glow/40"
            }`}
          >
            <span className="text-2xl leading-none" aria-hidden>
              {d.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-lg font-bold leading-tight text-foreground">
                {d.title}
              </span>
              <span className="mt-0.5 block text-sm text-muted">
                {d.blurb}
              </span>
            </span>
            <span className="self-center text-xl text-muted" aria-hidden>
              {active ? "…" : "→"}
            </span>
          </button>
        );
      })}

      <button
        type="button"
        onClick={() => go("/")}
        disabled={pending}
        className="mt-3 text-center text-sm font-bold text-muted underline-offset-4 hover:text-foreground hover:underline disabled:opacity-50"
      >
        Just take me to the home screen
      </button>
    </div>
  );
}

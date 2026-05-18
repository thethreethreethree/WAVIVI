"use client";

import { useState } from "react";

const REACTIONS = [
  { id: "love", emoji: "❤️", label: "Love this" },
  { id: "want", emoji: "🌟", label: "Want to go" },
  { id: "been", emoji: "✓", label: "Been there" },
];

/** Engagement reactions on the listing detail page (local-only). */
export function ListingReactions() {
  const [active, setActive] = useState<Record<string, boolean>>({});

  return (
    <div className="flex flex-wrap gap-2">
      {REACTIONS.map((r) => {
        const on = active[r.id];
        return (
          <button
            key={r.id}
            type="button"
            onClick={() => setActive((a) => ({ ...a, [r.id]: !a[r.id] }))}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-2 text-sm font-semibold transition-colors ${
              on
                ? "bg-glow/15 text-glow ring-1 ring-glow/40"
                : "bg-surface text-muted ring-1 ring-border hover:text-foreground"
            }`}
          >
            <span aria-hidden>{r.emoji}</span>
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

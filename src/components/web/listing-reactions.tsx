"use client";

import { useState } from "react";

/** Painted-asset path per reaction. /icons/rustic/ is the canonical
 *  reference; ThemeImgSwap retargets sketch / journal automatically. */
const REACTIONS = [
  { id: "love", icon: "/icons/rustic/heart_save.png", label: "Love this" },
  { id: "want", icon: "/icons/rustic/star.png",      label: "Want to go" },
  { id: "been", icon: "/icons/rustic/check.png",     label: "Been there" },
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
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={r.icon}
              alt=""
              aria-hidden
              className="h-4 w-4 object-contain"
            />
            {r.label}
          </button>
        );
      })}
    </div>
  );
}

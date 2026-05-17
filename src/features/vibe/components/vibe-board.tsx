"use client";

import { useMemo, useState } from "react";

import { VibeCard } from "@/features/vibe/components/vibe-card";
import { type VibeSort, sortVibeSpots } from "@/features/vibe/heat";
import type { VibeSpot } from "@/lib/vibe/types";

const SORTS: { value: VibeSort; label: string }[] = [
  { value: "hottest", label: "Hottest" },
  { value: "rising", label: "Rising" },
];

/** Ranked, sortable board of live place vibes. */
export function VibeBoard({ spots }: { spots: VibeSpot[] }) {
  const [sort, setSort] = useState<VibeSort>("hottest");

  const ranked = useMemo(() => sortVibeSpots(spots, sort), [spots, sort]);

  return (
    <div className="flex flex-col gap-5">
      <div className="flex gap-2">
        {SORTS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => setSort(opt.value)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              sort === opt.value
                ? "border-glow bg-glow/15 text-glow"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3">
        {ranked.map((spot, i) => (
          <VibeCard key={spot.id} spot={spot} rank={i + 1} />
        ))}
      </div>
    </div>
  );
}

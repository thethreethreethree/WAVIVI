import type { VibeSpot, VibeTrend } from "@/lib/vibe/types";

export type HeatLevel = "quiet" | "warming" | "buzzing" | "on-fire";

/** Buckets a 0-100 vibe score into a named heat level. */
export function heatLevel(score: number): HeatLevel {
  if (score >= 80) return "on-fire";
  if (score >= 60) return "buzzing";
  if (score >= 35) return "warming";
  return "quiet";
}

export const HEAT_META: Record<
  HeatLevel,
  { label: string; color: string; badgeClass: string }
> = {
  "on-fire": {
    label: "On fire",
    color: "#ff5d73",
    badgeClass: "border-heat/40 bg-heat/10 text-heat",
  },
  buzzing: {
    label: "Buzzing",
    color: "#ff9d5c",
    badgeClass: "border-[#ff9d5c]/40 bg-[#ff9d5c]/10 text-[#ff9d5c]",
  },
  warming: {
    label: "Warming up",
    color: "#7c5cff",
    badgeClass: "border-glow/40 bg-glow/10 text-glow",
  },
  quiet: {
    label: "Quiet",
    color: "#19c3a8",
    badgeClass: "border-cool/40 bg-cool/10 text-cool",
  },
};

export const TREND_META: Record<VibeTrend, { label: string; symbol: string }> = {
  rising: { label: "Rising", symbol: "▲" },
  steady: { label: "Steady", symbol: "■" },
  cooling: { label: "Cooling", symbol: "▼" },
};

export type VibeSort = "hottest" | "rising";

/** Sorts vibe spots by the chosen criterion (returns a new array). */
export function sortVibeSpots(spots: VibeSpot[], sort: VibeSort): VibeSpot[] {
  const trendRank: Record<VibeTrend, number> = {
    rising: 0,
    steady: 1,
    cooling: 2,
  };
  return [...spots].sort((a, b) => {
    if (sort === "rising" && a.trend !== b.trend) {
      return trendRank[a.trend] - trendRank[b.trend];
    }
    return b.vibeScore - a.vibeScore;
  });
}

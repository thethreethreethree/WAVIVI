import type { TrustLevel } from "@/types/supabase";

/**
 * Trust level — the 🔴🟠🟡🟢 traveler badge.
 *
 * Blends the rule-based reliability score (OSM data quality) with live
 * community signals (👍/👎 thumbs). Computed at read time so community
 * votes are always reflected without re-scanning.
 */
export function trustLevel(
  reliabilityScore: number,
  thumbsUp = 0,
  thumbsDown = 0,
): TrustLevel {
  let score = reliabilityScore;
  score += Math.min(2, thumbsUp * 0.2);
  score -= Math.min(3, thumbsDown * 0.45);
  score = Math.max(0, Math.min(10, score));

  if (score >= 8) return "green";
  if (score >= 6) return "yellow";
  if (score >= 4) return "orange";
  return "red";
}

/** Display metadata for each trust level. */
export const TRUST_META: Record<
  TrustLevel,
  { label: string; color: string; emoji: string }
> = {
  green: { label: "Trusted", color: "#22c55e", emoji: "🟢" },
  yellow: { label: "Good", color: "#eab308", emoji: "🟡" },
  orange: { label: "Mixed", color: "#f97316", emoji: "🟠" },
  red: { label: "Low trust", color: "#ef4444", emoji: "🔴" },
};

import type { NormalizedUtility } from "@/lib/toolbox/normalize";

/**
 * Deduplication.
 *
 * The DB unique constraint on (source, source_ref) prevents exact repeats
 * across scans. This pass removes *near*-duplicates within a single batch —
 * e.g. the same ATM tagged both as a standalone node and inside a bank.
 */

/** Metres between two coordinates (haversine). */
function distanceM(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(bLat - aLat);
  const dLng = toRad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(aLat)) * Math.cos(toRad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/** Token-overlap name similarity, 0–1. */
function nameSimilarity(a: string, b: string): number {
  const norm = (s: string) =>
    new Set(
      s
        .toLowerCase()
        .replace(/[^a-z0-9 ]/g, "")
        .split(/\s+/)
        .filter(Boolean),
    );
  const ta = norm(a);
  const tb = norm(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let shared = 0;
  for (const tok of ta) if (tb.has(tok)) shared++;
  return shared / Math.max(ta.size, tb.size);
}

const PROXIMITY_M = 35;
const NAME_THRESHOLD = 0.55;

/** Remove near-duplicate utilities from a batch (keeps the first seen). */
export function dedupeUtilities<T extends NormalizedUtility>(items: T[]): T[] {
  const kept: T[] = [];
  for (const item of items) {
    const isDuplicate = kept.some(
      (k) =>
        k.category === item.category &&
        distanceM(
          k.latitude,
          k.longitude,
          item.latitude,
          item.longitude,
        ) < PROXIMITY_M &&
        nameSimilarity(k.name, item.name) >= NAME_THRESHOLD,
    );
    if (!isDuplicate) kept.push(item);
  }
  return kept;
}

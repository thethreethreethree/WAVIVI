import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * City → region reassignment audit.
 *
 * The pass-1 sweep surfaced many cities tagged to the wrong parent
 * region — e.g. "Cainta, Calabarzon" and "El Nido, Palawan" both
 * assigned to `metro_manila_manila_philippines` from a batch import
 * that defaulted everything to Manila. Every downstream geofence
 * dropout in those rows is a symptom; this audit catches the cause.
 *
 * Detector: a city's name often carries its province as the last
 * comma-separated tail (Philippines convention). If that tail matches
 * a DIFFERENT region's `province` (or its `display_name`'s tail) AND
 * differs from the city's current region_id, we propose a swap. Cities
 * with no comma tail OR whose tail doesn't match any region are left
 * alone — those need human judgement.
 *
 * Reassign is destructive across five tables (the city row itself plus
 * the four row tables pointing at it). The server action runs them as
 * a single sequence and returns per-table counts so the admin can
 * confirm what moved.
 */

export type ReassignConfidence = "high" | "medium";

export interface CityRegionSuspect {
  cityId: string;
  cityName: string;
  /** Current region (the one we think is wrong). */
  currentRegionId: string;
  currentRegionName: string;
  /** Proposed correction. */
  proposedRegionId: string;
  proposedRegionName: string;
  /** Why the detector picked the proposal. */
  reason: string;
  confidence: ReassignConfidence;
  /** How many rows currently depend on this city assignment — admins
   *  sort by this so the highest-leverage fixes surface first. */
  rowCount: number;
}

function loose(supabase: ReturnType<typeof createAdminClient>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

const PAGE_SIZE = 1000;

async function countCityRows(
  supabase: ReturnType<typeof createAdminClient>,
): Promise<Map<string, number>> {
  const sb = loose(supabase);
  const counts = new Map<string, number>();
  for (const table of [
    "stays",
    "restaurants",
    "experiences",
    "traveler_utilities",
  ] as const) {
    let from = 0;
    while (true) {
      const { data, error } = await sb
        .from(table)
        .select("city_id")
        .order("id", { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (error) throw new Error(`${table}: ${error.message}`);
      if (!data || data.length === 0) break;
      for (const r of data as unknown as { city_id: string | null }[]) {
        if (!r.city_id) continue;
        counts.set(r.city_id, (counts.get(r.city_id) ?? 0) + 1);
      }
      if (data.length < PAGE_SIZE) break;
      from += PAGE_SIZE;
    }
  }
  return counts;
}

/** Normalise a string for case- and punctuation-insensitive matching. */
function norm(s: string | null | undefined): string {
  return (s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Pull the comma-separated tail of a city name — usually the
 *  province in PH addresses ("Cainta, Calabarzon" → "Calabarzon"). */
function cityTail(name: string): string | null {
  const parts = name.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length < 2) return null;
  return parts[parts.length - 1];
}

/** Surface every city whose name strongly suggests a different region
 *  than its current `region_id`, sorted highest-leverage-first. */
export async function loadCityRegionSuspects(): Promise<CityRegionSuspect[]> {
  const supabase = createAdminClient();
  const [regionsRes, citiesRes, rowCounts] = await Promise.all([
    supabase
      .from("regions")
      .select("id, display_name, province, city, country, active")
      .eq("active", true)
      .returns<
        {
          id: string;
          display_name: string;
          province: string | null;
          city: string | null;
          country: string | null;
          active: boolean;
        }[]
      >(),
    supabase
      .from("cities")
      .select("id, name, region_id")
      .returns<{ id: string; name: string; region_id: string }[]>(),
    countCityRows(supabase),
  ]);

  const regions = regionsRes.data ?? [];
  const cities = citiesRes.data ?? [];
  const regionById = new Map(regions.map((r) => [r.id, r] as const));

  /** Index each region's identifying needles for tail-matching. */
  const regionNeedles: { regionId: string; needle: string }[] = [];
  for (const r of regions) {
    for (const v of [r.province, r.city, r.display_name]) {
      const n = norm(v ?? "");
      // Skip placeholder values like "." and METRO MANILA's own
      // "MANILA" entry (province=MANILA matches Manila cities; we
      // don't want to push Manila cities back into Manila).
      if (!n || n.length < 3) continue;
      regionNeedles.push({ regionId: r.id, needle: n });
    }
  }

  const suspects: CityRegionSuspect[] = [];

  for (const c of cities) {
    const current = regionById.get(c.region_id);
    if (!current) continue; // dangling current region — not our problem here

    // Strategy A — tail of the city name (post-comma).
    const tail = cityTail(c.name);
    if (tail) {
      const tailNorm = norm(tail);
      // Find every region whose needle equals or contains this tail
      // (or vice versa). Equality wins on confidence.
      const exactMatches = regionNeedles.filter(
        (n) => n.needle === tailNorm,
      );
      const partialMatches = regionNeedles.filter(
        (n) =>
          n.needle !== tailNorm &&
          (n.needle.includes(tailNorm) || tailNorm.includes(n.needle)),
      );
      const best = exactMatches[0] ?? partialMatches[0];
      if (best && best.regionId !== c.region_id) {
        const proposed = regionById.get(best.regionId);
        if (proposed) {
          suspects.push({
            cityId: c.id,
            cityName: c.name,
            currentRegionId: c.region_id,
            currentRegionName: current.display_name,
            proposedRegionId: best.regionId,
            proposedRegionName: proposed.display_name,
            reason: exactMatches.length
              ? `City name tail "${tail}" exactly matches region's province/display.`
              : `City name tail "${tail}" partially matches region's province/display.`,
            confidence: exactMatches.length ? "high" : "medium",
            rowCount: rowCounts.get(c.id) ?? 0,
          });
          continue; // one proposal per city
        }
      }
    }

    // Strategy B — the city name (no tail) matches another region's
    // city/display_name directly. Lower confidence because a bare
    // place name is more ambiguous than a province-tail.
    const nameNorm = norm(c.name);
    if (!tail && nameNorm.length >= 4) {
      const direct = regionNeedles.find(
        (n) =>
          n.regionId !== c.region_id &&
          (n.needle === nameNorm ||
            n.needle.includes(nameNorm) ||
            nameNorm.includes(n.needle)),
      );
      if (direct) {
        const proposed = regionById.get(direct.regionId);
        if (proposed) {
          suspects.push({
            cityId: c.id,
            cityName: c.name,
            currentRegionId: c.region_id,
            currentRegionName: current.display_name,
            proposedRegionId: direct.regionId,
            proposedRegionName: proposed.display_name,
            reason: `City name "${c.name}" matches region's province/display.`,
            confidence: "medium",
            rowCount: rowCounts.get(c.id) ?? 0,
          });
        }
      }
    }
  }

  // High-confidence first, then by row count desc (highest leverage).
  suspects.sort((a, b) => {
    if (a.confidence !== b.confidence) {
      return a.confidence === "high" ? -1 : 1;
    }
    return b.rowCount - a.rowCount;
  });
  return suspects;
}

/** Reassign one city to a new region AND cascade the same region_id
 *  down to every row pointing at that city via city_id. Returns
 *  per-table counts so the admin can confirm what moved. Idempotent
 *  if re-run with the same target.
 *
 *  No DB transaction wrapper — each UPDATE is its own request through
 *  PostgREST. A partial failure leaves the data half-migrated; the
 *  admin can re-run the same action to converge (the WHERE filters
 *  are by city_id, so subsequent calls touch the same set).
 */
export async function applyCityRegionReassignment(
  cityId: string,
  newRegionId: string,
): Promise<{
  cityUpdated: boolean;
  stays: number;
  restaurants: number;
  experiences: number;
  traveler_utilities: number;
}> {
  const supabase = createAdminClient();
  const sb = loose(supabase);

  // Sanity-check both ids exist before any write.
  const { data: city } = await sb
    .from("cities")
    .select("id, region_id")
    .eq("id", cityId)
    .maybeSingle<{ id: string; region_id: string }>();
  if (!city) throw new Error(`City ${cityId} not found.`);
  const { data: region } = await sb
    .from("regions")
    .select("id, active")
    .eq("id", newRegionId)
    .maybeSingle<{ id: string; active: boolean }>();
  if (!region) throw new Error(`Region ${newRegionId} not found.`);

  const result = {
    cityUpdated: false,
    stays: 0,
    restaurants: 0,
    experiences: 0,
    traveler_utilities: 0,
  };

  // Cascade the new region_id down first (so rows are never pointing
  // at a city whose region_id has just changed but theirs hasn't).
  for (const table of [
    "stays",
    "restaurants",
    "experiences",
    "traveler_utilities",
  ] as const) {
    const { error, count } = await sb
      .from(table)
      .update({ region_id: newRegionId })
      .eq("city_id", cityId);
    if (error) throw new Error(`${table} cascade: ${error.message}`);
    result[table] = count ?? 0;
  }

  // Then update the city row itself.
  const { error: cityErr } = await sb
    .from("cities")
    .update({ region_id: newRegionId })
    .eq("id", cityId);
  if (cityErr) throw new Error(`cities update: ${cityErr.message}`);
  result.cityUpdated = true;
  return result;
}

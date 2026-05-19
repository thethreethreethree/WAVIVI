import "server-only";

import { CATEGORY_BY_ID, type CategoryId } from "@/lib/toolbox/categories";
import type { CsvRow } from "@/lib/toolbox/csv-import";
import { googleMapsUrl } from "@/lib/toolbox/normalize";
import { createAdminClient } from "@/lib/supabase/admin";
import type { UtilityInsert, UtilityRow, UtilityUpdate } from "@/types/supabase";

/**
 * CSV import engine.
 *
 * Matches uploaded CSV rows against the utilities already in a region+category
 * by location proximity. A match → update rating, reviews and location.
 * No match → insert a new utility. Greedy nearest-match, each existing pin
 * claimed at most once, so it's safe to re-upload the same CSV.
 */

/** Existing pins within this distance (m) of a CSV row count as the same place. */
const MATCH_RADIUS_M = 60;

export interface ImportResult {
  added: number;
  updated: number;
  skipped: number;
}

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

/** Snap a 0–5 rating to the nearest half (for the backpack display). */
const snapHalf = (n: number) => Math.round(n * 2) / 2;

export async function importCsvRows(
  regionId: string,
  category: CategoryId,
  rows: CsvRow[],
): Promise<ImportResult> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("traveler_utilities")
    .select("*")
    .eq("region_id", regionId)
    .eq("category", category);

  const pool = (existing ?? []) as UtilityRow[];
  const claimed = new Set<string>();
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    // Nearest unclaimed existing pin.
    let best: UtilityRow | null = null;
    let bestDist = Infinity;
    for (const u of pool) {
      if (claimed.has(u.id)) continue;
      const d = distanceM(row.latitude, row.longitude, u.latitude, u.longitude);
      if (d < bestDist) {
        bestDist = d;
        best = u;
      }
    }

    const mapsUrl = googleMapsUrl(row.latitude, row.longitude);

    if (best && bestDist <= MATCH_RADIUS_M) {
      // --- Update an existing pin -------------------------------------------
      claimed.add(best.id);
      const update: UtilityUpdate = {
        rating: row.rating,
        review_count: row.reviewCount,
        latitude: row.latitude,
        longitude: row.longitude,
        google_maps_url: mapsUrl,
      };
      if (row.website && !best.website) update.website = row.website;
      if (row.address && !best.address) update.address = row.address;
      // Refresh the backpack rating from the Google rating — unless an admin
      // has hand-edited this pin.
      if (row.rating != null && !best.admin_edited) {
        update.backpack_rating = snapHalf(row.rating);
        update.reliability_score = Math.min(10, row.rating * 2);
      }

      const { error } = await supabase
        .from("traveler_utilities")
        .update(update)
        .eq("id", best.id);
      if (error) skipped++;
      else updated++;
    } else {
      // --- Insert a new pin -------------------------------------------------
      const insert: UtilityInsert = {
        region_id: regionId,
        category,
        name: row.name,
        latitude: row.latitude,
        longitude: row.longitude,
        google_maps_url: mapsUrl,
        address: row.address,
        website: row.website,
        rating: row.rating,
        review_count: row.reviewCount,
        reliability_score: row.rating != null ? Math.min(10, row.rating * 2) : 0,
        backpack_rating: row.rating != null ? snapHalf(row.rating) : 0,
        description: CATEGORY_BY_ID[category].blurb,
        source: "csv",
        source_ref: row.placeRef,
        metadata_json: { imported_from: "csv" },
      };

      const { error } = await supabase
        .from("traveler_utilities")
        .upsert(insert, { onConflict: "source,source_ref" });
      if (error) skipped++;
      else added++;
    }
  }

  return { added, updated, skipped };
}

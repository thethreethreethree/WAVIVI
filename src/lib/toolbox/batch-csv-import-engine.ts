import "server-only";

import type { BatchUtilityRow } from "@/lib/toolbox/batch-csv-import";
import { googleMapsUrl } from "@/lib/toolbox/normalize";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  UtilityCategory,
  UtilityInsert,
  UtilityRow,
  UtilityUpdate,
} from "@/types/supabase";

/**
 * Batch utility CSV import engine.
 *
 * Same shape as `importCsvRows` in src/lib/toolbox/csv-import-engine.ts
 * but per-row classified (each `BatchUtilityRow` carries its own
 * `category` from the Industry column) and city-aware (each row has a
 * `city` string that the caller's `cityResolver` maps to a `city_id`).
 *
 * Matching: a CSV row is paired with an existing utility row when
 *  - it sits in the same (region, category) bucket, AND
 *  - it's within 60 m of an unclaimed existing row.
 * Match → update. No match → insert. Each existing row is claimed at
 * most once so re-uploading the same CSV is safe and idempotent.
 */

/** Existing pins within this distance (m) of a CSV row count as the same place. */
const MATCH_RADIUS_M = 60;

export interface BatchImportResult {
  added: number;
  updated: number;
  skipped: number;
  /** Per-category counts of utility rows landed (added + updated). */
  perCategory: Record<string, number>;
}

/** Caller-supplied resolver — given a City cell string, return the
 *  cities.id UUID or null. Built by the server action that calls this
 *  engine; same shape the place importer uses. */
export type CityResolver = (cityName: string | null) => string | null;

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

const snapHalf = (n: number) => Math.round(n * 2) / 2;

export async function importBatchUtilityRows(
  regionId: string,
  rows: BatchUtilityRow[],
  cityResolver: CityResolver = () => null,
): Promise<BatchImportResult> {
  const supabase = createAdminClient();

  // Group input rows by category so we can fetch existing pins per
  // bucket in one query each (much cheaper than one per row).
  const byCategory = new Map<string, BatchUtilityRow[]>();
  for (const row of rows) {
    const arr = byCategory.get(row.category) ?? [];
    arr.push(row);
    byCategory.set(row.category, arr);
  }

  let added = 0;
  let updated = 0;
  let skipped = 0;
  const perCategory: Record<string, number> = {};

  for (const [category, bucketRows] of byCategory) {
    const { data: existing } = await supabase
      .from("traveler_utilities")
      .select("*")
      .eq("region_id", regionId)
      .eq("category", category as UtilityCategory);
    const pool = (existing ?? []) as UtilityRow[];
    const claimed = new Set<string>();

    for (const row of bucketRows) {
      // Resolve the row's city. Null city_id falls back to region-only
      // scope; the public surfaces handle that the same way the
      // place tables do.
      const resolvedCityId = cityResolver(row.city);

      // Greedy nearest-neighbour, among unclaimed existing pins.
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
        // --- Update an existing pin ---------------------------------------
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
        if (row.phone && !best.phone) update.phone = row.phone;
        if (row.photoUrl) update.photo_url = row.photoUrl;
        if (resolvedCityId && !best.city_id) update.city_id = resolvedCityId;
        if (row.rating != null && !best.admin_edited) {
          update.backpack_rating = snapHalf(row.rating);
          update.reliability_score = Math.min(10, row.rating * 2);
        }

        const { error } = await supabase
          .from("traveler_utilities")
          .update(update)
          .eq("id", best.id);
        if (error) skipped++;
        else {
          updated++;
          perCategory[category] = (perCategory[category] ?? 0) + 1;
        }
      } else {
        // --- Insert a new pin ----------------------------------------------
        const insert: UtilityInsert = {
          region_id: regionId,
          city_id: resolvedCityId,
          category: category as UtilityCategory,
          name: row.name,
          latitude: row.latitude,
          longitude: row.longitude,
          google_maps_url: mapsUrl,
          address: row.address,
          website: row.website,
          phone: row.phone,
          photo_url: row.photoUrl,
          rating: row.rating,
          review_count: row.reviewCount,
          reliability_score:
            row.rating != null ? Math.min(10, row.rating * 2) : 0,
          backpack_rating:
            row.rating != null ? snapHalf(row.rating) : 0,
          description: row.pitch ?? "",
          source: "csv",
          source_ref: row.placeRef,
          metadata_json: { imported_from: "csv-batch" },
        };

        const { error } = await supabase
          .from("traveler_utilities")
          .upsert(insert, { onConflict: "source,source_ref" });
        if (error) skipped++;
        else {
          added++;
          perCategory[category] = (perCategory[category] ?? 0) + 1;
        }
      }
    }
  }

  return { added, updated, skipped, perCategory };
}

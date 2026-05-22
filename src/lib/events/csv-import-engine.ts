import "server-only";

import type { EventCsvRow } from "@/lib/events/csv-import";
import { googleMapsUrl } from "@/lib/toolbox/normalize";
import { createAdminClient } from "@/lib/supabase/admin";
import type { EventInsert, EventRow, EventUpdate } from "@/types/supabase";

/** Events CSV import — same matcher as experiences (ref-first, location
 *  fallback that won't merge distinct google places). */

const MATCH_RADIUS_M = 60;

export interface EventImportResult {
  added: number;
  updated: number;
  skipped: number;
}

function distanceM(aLat: number, aLng: number, bLat: number, bLng: number) {
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

export async function importEventsCsv(
  regionId: string,
  defaultCategory: string,
  rows: EventCsvRow[],
): Promise<EventImportResult> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("events")
    .select("*")
    .eq("region_id", regionId);

  const pool = (existing ?? []) as EventRow[];
  const byRef = new Map<string, EventRow>();
  for (const e of pool) {
    if (e.source_ref?.startsWith("google:")) byRef.set(e.source_ref, e);
  }
  const claimed = new Set<string>();
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const resolvedCategory = (row.category?.trim() || defaultCategory).trim();

    let best: EventRow | null = null;
    const refMatch = row.placeRef.startsWith("google:")
      ? byRef.get(row.placeRef)
      : undefined;
    if (refMatch && !claimed.has(refMatch.id)) {
      best = refMatch;
    } else {
      const rowHasRef = row.placeRef.startsWith("google:");
      let bestDist = Infinity;
      for (const e of pool) {
        if (claimed.has(e.id)) continue;
        if (
          rowHasRef &&
          e.source_ref?.startsWith("google:") &&
          e.source_ref !== row.placeRef
        ) {
          continue;
        }
        const d = distanceM(row.latitude, row.longitude, e.latitude, e.longitude);
        if (d < bestDist) {
          bestDist = d;
          best = e;
        }
      }
      if (!best || bestDist > MATCH_RADIUS_M) best = null;
    }

    const mapsUrl = googleMapsUrl(row.latitude, row.longitude);

    if (best) {
      claimed.add(best.id);
      const fresh = !best.admin_edited;
      const update: EventUpdate = {
        rating: row.rating,
        review_count: row.reviewCount,
        latitude: row.latitude,
        longitude: row.longitude,
        google_maps_url: mapsUrl,
      };
      if (row.category && row.category.trim())
        update.category = row.category.trim();
      if (row.dayBucket) update.day_bucket = row.dayBucket;
      if (row.whenText && (fresh || !best.when_text))
        update.when_text = row.whenText;
      if (row.description && (fresh || !best.description))
        update.description = row.description;
      if (row.website && (fresh || !best.website)) update.website = row.website;
      if (row.address && (fresh || !best.address)) update.address = row.address;
      if (row.phone && (fresh || !best.phone)) update.phone = row.phone;
      if (row.whatsapp && (fresh || !best.whatsapp))
        update.whatsapp = row.whatsapp;
      if (row.instagram && (fresh || !best.instagram))
        update.instagram = row.instagram;
      if (row.facebook && (fresh || !best.facebook))
        update.facebook = row.facebook;
      if (row.email && (fresh || !best.email)) update.email = row.email;
      if (row.photoUrl) update.photo_url = row.photoUrl;
      if (row.amenities.length > 0) update.amenities = row.amenities;
      if (row.rating != null && fresh) {
        update.backpack_rating = snapHalf(row.rating);
        update.reliability_score = Math.min(10, row.rating * 2);
      }

      const { error } = await supabase
        .from("events")
        .update(update)
        .eq("id", best.id);
      if (error) skipped++;
      else updated++;
    } else {
      const insert: EventInsert = {
        region_id: regionId,
        category: resolvedCategory,
        day_bucket: row.dayBucket,
        when_text: row.whenText,
        name: row.name,
        description: row.description,
        latitude: row.latitude,
        longitude: row.longitude,
        google_maps_url: mapsUrl,
        address: row.address,
        website: row.website,
        phone: row.phone,
        whatsapp: row.whatsapp,
        instagram: row.instagram,
        facebook: row.facebook,
        email: row.email,
        photo_url: row.photoUrl,
        amenities: row.amenities,
        rating: row.rating,
        review_count: row.reviewCount,
        reliability_score: row.rating != null ? Math.min(10, row.rating * 2) : 0,
        backpack_rating: row.rating != null ? snapHalf(row.rating) : 0,
        source: "csv",
        source_ref: row.placeRef,
        metadata_json: { imported_from: "csv" },
      };

      const { error } = await supabase
        .from("events")
        .upsert(insert, { onConflict: "source,source_ref" });
      if (error) skipped++;
      else added++;
    }
  }

  return { added, updated, skipped };
}

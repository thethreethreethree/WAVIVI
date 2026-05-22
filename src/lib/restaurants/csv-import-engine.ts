import "server-only";

import type { RestaurantCsvRow } from "@/lib/restaurants/csv-import";
import { googleMapsUrl } from "@/lib/toolbox/normalize";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  RestaurantInsert,
  RestaurantRow,
  RestaurantUpdate,
} from "@/types/supabase";

const MATCH_RADIUS_M = 60;

export interface RestaurantImportResult {
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

export async function importRestaurantsCsv(
  regionId: string,
  defaultCuisine: string,
  rows: RestaurantCsvRow[],
): Promise<RestaurantImportResult> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("restaurants")
    .select("*")
    .eq("region_id", regionId);

  const pool = (existing ?? []) as RestaurantRow[];
  const byRef = new Map<string, RestaurantRow>();
  for (const r of pool) {
    if (r.source_ref?.startsWith("google:")) byRef.set(r.source_ref, r);
  }
  const claimed = new Set<string>();
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const resolvedCuisine = (row.cuisine?.trim() || defaultCuisine).trim();

    let best: RestaurantRow | null = null;
    const refMatch = row.placeRef.startsWith("google:")
      ? byRef.get(row.placeRef)
      : undefined;
    if (refMatch && !claimed.has(refMatch.id)) {
      best = refMatch;
    } else {
      const rowHasRef = row.placeRef.startsWith("google:");
      let bestDist = Infinity;
      for (const r of pool) {
        if (claimed.has(r.id)) continue;
        if (
          rowHasRef &&
          r.source_ref?.startsWith("google:") &&
          r.source_ref !== row.placeRef
        ) {
          continue;
        }
        const d = distanceM(row.latitude, row.longitude, r.latitude, r.longitude);
        if (d < bestDist) {
          bestDist = d;
          best = r;
        }
      }
      if (!best || bestDist > MATCH_RADIUS_M) best = null;
    }

    const mapsUrl = googleMapsUrl(row.latitude, row.longitude);

    if (best) {
      claimed.add(best.id);
      const fresh = !best.admin_edited;
      const update: RestaurantUpdate = {
        rating: row.rating,
        review_count: row.reviewCount,
        latitude: row.latitude,
        longitude: row.longitude,
        google_maps_url: mapsUrl,
      };
      if (row.cuisine && row.cuisine.trim()) update.cuisine = row.cuisine.trim();
      if (row.priceRange && (fresh || !best.price_range))
        update.price_range = row.priceRange;
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
        .from("restaurants")
        .update(update)
        .eq("id", best.id);
      if (error) skipped++;
      else updated++;
    } else {
      const insert: RestaurantInsert = {
        region_id: regionId,
        cuisine: resolvedCuisine,
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
        price_range: row.priceRange,
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
        .from("restaurants")
        .upsert(insert, { onConflict: "source,source_ref" });
      if (error) skipped++;
      else added++;
    }
  }

  return { added, updated, skipped };
}

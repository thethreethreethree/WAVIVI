import "server-only";

import type { StayCsvRow } from "@/lib/stays/csv-import";
import { googleMapsUrl } from "@/lib/toolbox/normalize";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  StayInsert,
  StayRow,
  StayType,
  StayUpdate,
} from "@/types/supabase";

/**
 * Stays CSV import engine — same matching pattern as toolbox utilities.
 *
 * Existing stays within `MATCH_RADIUS_M` of an inbound CSV row count as
 * the same place (greedy nearest-match, each existing pin claimed at
 * most once). Match → update; no match → insert. Safe to re-upload.
 *
 * `defaultStayType` decides what a row becomes when the CSV's Industry
 * column is blank — admins typically import one type at a time
 * ("hostels CSV", "hotels CSV"), so the upload page lets them pick.
 */

const MATCH_RADIUS_M = 60;

export interface StayImportResult {
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

export async function importStaysCsv(
  regionId: string,
  defaultStayType: StayType,
  rows: StayCsvRow[],
): Promise<StayImportResult> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("stays")
    .select("*")
    .eq("region_id", regionId);

  const pool = (existing ?? []) as StayRow[];
  const claimed = new Set<string>();
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const resolvedType: StayType = row.stayType ?? defaultStayType;

    // Nearest unclaimed existing stay.
    let best: StayRow | null = null;
    let bestDist = Infinity;
    for (const s of pool) {
      if (claimed.has(s.id)) continue;
      const d = distanceM(row.latitude, row.longitude, s.latitude, s.longitude);
      if (d < bestDist) {
        bestDist = d;
        best = s;
      }
    }

    const mapsUrl = googleMapsUrl(row.latitude, row.longitude);

    if (best && bestDist <= MATCH_RADIUS_M) {
      // --- Update an existing stay -----------------------------------------
      claimed.add(best.id);
      const update: StayUpdate = {
        rating: row.rating,
        review_count: row.reviewCount,
        latitude: row.latitude,
        longitude: row.longitude,
        google_maps_url: mapsUrl,
      };
      if (row.website && !best.website) update.website = row.website;
      if (row.address && !best.address) update.address = row.address;
      if (row.phone && !best.phone) update.phone = row.phone;
      if (row.whatsapp && !best.whatsapp) update.whatsapp = row.whatsapp;
      if (row.instagram && !best.instagram) update.instagram = row.instagram;
      if (row.facebook && !best.facebook) update.facebook = row.facebook;
      if (row.email && !best.email) update.email = row.email;
      // CSV photos always win — admins are usually re-uploading with art.
      if (row.photoUrl) update.photo_url = row.photoUrl;
      // CSV amenities replace the stored list when present — Google's
      // amenity scrape is the source of truth, and admin edits to
      // amenities flow through the partner dashboard, not re-import.
      if (row.amenities.length > 0) update.amenities = row.amenities;
      // Re-snap backpack rating from Google rating — unless an admin
      // already hand-edited this stay.
      if (row.rating != null && !best.admin_edited) {
        update.backpack_rating = snapHalf(row.rating);
        update.reliability_score = Math.min(10, row.rating * 2);
      }

      const { error } = await supabase
        .from("stays")
        .update(update)
        .eq("id", best.id);
      if (error) skipped++;
      else updated++;
    } else {
      // --- Insert a new stay ------------------------------------------------
      const insert: StayInsert = {
        region_id: regionId,
        stay_type: resolvedType,
        name: row.name,
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
        .from("stays")
        .upsert(insert, { onConflict: "source,source_ref" });
      if (error) skipped++;
      else added++;
    }
  }

  return { added, updated, skipped };
}

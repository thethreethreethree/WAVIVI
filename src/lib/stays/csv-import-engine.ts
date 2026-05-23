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
  // Stable-identity index: the Google place ref (google:ChIJ…) is the same
  // across every export of a place, so it's the reliable re-import key.
  // Location is only a fallback for rows that have no usable ref.
  const byRef = new Map<string, StayRow>();
  for (const s of pool) {
    if (s.source_ref?.startsWith("google:")) byRef.set(s.source_ref, s);
  }
  const claimed = new Set<string>();
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const resolvedType: StayType = row.stayType ?? defaultStayType;

    // 1) Match by stable Google place ref first.
    let best: StayRow | null = null;
    const refMatch = row.placeRef.startsWith("google:")
      ? byRef.get(row.placeRef)
      : undefined;
    if (refMatch && !claimed.has(refMatch.id)) {
      best = refMatch;
    } else {
      // 2) Fall back to nearest unclaimed existing stay within radius.
      const rowHasRef = row.placeRef.startsWith("google:");
      let bestDist = Infinity;
      for (const s of pool) {
        if (claimed.has(s.id)) continue;
        // Never let proximity merge two DISTINCT known Google places —
        // if both carry a google ref and they differ, they're separate.
        if (
          rowHasRef &&
          s.source_ref?.startsWith("google:") &&
          s.source_ref !== row.placeRef
        ) {
          continue;
        }
        const d = distanceM(
          row.latitude,
          row.longitude,
          s.latitude,
          s.longitude,
        );
        if (d < bestDist) {
          bestDist = d;
          best = s;
        }
      }
      if (!best || bestDist > MATCH_RADIUS_M) best = null;
    }

    const mapsUrl = googleMapsUrl(row.latitude, row.longitude);

    if (best) {
      // --- Update an existing stay -----------------------------------------
      claimed.add(best.id);
      // Google data is the source of truth on re-import — refresh it,
      // EXCEPT on rows an admin/partner has hand-curated (admin_edited),
      // where we only fill blanks so we never clobber their edits.
      const fresh = !best.admin_edited;
      const update: StayUpdate = {
        rating: row.rating,
        review_count: row.reviewCount,
        latitude: row.latitude,
        longitude: row.longitude,
        google_maps_url: mapsUrl,
      };
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
      // CSV photos always win — admins are usually re-uploading with art.
      if (row.photoUrl) update.photo_url = row.photoUrl;
      // Replace the IG gallery whenever the CSV supplies one; it's the only
      // source of truth for the swipeable hero photos.
      if (row.photoUrls.length > 0) update.photo_urls = row.photoUrls;
      // CSV amenities replace the stored list when present.
      if (row.amenities.length > 0) update.amenities = row.amenities;
      // Re-snap backpack rating from Google rating — unless hand-edited.
      if (row.rating != null && fresh) {
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
        photo_urls: row.photoUrls,
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

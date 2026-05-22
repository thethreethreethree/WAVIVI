import "server-only";

import {
  classifyActivityType,
  classifyCategory,
  type ExperienceCsvRow,
} from "@/lib/experiences/csv-import";
import { googleMapsUrl } from "@/lib/toolbox/normalize";
import { createAdminClient } from "@/lib/supabase/admin";
import type {
  ExperienceInsert,
  ExperienceRow,
  ExperienceUpdate,
} from "@/types/supabase";

/**
 * Experiences CSV import engine — same matching pattern as toolbox
 * utilities + stays.
 *
 * Existing experiences within `MATCH_RADIUS_M` of an inbound CSV row
 * count as the same place (greedy nearest-match, each existing pin
 * claimed at most once). Match → update; no match → insert. Safe to
 * re-upload.
 *
 * The default `activityType` argument applies to rows whose Activity
 * Type column is blank (admins usually import one type at a time —
 * "diving CSV", "tours CSV", etc.).
 */

const MATCH_RADIUS_M = 60;

export interface ExperienceImportResult {
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

export async function importExperiencesCsv(
  regionId: string,
  defaultActivityType: string,
  rows: ExperienceCsvRow[],
): Promise<ExperienceImportResult> {
  const supabase = createAdminClient();

  const { data: existing } = await supabase
    .from("experiences")
    .select("*")
    .eq("region_id", regionId);

  const pool = (existing ?? []) as ExperienceRow[];
  const byRef = new Map<string, ExperienceRow>();
  for (const e of pool) {
    if (e.source_ref?.startsWith("google:")) byRef.set(e.source_ref, e);
  }
  const claimed = new Set<string>();
  let added = 0;
  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    // Auto-classify into a canonical activity (CSV cell → name/description
    // keywords → admin fallback). "auto" keeps the row's own label or "other".
    const resolvedType = classifyActivityType(
      row.activityType,
      row.name,
      row.description,
      defaultActivityType,
    );
    const resolvedCategory = classifyCategory(
      resolvedType,
      row.name,
      row.description,
    );

    // 1) Match by stable Google place ref; 2) fall back to nearest pin.
    let best: ExperienceRow | null = null;
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
        const d = distanceM(
          row.latitude,
          row.longitude,
          e.latitude,
          e.longitude,
        );
        if (d < bestDist) {
          bestDist = d;
          best = e;
        }
      }
      if (!best || bestDist > MATCH_RADIUS_M) best = null;
    }

    const mapsUrl = googleMapsUrl(row.latitude, row.longitude);

    if (best) {
      // --- Update an existing experience ----------------------------------
      claimed.add(best.id);
      const fresh = !best.admin_edited;
      const update: ExperienceUpdate = {
        rating: row.rating,
        review_count: row.reviewCount,
        latitude: row.latitude,
        longitude: row.longitude,
        google_maps_url: mapsUrl,
      };
      // Re-classify on re-import (unless an admin hand-curated the row).
      if (fresh) {
        update.activity_type = resolvedType;
        update.category = resolvedCategory;
      } else if (row.activityType && row.activityType.trim()) {
        update.activity_type = row.activityType.trim();
      }
      if (row.dayBucket) update.day_bucket = row.dayBucket;
      if (row.description && (fresh || !best.description)) {
        update.description = row.description;
      }
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
        .from("experiences")
        .update(update)
        .eq("id", best.id);
      if (error) skipped++;
      else updated++;
    } else {
      // --- Insert a new experience -----------------------------------------
      const insert: ExperienceInsert = {
        region_id: regionId,
        category: resolvedCategory,
        activity_type: resolvedType,
        day_bucket: row.dayBucket,
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
        .from("experiences")
        .upsert(insert, { onConflict: "source,source_ref" });
      if (error) skipped++;
      else added++;
    }
  }

  return { added, updated, skipped };
}

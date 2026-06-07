"use server";

import { revalidatePath } from "next/cache";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/toolbox/admin";

import { citySlug } from "../batch-city-import/slug";

/** Shared result envelope for the cities admin server actions. */
export interface CityActionResult {
  ok: boolean;
  error: string | null;
}

async function assertAdmin(): Promise<CityActionResult | null> {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) return { ok: false, error: "Not authorised." };
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Auth check failed: ${msg}` };
  }
}

function revalidateRegion(regionId: string): void {
  try {
    revalidatePath("/admin/cities");
    revalidatePath(`/admin/cities/${regionId}`);
    revalidatePath(`/admin/stays/${regionId}`);
    revalidatePath(`/admin/eat/${regionId}`);
    revalidatePath(`/admin/experiences/${regionId}`);
  } catch (err) {
    console.warn("[cities admin] revalidate failed:", err);
  }
}

/** Rename a city. Re-slugs from the new name so the public URLs (once
 *  shipped) follow the display name. Fails if the new slug collides with
 *  another city in the same region — admins should merge in that case. */
export async function renameCity(
  cityId: string,
  newName: string,
): Promise<CityActionResult> {
  const auth = await assertAdmin();
  if (auth) return auth;
  const trimmed = newName.trim();
  if (!trimmed) return { ok: false, error: "Name can't be blank." };
  const slug = citySlug(trimmed);
  if (!slug) {
    return {
      ok: false,
      error: "Name must contain at least one letter or number.",
    };
  }

  const supabase = createAdminClient();
  const { data: current, error: getErr } = await supabase
    .from("cities")
    .select("id, region_id, slug")
    .eq("id", cityId)
    .single();
  if (getErr || !current) {
    return { ok: false, error: getErr?.message ?? "City not found." };
  }

  // Same-slug rename (just casing/spacing change) is a no-op slug-wise;
  // skip the collision check and only update the display name.
  if (slug !== current.slug) {
    const { data: clash } = await supabase
      .from("cities")
      .select("id")
      .eq("region_id", current.region_id)
      .eq("slug", slug)
      .neq("id", cityId)
      .maybeSingle();
    if (clash) {
      return {
        ok: false,
        error:
          "Another city in this region already uses that slug — merge into it instead.",
      };
    }
  }

  const { error: upErr } = await supabase
    .from("cities")
    .update({ name: trimmed, slug })
    .eq("id", cityId);
  if (upErr) return { ok: false, error: upErr.message };

  revalidateRegion(current.region_id);
  return { ok: true, error: null };
}

/** Move every place row from `sourceId` to `targetId`, then drop the
 *  source city. Both cities must belong to the same region. The
 *  `admin_edited` flag on individual place rows is irrelevant here —
 *  we're not changing their content, just rewriting city_id. */
export async function mergeCities(
  sourceId: string,
  targetId: string,
): Promise<CityActionResult & { moved?: number }> {
  if (sourceId === targetId) {
    return { ok: false, error: "Source and target are the same city." };
  }
  const auth = await assertAdmin();
  if (auth) return auth;

  const supabase = createAdminClient();
  const [{ data: src }, { data: tgt }] = await Promise.all([
    supabase
      .from("cities")
      .select("id, region_id")
      .eq("id", sourceId)
      .single(),
    supabase
      .from("cities")
      .select("id, region_id")
      .eq("id", targetId)
      .single(),
  ]);
  if (!src || !tgt) return { ok: false, error: "City not found." };
  if (src.region_id !== tgt.region_id) {
    return {
      ok: false,
      error: "Cities must be in the same region to merge.",
    };
  }

  let moved = 0;
  for (const table of ["stays", "restaurants", "experiences"] as const) {
    // Count the source-city rows up front, then run the update. PostgREST
    // doesn't return a row count from `.update().select(..., {head:true})`
    // so we measure separately — both queries are tiny and admin-only.
    const { count } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("city_id", sourceId);
    const { error } = await supabase
      .from(table)
      .update({ city_id: targetId })
      .eq("city_id", sourceId);
    if (error) {
      return {
        ok: false,
        error: `Failed to move ${table} rows: ${error.message}`,
      };
    }
    moved += count ?? 0;
  }

  const { error: delErr } = await supabase
    .from("cities")
    .delete()
    .eq("id", sourceId);
  if (delErr) return { ok: false, error: delErr.message };

  revalidateRegion(src.region_id);
  return { ok: true, error: null, moved };
}

/** Delete a city outright. Refuses if any place rows still reference
 *  it — admins should merge first. (The FK is ON DELETE SET NULL so a
 *  raw delete wouldn't error, but silently null-ing 50 rows is the
 *  wrong default — make admins acknowledge it via merge.) */
export async function deleteCity(
  cityId: string,
): Promise<CityActionResult> {
  const auth = await assertAdmin();
  if (auth) return auth;

  const supabase = createAdminClient();
  const { data: city, error: getErr } = await supabase
    .from("cities")
    .select("id, region_id")
    .eq("id", cityId)
    .single();
  if (getErr || !city) return { ok: false, error: "City not found." };

  let inUse = 0;
  for (const table of ["stays", "restaurants", "experiences"] as const) {
    const { count } = await supabase
      .from(table)
      .select("id", { count: "exact", head: true })
      .eq("city_id", cityId);
    inUse += count ?? 0;
  }
  if (inUse > 0) {
    return {
      ok: false,
      error: `City still has ${inUse} place row(s). Merge into another city first.`,
    };
  }

  const { error: delErr } = await supabase
    .from("cities")
    .delete()
    .eq("id", cityId);
  if (delErr) return { ok: false, error: delErr.message };

  revalidateRegion(city.region_id);
  return { ok: true, error: null };
}

/** Set (or clear) a city's centre + radius. The public listings use this
 *  to decide whether a venue inside the region passes the radius filter:
 *  when a city has its own geo, rows pointing at that city are checked
 *  against the city circle; rows without a city_id fall back to the
 *  region circle. Pass `null` for all three to clear the city's geo and
 *  revert to the region-only fallback. */
export async function updateCityGeo(
  cityId: string,
  geo: {
    latitude: number | null;
    longitude: number | null;
    radius_km: number | null;
  },
): Promise<CityActionResult> {
  const auth = await assertAdmin();
  if (auth) return auth;

  const { latitude, longitude, radius_km } = geo;

  // All-or-nothing: a centre without a radius (or vice-versa) is
  // useless to the filter and would silently keep firing the region
  // fallback. Make the admin commit to a complete set or fully clear.
  const allSet =
    latitude != null && longitude != null && radius_km != null;
  const allCleared =
    latitude == null && longitude == null && radius_km == null;
  if (!allSet && !allCleared) {
    return {
      ok: false,
      error: "Set all three (lat, lng, radius) or clear all three.",
    };
  }
  if (allSet) {
    if (Math.abs(latitude) > 90) {
      return { ok: false, error: "Latitude must be between -90 and 90." };
    }
    if (Math.abs(longitude) > 180) {
      return { ok: false, error: "Longitude must be between -180 and 180." };
    }
    if (radius_km <= 0 || radius_km > 200) {
      return { ok: false, error: "Radius must be between 1 and 200 km." };
    }
  }

  const supabase = createAdminClient();
  const { data: current, error: getErr } = await supabase
    .from("cities")
    .select("id, region_id")
    .eq("id", cityId)
    .single();
  if (getErr || !current) {
    return { ok: false, error: getErr?.message ?? "City not found." };
  }

  const { error } = await supabase
    .from("cities")
    .update({ latitude, longitude, radius_km })
    .eq("id", cityId);
  if (error) return { ok: false, error: error.message };

  revalidateRegion(current.region_id);
  return { ok: true, error: null };
}

/** Compute a centre from the centroid of a city's existing places. Lets
 *  admins click "Auto-centre" instead of typing coordinates. Returns null
 *  when the city has no placed venues yet (no centroid to derive). */
export async function suggestCityCentroid(
  cityId: string,
): Promise<{
  ok: boolean;
  error: string | null;
  latitude: number | null;
  longitude: number | null;
  sampleCount: number;
}> {
  const auth = await assertAdmin();
  if (auth) {
    return { ok: false, error: auth.error, latitude: null, longitude: null, sampleCount: 0 };
  }

  const supabase = createAdminClient();
  let totalLat = 0;
  let totalLng = 0;
  let count = 0;
  for (const table of ["stays", "restaurants", "experiences"] as const) {
    const { data } = await supabase
      .from(table)
      .select("latitude, longitude")
      .eq("city_id", cityId)
      .not("latitude", "is", null)
      .not("longitude", "is", null);
    for (const row of data ?? []) {
      totalLat += row.latitude as number;
      totalLng += row.longitude as number;
      count++;
    }
  }
  if (count === 0) {
    return {
      ok: true,
      error: null,
      latitude: null,
      longitude: null,
      sampleCount: 0,
    };
  }
  return {
    ok: true,
    error: null,
    latitude: Number((totalLat / count).toFixed(6)),
    longitude: Number((totalLng / count).toFixed(6)),
    sampleCount: count,
  };
}

/** Create a city by hand — useful when admins want a town that the CSV
 *  scraper hasn't covered yet, so they can hand-assign places to it. */
export async function createCity(
  regionId: string,
  name: string,
): Promise<CityActionResult & { id?: string }> {
  const auth = await assertAdmin();
  if (auth) return auth;
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Name can't be blank." };
  const slug = citySlug(trimmed);
  if (!slug) {
    return {
      ok: false,
      error: "Name must contain at least one letter or number.",
    };
  }

  const supabase = createAdminClient();
  const { data: clash } = await supabase
    .from("cities")
    .select("id")
    .eq("region_id", regionId)
    .eq("slug", slug)
    .maybeSingle();
  if (clash) {
    return {
      ok: false,
      error: "That city already exists in this region.",
    };
  }

  const { data, error } = await supabase
    .from("cities")
    .insert({ region_id: regionId, slug, name: trimmed })
    .select("id")
    .single();
  if (error || !data) {
    return { ok: false, error: error?.message ?? "Insert failed." };
  }

  revalidateRegion(regionId);
  return { ok: true, error: null, id: data.id };
}

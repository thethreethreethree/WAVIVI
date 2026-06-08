import { type NextRequest, NextResponse } from "next/server";

import { getCurrentCityIds } from "@/lib/cities/current";
import { isCategoryId } from "@/lib/toolbox/categories";
import { createClient } from "@/lib/supabase/server";
import { haversineKm } from "@/lib/utils/geo";

/**
 * GET /api/utilities
 *
 * Returns toolbox utility pins for the Leaflet map.
 *
 * Scoping order (city beats region):
 *  1) When the request pins one or more cities (repeated `?city=` param,
 *     OR the `wv-cities` cookie), the result is clamped to within each
 *     pinned city's circle. A row matches if EITHER its `city_id` is in
 *     the pinned set (the FK path used by CSV-imported rows) OR it sits
 *     within that city's `radius_km` of the city centre (the haversine
 *     fallback for OSM-scanned rows whose `city_id` is null). This is
 *     "city priority search" — the region is still required to anchor
 *     the row set, but the per-city circle is what actually filters.
 *  2) When no cities are pinned, the result is filtered by `region_id`
 *     and the old region-wide behaviour kicks in.
 *
 * Other query params (all optional):
 *   category  one of the active category ids, or "all"
 *   region    a region id — required when no global region cookie is set
 *   bbox      "minLng,minLat,maxLng,maxLat" viewport filter
 *   limit     max rows (default 2000, capped at 5000)
 */
export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const supabase = await createClient();

  let query = supabase.from("traveler_utilities").select("*");

  const category = sp.get("category");
  if (category && category !== "all") {
    if (!isCategoryId(category)) {
      return NextResponse.json(
        { error: `Unknown category: ${category}` },
        { status: 400 },
      );
    }
    query = query.eq("category", category);
  }

  const region = sp.get("region");
  if (region) query = query.eq("region_id", region);

  // City scoping — repeated ?city= wins over the cookie so the admin
  // tools can override. Falls back to the global wv-cities cookie set
  // by the region picker.
  const cityIdsParam = sp.getAll("city").filter(Boolean);
  const cityIds =
    cityIdsParam.length > 0 ? cityIdsParam : await getCurrentCityIds();

  const bbox = sp.get("bbox");
  if (bbox) {
    const parts = bbox.split(",").map(Number);
    if (parts.length === 4 && parts.every(Number.isFinite)) {
      const [minLng, minLat, maxLng, maxLat] = parts;
      query = query
        .gte("latitude", minLat)
        .lte("latitude", maxLat)
        .gte("longitude", minLng)
        .lte("longitude", maxLng);
    }
  }

  const limit = Math.min(Number(sp.get("limit")) || 2000, 5000);
  query = query
    .order("rank_score", { ascending: false, nullsFirst: false })
    .limit(limit);

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  let utilities = data ?? [];

  // City-priority post-filter. Done in app code because the FK-vs-
  // haversine union is awkward to express in PostgREST and the row
  // count here is already bounded by `limit`.
  if (cityIds.length > 0) {
    const { data: cityRows } = await supabase
      .from("cities")
      .select("id, latitude, longitude, radius_km")
      .in("id", cityIds);
    const cityById = new Map<
      string,
      { lat: number | null; lng: number | null; radiusKm: number | null }
    >();
    const haversineTargets: {
      lat: number;
      lng: number;
      radiusKm: number;
    }[] = [];
    for (const c of cityRows ?? []) {
      cityById.set(c.id, {
        lat: c.latitude,
        lng: c.longitude,
        radiusKm: c.radius_km,
      });
      if (c.latitude != null && c.longitude != null && c.radius_km && c.radius_km > 0) {
        haversineTargets.push({
          lat: c.latitude,
          lng: c.longitude,
          radiusKm: c.radius_km,
        });
      }
    }
    const pinned = new Set(cityIds);
    utilities = utilities.filter((u) => {
      if (u.city_id && pinned.has(u.city_id)) return true;
      // Haversine fallback for rows the scan dropped in before city_id
      // tagging was a thing.
      for (const t of haversineTargets) {
        if (
          haversineKm(
            { lat: t.lat, lng: t.lng },
            { lat: u.latitude, lng: u.longitude },
          ) <= t.radiusKm
        ) {
          return true;
        }
      }
      return false;
    });
  }

  return NextResponse.json(
    { utilities, count: utilities.length },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } },
  );
}

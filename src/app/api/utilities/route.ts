import { type NextRequest, NextResponse } from "next/server";

import { isCategoryId } from "@/lib/toolbox/categories";
import { createClient } from "@/lib/supabase/server";
import { haversineKm } from "@/lib/utils/geo";

/**
 * GET /api/utilities
 *
 * Returns toolbox utility pins for the Leaflet map.
 * Query params (all optional):
 *   category  one of the 12 category ids, or "all"
 *   region    a region id
 *   city      a city id; may repeat (?city=ID1&city=ID2). When present,
 *             results are post-filtered to utilities sitting inside the
 *             union of those cities' centre+radius circles (using the
 *             city geo set on /admin/cities). Cities without geo are
 *             skipped silently. `region` keeps acting as the SQL-level
 *             scope so the union still respects the picked region.
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

  // City-scope post-filter. Cheap: utilities are capped at 5000 and the
  // geo lookup is one Supabase call. Done in app code rather than SQL
  // because PostGIS isn't a dependency we want for one filter shape.
  const cityIds = sp.getAll("city").filter(Boolean);
  if (cityIds.length > 0) {
    const { data: cityRows } = await supabase
      .from("cities")
      .select("id, latitude, longitude, radius_km")
      .in("id", cityIds)
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .not("radius_km", "is", null);
    const circles = (cityRows ?? [])
      .filter((c) => c.latitude != null && c.longitude != null && c.radius_km)
      .map((c) => ({
        lat: c.latitude as number,
        lng: c.longitude as number,
        radiusKm: c.radius_km as number,
      }));
    // No usable city geo → fall through to whatever the region filter
    // returned. Better than emptying the map for an admin who hasn't
    // set city radii yet.
    if (circles.length > 0) {
      utilities = utilities.filter((u) =>
        circles.some(
          (c) =>
            haversineKm(
              { lat: c.lat, lng: c.lng },
              { lat: u.latitude, lng: u.longitude },
            ) <= c.radiusKm,
        ),
      );
    }
  }

  return NextResponse.json(
    { utilities, count: utilities.length },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } },
  );
}

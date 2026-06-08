import { type NextRequest, NextResponse } from "next/server";

import { isCategoryId } from "@/lib/toolbox/categories";
import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/utilities
 *
 * Returns toolbox utility pins for the Leaflet map.
 * Query params (all optional):
 *   category  one of the 12 category ids, or "all"
 *   region    a region id
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

  return NextResponse.json(
    { utilities: data ?? [], count: data?.length ?? 0 },
    { headers: { "Cache-Control": "public, max-age=60, s-maxage=300" } },
  );
}

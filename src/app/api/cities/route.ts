import { NextResponse, type NextRequest } from "next/server";

import { createClient } from "@/lib/supabase/server";
import type { CurrentCity } from "@/lib/cities/current";

/**
 * GET /api/cities?regionId=<slug>
 *
 * Returns the cities under one region, alphabetised. Backs the
 * RegionPicker's on-expand lazy-load: the top bar ships cities for the
 * CURRENT region only on first paint, then this route serves additional
 * regions' cities as the user expands them.
 *
 * Reads via the standard anon client — `cities` is publicly readable
 * (it's reference data, no PII). Per-region query is a single index
 * lookup, sub-50ms in practice.
 */

const REGION_ID_RE = /^[a-z0-9][a-z0-9_-]{1,199}$/i;

export async function GET(request: NextRequest) {
  const regionId = request.nextUrl.searchParams.get("regionId");
  if (!regionId || !REGION_ID_RE.test(regionId)) {
    return NextResponse.json(
      { error: "Invalid regionId." },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("cities")
    .select("id, region_id, slug, name")
    .eq("region_id", regionId)
    .order("name", { ascending: true })
    .returns<CurrentCity[]>();

  if (error) {
    return NextResponse.json(
      { error: error.message },
      { status: 500 },
    );
  }

  return NextResponse.json(
    { cities: data ?? [] },
    {
      headers: {
        // Cities change rarely — cache aggressively at the edge.
        // The picker's client cache is the primary store; this is
        // belt-and-braces for the second user expanding the same
        // region in the same minute.
        "cache-control": "public, max-age=300, s-maxage=300",
      },
    },
  );
}

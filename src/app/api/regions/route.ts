import { NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/regions
 * Public list of active toolbox regions — powers the Toolbox map's
 * region selector.
 */
export async function GET() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("regions")
    .select("id, display_name, city, country, latitude, longitude, radius_km")
    .eq("active", true)
    .order("display_name", { ascending: true });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json(
    { regions: data ?? [] },
    { headers: { "Cache-Control": "public, max-age=300, s-maxage=600" } },
  );
}

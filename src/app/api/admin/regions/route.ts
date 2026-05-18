import { type NextRequest, NextResponse } from "next/server";

import { requireAdmin, slugifyRegion } from "@/lib/toolbox/admin";
import type { RegionInsert } from "@/types/supabase";

/**
 * GET  /api/admin/regions   — list every region (admin).
 * POST /api/admin/regions   — create a region.
 *   body: { country, province?, city, latitude, longitude, radius_km?, timezone? }
 */

export async function GET() {
  const { isAdmin, supabase } = await requireAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { data, error } = await supabase
    .from("regions")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ regions: data ?? [] });
}

export async function POST(req: NextRequest) {
  const { isAdmin, supabase } = await requireAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Partial<{
    country: string;
    province: string;
    city: string;
    latitude: number;
    longitude: number;
    radius_km: number;
    timezone: string;
  }> | null;

  const country = body?.country?.trim();
  const city = body?.city?.trim();
  const province = body?.province?.trim() || null;
  const { latitude, longitude } = body ?? {};

  if (!country || !city) {
    return NextResponse.json(
      { error: "country and city are required." },
      { status: 400 },
    );
  }
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
    return NextResponse.json(
      { error: "Valid latitude and longitude are required." },
      { status: 400 },
    );
  }

  const radiusKm = Math.min(Math.max(Number(body?.radius_km) || 25, 1), 200);
  const region: RegionInsert = {
    id: slugifyRegion(country, province, city),
    country,
    province,
    city,
    display_name: [city, province].filter(Boolean).join(", "),
    latitude: latitude as number,
    longitude: longitude as number,
    radius_km: radiusKm,
    timezone: body?.timezone?.trim() || null,
  };

  const { data, error } = await supabase
    .from("regions")
    .insert(region)
    .select("*")
    .single();
  if (error) {
    const conflict = error.message.includes("duplicate");
    return NextResponse.json(
      { error: conflict ? "That region already exists." : error.message },
      { status: conflict ? 409 : 500 },
    );
  }

  return NextResponse.json({ region: data }, { status: 201 });
}

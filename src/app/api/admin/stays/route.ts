import { type NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/toolbox/admin";
import { googleMapsUrl } from "@/lib/toolbox/normalize";
import type { StayInsert, StayType } from "@/types/supabase";

/** POST /api/admin/stays — manually add a stay (admin). */
export async function POST(req: NextRequest) {
  const { isAdmin, supabase } = await requireAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as
    | (Partial<StayInsert> & { region_id?: string; stay_type?: StayType })
    | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }
  if (
    !body.name ||
    typeof body.latitude !== "number" ||
    typeof body.longitude !== "number"
  ) {
    return NextResponse.json(
      { error: "Name, latitude and longitude are required." },
      { status: 400 },
    );
  }

  const insert: StayInsert = {
    region_id: body.region_id ?? null,
    stay_type: (body.stay_type as StayType) ?? "hostel",
    name: body.name,
    latitude: body.latitude,
    longitude: body.longitude,
    google_maps_url:
      body.google_maps_url || googleMapsUrl(body.latitude, body.longitude),
    address: body.address ?? null,
    phone: body.phone ?? null,
    whatsapp: body.whatsapp ?? null,
    instagram: body.instagram ?? null,
    facebook: body.facebook ?? null,
    email: body.email ?? null,
    website: body.website ?? null,
    photo_url: body.photo_url ?? null,
    description: body.description ?? null,
    rating: body.rating ?? null,
    review_count: body.review_count ?? 0,
    backpack_rating: body.backpack_rating ?? 0,
    admin_edited: true,
    source: "manual",
    source_ref:
      body.source_ref ||
      `manual:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    metadata_json: { added_by: "admin" },
  };

  const { data, error } = await supabase
    .from("stays")
    .insert(insert)
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ stay: data });
}

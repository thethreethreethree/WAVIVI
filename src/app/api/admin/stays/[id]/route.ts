import { type NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/toolbox/admin";
import type { StayUpdate } from "@/types/supabase";

/**
 * PATCH  /api/admin/stays/[id]  — edit any field of a stay (admin),
 *   including the backpack rating. Sets `admin_edited` so future CSV
 *   imports respect hand-tuned ratings.
 * DELETE /api/admin/stays/[id]  — remove a stay.
 */

type Ctx = { params: Promise<{ id: string }> };

const EDITABLE: (keyof StayUpdate)[] = [
  "name",
  "stay_type",
  "latitude",
  "longitude",
  "address",
  "phone",
  "website",
  "email",
  "instagram",
  "facebook",
  "whatsapp",
  "photo_url",
  "price_per_night_usd",
  "check_in_time",
  "check_out_time",
  "amenities",
  "backpack_rating",
  "rating",
  "review_count",
  "reliability_score",
  "description",
  "region_id",
  "active",
  "needs_review",
];

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const { isAdmin, supabase } = await requireAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Record<
    string,
    unknown
  > | null;
  if (!body) {
    return NextResponse.json({ error: "Invalid body." }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  for (const key of EDITABLE) {
    if (key in body) updates[key] = body[key];
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  if (
    updates.backpack_rating !== undefined &&
    (Number(updates.backpack_rating) < 0 || Number(updates.backpack_rating) > 5)
  ) {
    return NextResponse.json(
      { error: "backpack_rating must be between 0 and 5." },
      { status: 400 },
    );
  }

  updates.admin_edited = true;

  const { data, error } = await supabase
    .from("stays")
    .update(updates as StayUpdate)
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ stay: data });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const { isAdmin, supabase } = await requireAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("stays").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

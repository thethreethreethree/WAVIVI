import { type NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/toolbox/admin";
import type { ExperienceUpdate } from "@/types/supabase";

/**
 * PATCH  /api/admin/experiences/[id]  — edit any field of an experience (admin).
 *   Sets `admin_edited` so future CSV imports respect hand-tuned values.
 * DELETE /api/admin/experiences/[id]  — remove an experience.
 */

type Ctx = { params: Promise<{ id: string }> };

const EDITABLE: (keyof ExperienceUpdate)[] = [
  "name",
  "activity_type",
  "day_bucket",
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
  "price_per_session_usd",
  "amenities",
  "backpack_rating",
  "rating",
  "review_count",
  "reliability_score",
  "description",
  "region_id",
  "active",
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
    .from("experiences")
    .update(updates as ExperienceUpdate)
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ experience: data });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const { isAdmin, supabase } = await requireAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("experiences").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

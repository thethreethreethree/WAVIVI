import { type NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/toolbox/admin";
import type { UtilityUpdate } from "@/types/supabase";

/**
 * PATCH  /api/admin/utilities/[id]  — edit any field of a utility (admin),
 *   including the backpack rating. Sets `admin_edited` so scans know it
 *   was touched by hand.
 * DELETE /api/admin/utilities/[id]  — remove a utility.
 */

type Ctx = { params: Promise<{ id: string }> };

const EDITABLE: (keyof UtilityUpdate)[] = [
  "name",
  "category",
  "latitude",
  "longitude",
  "address",
  "phone",
  "website",
  "instagram",
  "facebook",
  "whatsapp",
  "email",
  "open_24_hours",
  "backpack_rating",
  "rating",
  "review_count",
  "reliability_score",
  "crowd_level",
  "description",
  "traveler_notes",
  "region_id",
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

  // Mark as hand-edited so rescans treat it carefully.
  updates.admin_edited = true;

  const { data, error } = await supabase
    .from("traveler_utilities")
    .update(updates as UtilityUpdate)
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ utility: data });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const { isAdmin, supabase } = await requireAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase
    .from("traveler_utilities")
    .delete()
    .eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

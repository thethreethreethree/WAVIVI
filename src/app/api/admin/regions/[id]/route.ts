import { type NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/toolbox/admin";
import type { RegionUpdate } from "@/types/supabase";

/**
 * PATCH  /api/admin/regions/[id]  — edit a region (admin).
 * DELETE /api/admin/regions/[id]  — delete a region + its utilities (cascade).
 */

type Ctx = { params: Promise<{ id: string }> };

const EDITABLE: (keyof RegionUpdate)[] = [
  "country",
  "province",
  "city",
  "display_name",
  "latitude",
  "longitude",
  "radius_km",
  "timezone",
  "active",
  "scan_enabled",
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

  const updates: RegionUpdate = {};
  for (const key of EDITABLE) {
    if (key in body) {
      (updates as Record<string, unknown>)[key] = body[key];
    }
  }
  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  // Auto-derive display_name when city/province change. Same formula as the
  // POST handler ([city, province].filter(Boolean).join(", ")) so the heading
  // stays in sync with the city/province inputs. Skip when the caller passed
  // display_name explicitly — that's the override path for custom names
  // ("Northern Cebu" rather than "Bantayan Island, Cebu").
  //
  // Without this, the edit form's PATCH only ships city + province + radius
  // and the heading on /admin/regions sticks on whatever was composed at
  // creation, looking like the save didn't take.
  if (
    ("city" in body || "province" in body) &&
    !("display_name" in body)
  ) {
    const { data: current } = await supabase
      .from("regions")
      .select("city, province")
      .eq("id", id)
      .single();
    const nextCity =
      typeof updates.city === "string" ? updates.city : current?.city ?? "";
    const nextProvince =
      "province" in updates
        ? (updates.province as string | null | undefined) ?? ""
        : current?.province ?? "";
    updates.display_name = [nextCity, nextProvince]
      .map((v) => (v ?? "").trim())
      .filter(Boolean)
      .join(", ");
  }

  const { data, error } = await supabase
    .from("regions")
    .update(updates)
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ region: data });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const { isAdmin, supabase } = await requireAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("regions").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

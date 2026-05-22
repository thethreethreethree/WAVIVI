import { type NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/toolbox/admin";

/**
 * DELETE /api/admin/restaurants — bulk delete (admin).
 *   body: { ids: string[] }                  delete a specific set
 *      or { allInRegion: string }            delete every restaurant in a region
 *
 * Mirrors the stays bulk-delete used by the admin list's
 * Select-all → Delete-selected flow.
 */
export async function DELETE(req: NextRequest) {
  const { isAdmin, supabase } = await requireAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    ids?: string[];
    allInRegion?: string;
  } | null;

  if (body?.allInRegion) {
    const { error, count } = await supabase
      .from("restaurants")
      .delete({ count: "exact" })
      .eq("region_id", body.allInRegion);
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    return NextResponse.json({ deleted: count ?? 0 });
  }

  if (!Array.isArray(body?.ids) || body.ids.length === 0) {
    return NextResponse.json(
      { error: "Provide ids[] or allInRegion." },
      { status: 400 },
    );
  }

  const { error, count } = await supabase
    .from("restaurants")
    .delete({ count: "exact" })
    .in("id", body.ids);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ deleted: count ?? 0 });
}

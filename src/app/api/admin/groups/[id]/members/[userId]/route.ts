import { type NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/toolbox/admin";

/**
 * PATCH  /api/admin/groups/[id]/members/[userId]
 *   body: { featured: boolean }  — promote / demote in the Featured strip.
 *
 * DELETE /api/admin/groups/[id]/members/[userId]
 *   Kick a member from the group. RLS doesn't allow members to remove
 *   each other; this admin route bypasses that via the service-role client.
 */

type Ctx = { params: Promise<{ id: string; userId: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id, userId } = await params;
  const { isAdmin, supabase } = await requireAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const body = (await req.json().catch(() => null)) as
    | { featured?: boolean }
    | null;
  if (!body || typeof body.featured !== "boolean") {
    return NextResponse.json(
      { error: "Provide { featured: boolean }." },
      { status: 400 },
    );
  }

  const { data, error } = await supabase
    .from("chat_group_members")
    .update({ featured: body.featured })
    .eq("group_id", id)
    .eq("user_id", userId)
    .select("group_id, user_id, featured")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ member: data });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id, userId } = await params;
  const { isAdmin, supabase } = await requireAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { error } = await supabase
    .from("chat_group_members")
    .delete()
    .eq("group_id", id)
    .eq("user_id", userId);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

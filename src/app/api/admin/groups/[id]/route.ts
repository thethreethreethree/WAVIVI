import { type NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/toolbox/admin";
import type { ChatGroupUpdate } from "@/types/supabase";

/**
 * PATCH  /api/admin/groups/[id]   — edit any field on a group.
 * DELETE /api/admin/groups/[id]   — remove the group entirely (cascades
 *   to chat_group_members and chat_messages via the FK ON DELETE CASCADE).
 */

type Ctx = { params: Promise<{ id: string }> };

const EDITABLE: (keyof ChatGroupUpdate)[] = [
  "name",
  "description",
  "category",
  "cover_image",
  "destination_country",
  "destination_city",
  "window_start",
  "window_end",
  "theme_tags",
  "featured",
  "archived",
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

  const { data, error } = await supabase
    .from("chat_groups")
    .update(updates as ChatGroupUpdate)
    .eq("id", id)
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ group: data });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const { isAdmin, supabase } = await requireAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const { error } = await supabase.from("chat_groups").delete().eq("id", id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

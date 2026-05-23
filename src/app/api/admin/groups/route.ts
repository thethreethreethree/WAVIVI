import { type NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/toolbox/admin";
import type { ChatGroupInsert } from "@/types/supabase";

/**
 * POST /api/admin/groups — create a new chat group.
 *
 * Body: { id, name, description?, category?, cover_image?,
 *         destination_country?, destination_city?, theme_tags?, featured? }
 *
 * `id` is the stable slug used in URLs (must be 3–64 chars, unique). The
 * admin sets it explicitly so we can match it with the existing
 * `/meet/[id]` and `/meet/[id]/chat` routes that pre-date this dashboard.
 */
export async function POST(req: NextRequest) {
  const { isAdmin, supabase } = await requireAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as Partial<ChatGroupInsert> | null;
  if (!body || !body.id || !body.name) {
    return NextResponse.json(
      { error: "id and name are required." },
      { status: 400 },
    );
  }
  if (!/^[a-z0-9][a-z0-9-]{2,63}$/.test(body.id)) {
    return NextResponse.json(
      { error: "id must be 3–64 lowercase letters/numbers/dashes." },
      { status: 400 },
    );
  }

  const insert: ChatGroupInsert = {
    id: body.id,
    name: body.name,
    description: body.description ?? null,
    category: body.category ?? null,
    cover_image: body.cover_image ?? null,
    destination_country: body.destination_country ?? null,
    destination_city: body.destination_city ?? null,
    theme_tags: body.theme_tags ?? [],
    featured: body.featured ?? false,
  };

  const { data, error } = await supabase
    .from("chat_groups")
    .insert(insert)
    .select("*")
    .single();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ group: data });
}

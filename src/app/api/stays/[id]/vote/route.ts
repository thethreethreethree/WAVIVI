import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * POST   /api/stays/[id]/vote    — record this traveler's Backpacker Pick.
 * DELETE /api/stays/[id]/vote    — withdraw it.
 *
 * The cached stays.thumbs_up count is refreshed by a DB trigger
 * (refresh_stay_votes).
 */

type Ctx = { params: Promise<{ id: string }> };

export async function POST(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to vote." }, { status: 401 });
  }
  const { error } = await supabase
    .from("stay_votes")
    .upsert(
      { stay_id: id, voter_id: user.id },
      { onConflict: "stay_id,voter_id" },
    );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to vote." }, { status: 401 });
  }
  const { error } = await supabase
    .from("stay_votes")
    .delete()
    .eq("stay_id", id)
    .eq("voter_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

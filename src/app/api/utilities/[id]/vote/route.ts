import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * POST /api/utilities/[id]/vote   body: { vote: 1 | -1 }
 * Casts or changes the signed-in traveler's 👍/👎 on a utility.
 *
 * DELETE /api/utilities/[id]/vote
 * Removes the traveler's vote.
 *
 * Cached thumbs_up / thumbs_down counts are kept fresh by a DB trigger.
 */

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Sign in to vote." }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as { vote?: number } | null;
  if (body?.vote !== 1 && body?.vote !== -1) {
    return NextResponse.json(
      { error: "vote must be 1 or -1." },
      { status: 400 },
    );
  }

  const { error } = await supabase.from("utility_votes").upsert(
    { utility_id: id, voter_id: user.id, vote: body.vote },
    { onConflict: "utility_id,voter_id" },
  );
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, vote: body.vote });
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
    .from("utility_votes")
    .delete()
    .eq("utility_id", id)
    .eq("voter_id", user.id);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

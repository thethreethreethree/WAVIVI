import { type NextRequest, NextResponse } from "next/server";

import {
  clearNoteMarker,
  deleteDevNote,
  setNoteFlags,
} from "@/lib/susen/tuning";
import { requireAdmin } from "@/lib/toolbox/admin";

/**
 * PATCH  /api/admin/susen/notes/[id] — toggle steering flags on one note:
 *   { active?, is_instruction?, applied? }. Retire a live rule with
 *   active:false; promote a captured turn with is_instruction:true+active:true.
 *   Or clear a review marker with { clearMarker: "flag" | "fire" }.
 * DELETE /api/admin/susen/notes/[id] — remove a note from the log entirely.
 * Admin-only.
 */

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const { isAdmin } = await requireAdmin();
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

  // Clear a review marker (🚩/🔥) — its own branch so it can't be mixed
  // with a flag toggle in one request.
  if (body.clearMarker === "flag" || body.clearMarker === "fire") {
    const { error } = await clearNoteMarker(id, body.clearMarker);
    if (error) {
      return NextResponse.json({ error }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  const flags: { active?: boolean; is_instruction?: boolean; applied?: boolean } =
    {};
  if (typeof body.active === "boolean") flags.active = body.active;
  if (typeof body.is_instruction === "boolean")
    flags.is_instruction = body.is_instruction;
  if (typeof body.applied === "boolean") flags.applied = body.applied;
  if (Object.keys(flags).length === 0) {
    return NextResponse.json({ error: "Nothing to update." }, { status: 400 });
  }

  const { error } = await setNoteFlags(id, flags);
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function DELETE(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  const { error } = await deleteDevNote(id);
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

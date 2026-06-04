import { type NextRequest, NextResponse } from "next/server";

import { addRule } from "@/lib/susen/tuning";
import { requireAdmin } from "@/lib/toolbox/admin";

/**
 * POST /api/admin/susen/notes — hand-write a new live tuning rule from the
 * /admin/susen console. Inserts an is_instruction && active row so it starts
 * steering Susen's replies on her next message. Admin-only.
 */

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { user, isAdmin } = await requireAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    message?: unknown;
  } | null;
  const message =
    typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "message is required." }, { status: 400 });
  }
  if (message.length > 500) {
    return NextResponse.json(
      { error: "Keep a rule under 500 characters." },
      { status: 400 },
    );
  }

  const { note, error } = await addRule({
    author: user?.email ?? "admin",
    message,
  });
  if (error) {
    return NextResponse.json({ error }, { status: 500 });
  }
  return NextResponse.json({ note });
}

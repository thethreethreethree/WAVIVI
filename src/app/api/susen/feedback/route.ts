import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import { FEEDBACK_BODY_MAX, submitFeedback } from "@/lib/susen/feedback";

/**
 * POST /api/susen/feedback — traveller submits in-trip feedback about
 * a place / topic. Goes to status='pending' on susen_feedback and
 * surfaces in the admin queue at /admin/susen for review.
 *
 * Body shape:
 *   {
 *     body: string,                 // required, ≤4000 chars
 *     country?: string,
 *     regionId?: string,
 *     cityId?: string,
 *     topic?: string,               // optional free-text topic
 *   }
 *
 * Auth-gated — anonymous submissions would let anyone seed the rule
 * queue and burn admin review time. We're keeping it tied to a signed-
 * in user; the RLS INSERT policy on susen_feedback also enforces
 * author_id = auth.uid() at the DB layer as defence in depth.
 */
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to send feedback." },
      { status: 401 },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    body?: unknown;
    country?: unknown;
    regionId?: unknown;
    cityId?: unknown;
    topic?: unknown;
  } | null;

  const text = typeof body?.body === "string" ? body.body.trim() : "";
  if (!text) {
    return NextResponse.json({ error: "body is required." }, { status: 400 });
  }
  if (text.length > FEEDBACK_BODY_MAX) {
    return NextResponse.json(
      { error: `Keep feedback under ${FEEDBACK_BODY_MAX} characters.` },
      { status: 400 },
    );
  }

  const country =
    typeof body?.country === "string" ? body.country.trim() : null;
  const regionId =
    typeof body?.regionId === "string" ? body.regionId.trim() : null;
  const cityId =
    typeof body?.cityId === "string" ? body.cityId.trim() : null;
  const topic = typeof body?.topic === "string" ? body.topic.trim() : null;

  const { row, error } = await submitFeedback({
    authorId: user.id,
    country: country || null,
    regionId: regionId || null,
    cityId: cityId || null,
    topic: topic || null,
    body: text,
  });
  if (error || !row) {
    return NextResponse.json(
      { error: error ?? "Insert failed." },
      { status: 500 },
    );
  }
  return NextResponse.json({ id: row.id });
}

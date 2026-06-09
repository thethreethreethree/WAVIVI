import { NextResponse } from "next/server";

import { loadDvsComments } from "@/lib/dvs/server";

/**
 * GET /api/dvs/{shareId}/comments
 *
 * Returns the comments thread for one Daily Vibe Share. Used by the
 * `DvsCommentsThread` client component for lazy-load on card expand —
 * keeps the per-card fetch off the server-rendered feed page so a
 * traveler scrolling past 50 collapsed cards doesn't pay for the
 * threads they never opened.
 *
 * Public read; auth not required. RLS on `dvs_comments` enforces the
 * `active=true` visibility filter at the DB layer.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ shareId: string }> },
) {
  const { shareId } = await params;
  if (!shareId) {
    return NextResponse.json({ error: "Missing shareId." }, { status: 400 });
  }
  const comments = await loadDvsComments(shareId);
  return NextResponse.json({ comments });
}

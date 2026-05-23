import { type NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";

/**
 * GET /api/saves/count?type=stay|restaurant|experience|event&id=<uuid>
 *
 * Returns how many travel plans currently have this place saved. Uses the
 * admin client to count across every traveler's plan (RLS would otherwise
 * scope to the caller's own plans and report 1/0). Read-only — no
 * traveler-identifying data leaves the server, only an aggregate count.
 */
const COLUMN: Record<string, string> = {
  stay: "saved_hotels",
  restaurant: "saved_restaurants",
  experience: "saved_activities",
  event: "saved_events",
};

export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const type = searchParams.get("type") ?? "";
  const id = searchParams.get("id") ?? "";
  const column = COLUMN[type];
  if (!column || !id) {
    return NextResponse.json({ count: 0 });
  }

  try {
    const supabase = createAdminClient();
    // jsonb contains with an array element — matches any plan whose saved
    // list includes an item with this externalId.
    const { count, error } = await supabase
      .from("travel_plans")
      .select("id", { count: "exact", head: true })
      .contains(column, [{ externalId: id }]);
    if (error) return NextResponse.json({ count: 0 });
    return NextResponse.json({ count: count ?? 0 });
  } catch {
    return NextResponse.json({ count: 0 });
  }
}

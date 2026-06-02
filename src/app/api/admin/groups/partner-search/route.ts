import { type NextRequest, NextResponse } from "next/server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/toolbox/admin";

export type PartnerHit = {
  type: "stay" | "restaurant" | "experience" | "event";
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  region_id: string | null;
};

/**
 * GET /api/admin/groups/partner-search?q=<text>&region_id=<id>
 *
 * Cross-table search across stays, restaurants, experiences, and events
 * — used by the Group editor's "Specific location" partner picker.
 *
 * Filters:
 *   q          required, name ILIKE '%q%'
 *   region_id  optional. When set, restricts to that region only.
 *
 * Returns up to 6 hits per table (24 total) ordered by backpack_rating.
 */
export async function GET(req: NextRequest) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim();
  const regionId = url.searchParams.get("region_id") ?? null;
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  const admin = createAdminClient();
  // Hand-build the ILIKE pattern (Supabase escape rules for `%` / `_`).
  const ilike = `%${q.replace(/[\\%_]/g, (m) => `\\${m}`)}%`;

  const cols = "id, name, address, latitude, longitude, region_id";
  function run(table: "stays" | "restaurants" | "experiences" | "events") {
    let qb = admin
      .from(table)
      .select(cols)
      .eq("active", true)
      .ilike("name", ilike)
      .order("rank_score", { ascending: false, nullsFirst: false })
      .limit(6);
    if (regionId) qb = qb.eq("region_id", regionId);
    return qb;
  }

  const [stays, restaurants, experiences, events] = await Promise.all([
    run("stays"),
    run("restaurants"),
    run("experiences"),
    run("events"),
  ]);

  function map(
    rows:
      | {
          id: string;
          name: string;
          address: string | null;
          latitude: number;
          longitude: number;
          region_id: string | null;
        }[]
      | null,
    type: PartnerHit["type"],
  ): PartnerHit[] {
    return (rows ?? []).map((r) => ({ type, ...r }));
  }

  const results: PartnerHit[] = [
    ...map(stays.data, "stay"),
    ...map(restaurants.data, "restaurant"),
    ...map(experiences.data, "experience"),
    ...map(events.data, "event"),
  ];

  return NextResponse.json({ results });
}

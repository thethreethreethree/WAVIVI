import { type NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/toolbox/admin";

/**
 * GET /api/admin/regions/[id]/impact
 *
 * Preview the blast radius of a region delete. Returns per-table counts
 * split into:
 *   - `cascade`: rows that the FK constraint will hard-delete on this
 *     region's removal (cities, feed_posts, traveler_utilities,
 *     scan_jobs — see the migration files for the exact ON DELETE rule).
 *   - `orphan`: rows that the FK constraint will *keep* but null out
 *     the `region_id` on (stays, restaurants, experiences, events).
 *     These rows survive the delete but become invisible on the public
 *     listings (no region scope → never queried). Admins should be
 *     warned loudly so they can decide to move the places to another
 *     region first or accept the orphan.
 *
 * Admin-only. Used by the delete confirmation modal on /admin/regions.
 */
type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const { isAdmin, supabase } = await requireAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  // Supabase's typed client requires a literal table name, so each
  // count is inlined rather than parametrised over a `string` variable.
  const head = { count: "exact" as const, head: true };
  const [
    citiesRes,
    feedPostsRes,
    travelerUtilitiesRes,
    scanJobsRes,
    staysRes,
    restaurantsRes,
    experiencesRes,
    eventsRes,
  ] = await Promise.all([
    supabase.from("cities").select("*", head).eq("region_id", id),
    supabase.from("feed_posts").select("*", head).eq("region_id", id),
    supabase.from("traveler_utilities").select("*", head).eq("region_id", id),
    supabase.from("scan_jobs").select("*", head).eq("region_id", id),
    supabase.from("stays").select("*", head).eq("region_id", id),
    supabase.from("restaurants").select("*", head).eq("region_id", id),
    supabase.from("experiences").select("*", head).eq("region_id", id),
    supabase.from("events").select("*", head).eq("region_id", id),
  ]);
  const cities = citiesRes.count ?? 0;
  const feedPosts = feedPostsRes.count ?? 0;
  const travelerUtilities = travelerUtilitiesRes.count ?? 0;
  const scanJobs = scanJobsRes.count ?? 0;
  const stays = staysRes.count ?? 0;
  const restaurants = restaurantsRes.count ?? 0;
  const experiences = experiencesRes.count ?? 0;
  const events = eventsRes.count ?? 0;

  return NextResponse.json({
    cascade: {
      cities,
      feed_posts: feedPosts,
      traveler_utilities: travelerUtilities,
      scan_jobs: scanJobs,
    },
    orphan: {
      stays,
      restaurants,
      experiences,
      events,
    },
  });
}

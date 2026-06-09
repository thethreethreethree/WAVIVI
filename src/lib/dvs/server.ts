import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { DvsShareRow } from "@/types/supabase";

import type { DvsShareDisplay } from "./types";

/**
 * Server loaders for the Daily Vibe Share feature.
 *
 * One central place to fetch shares + the author profile + region/city
 * labels in a single round-trip. Used by:
 *   - /profile (author's own timeline)
 *   - /u/[username] (someone else's timeline)
 *   - /feed (global stream — Phase 2 wiring)
 *   - Tools location pages (aggregated tips/costs — Phase 3 wiring)
 */

/** Default fetch limit. 50 covers a meaningful scroll without paging
 *  UI we haven't built yet. */
const DEFAULT_LIMIT = 50;

/** Subset of profile fields we join into each share for rendering. */
type AuthorProfile = {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
};

/** Joined select string — kept here so all the loaders pick the same
 *  fields and the row-to-display mapper has stable input. */
const SELECT_WITH_JOINS = `
  *,
  author:profiles!daily_vibe_shares_author_id_fkey(id, username, display_name, avatar_url),
  region:regions(id, display_name),
  city:cities(id, name)
`;

type JoinedRow = DvsShareRow & {
  author: AuthorProfile | null;
  region: { id: string; display_name: string } | null;
  city: { id: string; name: string } | null;
};

function toDisplay(row: JoinedRow): DvsShareDisplay {
  // Fallback strings keep the UI sane when an author profile was
  // deleted between insert and render. The FK is ON DELETE CASCADE so
  // this shouldn't normally happen, but the guard costs nothing.
  const author = row.author;
  return {
    id: row.id,
    authorId: row.author_id,
    authorUsername: author?.username ?? "traveler",
    authorDisplayName: author?.display_name ?? "Traveler",
    authorAvatarUrl: author?.avatar_url ?? null,
    vibeRating: row.vibe_rating,
    caption: row.caption,
    regionId: row.region_id,
    regionLabel: row.region?.display_name ?? null,
    cityId: row.city_id,
    cityLabel: row.city?.name ?? null,
    locationLabel: row.location_label,
    latitude: row.latitude,
    longitude: row.longitude,
    photoUrl: row.photo_url,
    tip: row.tip,
    costMeal: row.cost_meal,
    costHotel: row.cost_hotel,
    costActivity: row.cost_activity,
    costCurrency: row.cost_currency,
    qaQuestion: row.qa_question,
    qaAnswer: row.qa_answer,
    likeCount: row.like_count,
    commentCount: row.comment_count,
    shareCount: row.share_count,
    createdAt: row.created_at,
  };
}

/** Recent shares by one author — used on /profile and /u/[username]. */
export async function loadAuthorDvsShares(
  authorId: string,
  limit = DEFAULT_LIMIT,
): Promise<DvsShareDisplay[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_vibe_shares")
    .select(SELECT_WITH_JOINS)
    .eq("active", true)
    .eq("author_id", authorId)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<JoinedRow[]>();
  return (data ?? []).map(toDisplay);
}

/** Region- or city-scoped feed — used by /feed in Phase 2. Passing
 *  no scope falls back to the global newest-first stream. */
export async function loadDvsFeed(
  scope: { regionId?: string | null; cityIds?: string[] } = {},
  limit = DEFAULT_LIMIT,
): Promise<DvsShareDisplay[]> {
  const supabase = await createClient();
  let query = supabase
    .from("daily_vibe_shares")
    .select(SELECT_WITH_JOINS)
    .eq("active", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (scope.regionId) query = query.eq("region_id", scope.regionId);
  if (scope.cityIds && scope.cityIds.length > 0) {
    query = query.in("city_id", scope.cityIds);
  }
  const { data } = await query.returns<JoinedRow[]>();
  return (data ?? []).map(toDisplay);
}

/** Look up whether the given author has already posted today (UTC
 *  date). Used by the compose form to surface a soft-prompt
 *  ("You've shared today — replace?") and by the profile page to
 *  decide whether to render the "Share today's vibe" CTA. */
export async function hasSharedToday(authorId: string): Promise<boolean> {
  const supabase = await createClient();
  // Build a UTC date string for the start-of-day; Postgres handles the
  // range filter on the indexed `created_at`. Done in JS rather than
  // SQL so the query stays portable to the client / cookie layer if a
  // future loader needs the same predicate.
  const todayStart = new Date();
  todayStart.setUTCHours(0, 0, 0, 0);
  const { count } = await supabase
    .from("daily_vibe_shares")
    .select("*", { count: "exact", head: true })
    .eq("active", true)
    .eq("author_id", authorId)
    .gte("created_at", todayStart.toISOString());
  return (count ?? 0) > 0;
}

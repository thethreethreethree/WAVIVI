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

/* ── Phase 2 — sectioned /feed loaders ─────────────────────────────── */

/** Build a Date at the start of "N hours ago" — used by the NOW
 *  section so the cutoff stays consistent across calls in a request. */
function hoursAgoIso(hours: number): string {
  const t = new Date();
  t.setTime(t.getTime() - hours * 3600 * 1000);
  return t.toISOString();
}

/** Build a Date at the UTC start-of-today — used by the TODAY'S BEST
 *  section so the window matches the one-share-per-UTC-day rule. */
function startOfUtcTodayIso(): string {
  const t = new Date();
  t.setUTCHours(0, 0, 0, 0);
  return t.toISOString();
}

/** 🔥 NOW — shares posted within the last hour. Newest first.
 *  Used by the top section of /feed to surface real-time activity. */
export async function loadDvsNow(limit = 12): Promise<DvsShareDisplay[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_vibe_shares")
    .select(SELECT_WITH_JOINS)
    .eq("active", true)
    .gte("created_at", hoursAgoIso(1))
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<JoinedRow[]>();
  return (data ?? []).map(toDisplay);
}

/** ⭐ TODAY'S BEST — today's shares sorted by engagement weight then
 *  vibe rating. Engagement counters are zero until Phase 3 ships the
 *  reactions/comments tables, so today the sort falls through to
 *  vibe_rating + recency — which still surfaces a useful "best of"
 *  pass over the day's shares. */
export async function loadDvsTodaysBest(
  limit = 12,
): Promise<DvsShareDisplay[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("daily_vibe_shares")
    .select(SELECT_WITH_JOINS)
    .eq("active", true)
    .gte("created_at", startOfUtcTodayIso())
    // PostgREST chains .order calls into the SQL ORDER BY in
    // declaration order, so each successive call is a secondary key.
    .order("like_count", { ascending: false })
    .order("comment_count", { ascending: false })
    .order("share_count", { ascending: false })
    .order("vibe_rating", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<JoinedRow[]>();
  return (data ?? []).map(toDisplay);
}

/** 📍 YOUR DESTINATIONS — shares from regions the user is planning to
 *  visit. Pulls the user's active+upcoming travel plans, extracts the
 *  set of destination countries, then loads DVS shares from any region
 *  whose country matches.
 *
 *  Why country-level: travel_plans.destinations stores city as
 *  free-form text (no FK), so country is the only column we can match
 *  against regions.country reliably. A future pass can tighten to city
 *  once we wire the city_id back-resolver. */
export async function loadDvsForUserDestinations(
  userId: string,
  limit = 20,
): Promise<DvsShareDisplay[]> {
  const supabase = await createClient();

  const { data: plans } = await supabase
    .from("travel_plans")
    .select("destination_countries, status")
    .eq("user_id", userId)
    .in("status", ["upcoming", "active"]);

  const countries = new Set<string>();
  for (const p of plans ?? []) {
    for (const c of p.destination_countries ?? []) countries.add(c);
  }
  if (countries.size === 0) return [];

  // Resolve countries → region IDs. We can't filter directly on
  // regions.country from the shares table (PostgREST has no join
  // filter), so do it as a two-step.
  const { data: regions } = await supabase
    .from("regions")
    .select("id, country")
    .in("country", Array.from(countries));
  const regionIds = (regions ?? []).map((r) => r.id);
  if (regionIds.length === 0) return [];

  const { data } = await supabase
    .from("daily_vibe_shares")
    .select(SELECT_WITH_JOINS)
    .eq("active", true)
    .in("region_id", regionIds)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<JoinedRow[]>();
  return (data ?? []).map(toDisplay);
}

/** 👥 FOLLOWING — shares from travelers the user shares a group chat
 *  with. The DVS spec promises a "matched group + connections" feed;
 *  group co-membership is the strongest social signal we have today.
 *  Excludes the user's own shares (those already render in
 *  YOUR DESTINATIONS / NOW / TODAY'S BEST if they qualify). */
export async function loadDvsFromFollowing(
  userId: string,
  limit = 20,
): Promise<DvsShareDisplay[]> {
  const supabase = await createClient();

  // Step 1: the user's groups.
  const { data: myGroups } = await supabase
    .from("chat_group_members")
    .select("group_id")
    .eq("user_id", userId);
  const groupIds = (myGroups ?? []).map((g) => g.group_id);
  if (groupIds.length === 0) return [];

  // Step 2: every member of those groups (minus the user).
  const { data: coMembers } = await supabase
    .from("chat_group_members")
    .select("user_id")
    .in("group_id", groupIds);
  const peerIds = Array.from(
    new Set((coMembers ?? []).map((m) => m.user_id)),
  ).filter((id) => id !== userId);
  if (peerIds.length === 0) return [];

  const { data } = await supabase
    .from("daily_vibe_shares")
    .select(SELECT_WITH_JOINS)
    .eq("active", true)
    .in("author_id", peerIds)
    .order("created_at", { ascending: false })
    .limit(limit)
    .returns<JoinedRow[]>();
  return (data ?? []).map(toDisplay);
}

/* ── Phase 3 — reactions + comments loaders ────────────────────────── */

/** Compact display shape for one comment row, joined with its author
 *  profile so the thread renders without a second query per comment. */
export interface DvsCommentDisplay {
  id: string;
  shareId: string;
  authorId: string;
  authorUsername: string;
  authorDisplayName: string;
  authorAvatarUrl: string | null;
  body: string;
  createdAt: string;
}

/** Resolve which of the given share ids the viewer has already
 *  liked. Returns an empty Set when the viewer is signed-out. Used
 *  by the feed pages to hydrate the heart-button initial state per
 *  card without N+1 lookups. */
export async function loadViewerLikedShareIds(
  viewerId: string | null,
  shareIds: string[],
): Promise<Set<string>> {
  if (!viewerId || shareIds.length === 0) return new Set();
  const supabase = await createClient();
  const { data } = await supabase
    .from("dvs_reactions")
    .select("share_id")
    .eq("user_id", viewerId)
    .in("share_id", shareIds);
  return new Set((data ?? []).map((r) => r.share_id));
}

/** Load the comments thread for one share, oldest-first (chat-style
 *  reading order). Joins the author profile so the thread renders
 *  without per-row lookups. */
export async function loadDvsComments(
  shareId: string,
  limit = 100,
): Promise<DvsCommentDisplay[]> {
  const supabase = await createClient();
  type Row = {
    id: string;
    share_id: string;
    author_id: string;
    body: string;
    created_at: string;
    author: {
      id: string;
      username: string;
      display_name: string;
      avatar_url: string | null;
    } | null;
  };
  const { data } = await supabase
    .from("dvs_comments")
    .select(
      `
      id, share_id, author_id, body, created_at,
      author:profiles!dvs_comments_author_id_fkey(id, username, display_name, avatar_url)
    `,
    )
    .eq("active", true)
    .eq("share_id", shareId)
    .order("created_at", { ascending: true })
    .limit(limit)
    .returns<Row[]>();
  return (data ?? []).map((r) => ({
    id: r.id,
    shareId: r.share_id,
    authorId: r.author_id,
    authorUsername: r.author?.username ?? "traveler",
    authorDisplayName: r.author?.display_name ?? "Traveler",
    authorAvatarUrl: r.author?.avatar_url ?? null,
    body: r.body,
    createdAt: r.created_at,
  }));
}

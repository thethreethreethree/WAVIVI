import "server-only";

import { getCurrentRegionId } from "@/lib/regions/current";
import { createClient } from "@/lib/supabase/server";
import type { FeedPostRow } from "@/types/supabase";

import { feedPosts as mockFeedPosts } from "@/lib/travejor/feed";

/**
 * Travelers Feed retrieval — region-scoped.
 *
 *   1. If the traveller has a region selected (wv-region cookie), we
 *      ship posts where region_id matches that. This is the dominant
 *      path once admins populate per-region content.
 *   2. If no region is selected we ship the "global" feed — every
 *      active post, newest first. Same query, no region filter.
 *   3. If the DB returns zero rows (a region with no admin-curated
 *      content yet), fall back to the mock posts from
 *      src/lib/travejor/feed.ts so the surface never goes blank.
 *      Admins backfill, the fallback disappears naturally.
 *
 * Ordered by (display_order asc nulls last, created_at desc) so a
 * pinned post sits above newest-first ordering. Covering index
 * `feed_posts_region_idx` (migration 0050) backs this.
 */

/** Shape used by the FeedList client component — kept identical to
 *  the existing `FeedPost` from lib/travejor/feed so the card UI
 *  doesn't need to know whether the data came from the DB or the
 *  mock. */
export interface FeedDisplayPost {
  id: string;
  handle: string;
  verified: boolean;
  caption: string;
  location: string;
  image: string;
  likes: string;
  comments: number;
  shares: number;
  /** Source Instagram post URL when the post was admin-curated from IG.
   *  Kept on the row for reference / admin debugging; the feed UI no
   *  longer uses it as a tap target (the @handle is the IG escape
   *  hatch now — see feed-list.tsx). */
  igPostUrl: string | null;
  /** Migration 0054 — when set, the feed card renders an inline
   *  tap-to-play <video> with image as the poster. Null for still-only
   *  posts. Mirrored to Supabase Storage on admin import so IG CDN
   *  token rotation can't break playback. */
  videoUrl: string | null;
}

/** Limit per fetch. 50 covers a meaningful scroll without paging
 *  into UI work we haven't built. */
const FEED_LIMIT = 50;

function rowToDisplay(row: FeedPostRow): FeedDisplayPost {
  return {
    id: row.id,
    handle: row.handle,
    verified: row.verified,
    caption: row.caption,
    location: row.location_label ?? "",
    image: row.image_url,
    likes: row.likes_label,
    comments: row.comments,
    shares: row.shares,
    igPostUrl: row.ig_post_url ?? null,
    videoUrl: row.video_url ?? null,
  };
}

/** Resolve the feed for the user's current region (or globally when
 *  no region is selected). Falls back to the mock seed when the DB
 *  is empty so the page renders something useful on day 1. */
export async function loadFeedForCurrentRegion(): Promise<{
  posts: FeedDisplayPost[];
  /** True when we're showing the mock fallback rather than real DB
   *  rows. Used by the UI to hide engagement buttons on the seed
   *  cards (they aren't backed by real data). */
  isMockFallback: boolean;
}> {
  const regionId = await getCurrentRegionId();
  const supabase = await createClient();

  let query = supabase
    .from("feed_posts")
    .select("*")
    .eq("active", true)
    .order("display_order", { ascending: true, nullsFirst: false })
    .order("created_at", { ascending: false })
    .limit(FEED_LIMIT);
  if (regionId) query = query.eq("region_id", regionId);

  const { data, error } = await query;
  if (error) {
    console.warn("[feed] DB load failed, falling back to mock:", error.message);
  }

  const rows = (data ?? []) as FeedPostRow[];
  if (rows.length > 0) {
    return { posts: rows.map(rowToDisplay), isMockFallback: false };
  }

  // No real content yet — keep the surface alive with the original
  // hand-curated travelogue cards so launch day in an empty region
  // doesn't look broken.
  return {
    posts: mockFeedPosts.map((p) => ({
      id: p.id,
      handle: p.handle,
      verified: p.verified,
      caption: p.caption,
      location: p.location,
      image: p.image,
      likes: p.likes,
      comments: p.comments,
      shares: p.shares,
      igPostUrl: null,
      videoUrl: null,
    })),
    isMockFallback: true,
  };
}

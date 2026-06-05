import { FeedList } from "@/components/ui/feed-list";
import { FeedShareButton } from "@/components/ui/feed-share-button";
import { loadFeedForCurrentRegion } from "@/lib/feed/server";

/**
 * Travelers Feed — vertical stack of watercolor-framed post cards.
 *
 * Server Component now: it fetches the region-scoped feed via
 * `loadFeedForCurrentRegion` (DB → falls back to the original mock
 * seed when a region has no admin-curated posts yet), then hands the
 * data to <FeedList> (client) which owns the like/save UI state.
 *
 * Designed to clear the iOS status bar (safe-area top inset) and the
 * floating bottom nav, with each card sized so the system chrome
 * stays visible.
 */
export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const { posts, isMockFallback } = await loadFeedForCurrentRegion();

  return (
    <div className="relative flex flex-1 flex-col px-4 pb-8 pt-[max(3rem,calc(env(safe-area-inset-top)+1.25rem))]">
      <header className="mb-3 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Feed</h1>
        {/* Share button is anonymous-aware: opens sign-up modal for
            signed-out visitors, "compose coming soon" for signed-in
            users (until Phase 2 / Login-with-Instagram lands). */}
        <FeedShareButton />
      </header>

      <FeedList posts={posts} isMockFallback={isMockFallback} />

      {/* Create-post FAB hidden for v1 — the traveler-side compose
          flow lands once Login-with-Instagram is wired (Phase 2). For
          now, admins post via /admin/feed/[regionId]. */}
    </div>
  );
}

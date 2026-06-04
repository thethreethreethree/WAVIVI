import Image from "next/image";

import { FeedList } from "@/components/ui/feed-list";
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
        <button
          type="button"
          aria-label="Share"
          className="wc-frame flex h-12 w-12 items-center justify-center rounded-full active:scale-95"
        >
          <span
            className="inline-block"
            style={{
              animation: "balloonFloat 6s ease-in-out infinite",
            }}
          >
            <Image
              src="/decor/balloon-floater.png"
              alt=""
              width={40}
              height={40}
              className="h-8 w-8 object-contain"
            />
          </span>
        </button>
      </header>

      <FeedList posts={posts} isMockFallback={isMockFallback} />

      {/* Create-post FAB hidden for v1 — the traveler-side compose
          flow lands once Login-with-Instagram is wired (Phase 2). For
          now, admins post via /admin/feed/[regionId]. */}
    </div>
  );
}

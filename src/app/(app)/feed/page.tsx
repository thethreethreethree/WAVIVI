import { FeedList } from "@/components/ui/feed-list";
import { FeedShareButton } from "@/components/ui/feed-share-button";
import { loadFeedForCurrentRegion } from "@/lib/feed/server";
import { requireAdmin } from "@/lib/toolbox/admin";

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

type Search = Promise<{ debug?: string }>;

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const { posts, isMockFallback } = await loadFeedForCurrentRegion();

  // PROBE — `?debug=1` dumps each post's media URLs as JSON above the
  // feed so we can verify, in one screenshot, whether video_url is
  // populated in the DB. Admin-gated so a casual visitor never sees
  // internal fields. Delete once the import pipeline is verified.
  const debug = (await searchParams).debug === "1";
  const { isAdmin } = debug ? await requireAdmin() : { isAdmin: false };
  const showDebug = debug && isAdmin;
  const debugRows = showDebug
    ? posts.map((p) => ({
        id: p.id.slice(0, 8),
        handle: p.handle,
        image: p.image ? p.image.slice(0, 80) + "…" : null,
        videoUrl: p.videoUrl,
        igPostUrl: p.igPostUrl,
      }))
    : null;

  return (
    <div className="relative flex flex-1 flex-col px-4 pb-8 pt-[max(3rem,calc(env(safe-area-inset-top)+1.25rem))]">
      <header className="mb-3 flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Feed</h1>
        {/* Share button is anonymous-aware: opens sign-up modal for
            signed-out visitors, "compose coming soon" for signed-in
            users (until Phase 2 / Login-with-Instagram lands). */}
        <FeedShareButton />
      </header>

      {debugRows && (
        <details
          open
          className="mb-4 rounded-2xl bg-foreground/5 p-3 text-[11px] ring-1 ring-border"
        >
          <summary className="cursor-pointer font-bold text-foreground">
            DEBUG — feed data ({debugRows.length} posts,{" "}
            {isMockFallback ? "mock fallback" : "DB"})
          </summary>
          <pre className="mt-2 max-h-[60vh] overflow-auto whitespace-pre-wrap break-all font-mono text-[10px] text-foreground/80">
            {JSON.stringify(debugRows, null, 2)}
          </pre>
        </details>
      )}

      <FeedList posts={posts} isMockFallback={isMockFallback} />

      {/* Create-post FAB hidden for v1 — the traveler-side compose
          flow lands once Login-with-Instagram is wired (Phase 2). For
          now, admins post via /admin/feed/[regionId]. */}
    </div>
  );
}

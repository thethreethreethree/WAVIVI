import type { DvsShareDisplay } from "@/lib/dvs/types";

import { DvsCard } from "./dvs-card";

/**
 * Vertical list of DVS cards. Server component — accepts the
 * already-loaded shares so the page does the fetch and the list stays
 * a thin presentational layer. Mirrors the FeedList shape so callers
 * can swap between the two feeds without rebuilding markup.
 *
 * Renders nothing when `shares` is empty — callers own the empty
 * state copy (it varies between /profile, /u/[username], /feed).
 *
 * `viewerLikedIds` hydrates each card's initial heart state without
 * an N+1 lookup — the page loads the whole set once via
 * `loadViewerLikedShareIds` and passes it in.
 */
export function DvsList({
  shares,
  viewerId = null,
  viewerUsername = null,
  viewerAvatarUrl = null,
  viewerLikedIds,
}: {
  shares: DvsShareDisplay[];
  viewerId?: string | null;
  viewerUsername?: string | null;
  viewerAvatarUrl?: string | null;
  viewerLikedIds?: Set<string>;
}) {
  if (shares.length === 0) return null;
  return (
    <div className="flex flex-col gap-4">
      {shares.map((s) => (
        <DvsCard
          key={s.id}
          share={s}
          viewerId={viewerId}
          viewerUsername={viewerUsername}
          viewerAvatarUrl={viewerAvatarUrl}
          viewerLiked={viewerLikedIds?.has(s.id) ?? false}
        />
      ))}
    </div>
  );
}

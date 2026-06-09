import type { DvsShareDisplay } from "@/lib/dvs/types";

import { DvsList } from "./dvs-list";

/**
 * One section of the /feed page — title + subtitle + a stack of DVS
 * cards (or an empty-state line).
 *
 * Kept thin: the page picks the title / icon / empty-state copy per
 * section (NOW / TODAY'S BEST / YOUR DESTINATIONS / FOLLOWING) and
 * passes the pre-loaded shares in. The section component just renders.
 *
 * `hideWhenEmpty` lets sections like YOUR DESTINATIONS and FOLLOWING
 * disappear entirely when there's nothing to show — they're
 * conditional surfaces (only meaningful when the user has plans /
 * group co-members), and rendering an empty section reads as
 * "broken." NOW and TODAY'S BEST always render so a fresh visitor on
 * an empty feed still sees the structure.
 *
 * Viewer state (id, username, avatar, liked-set) is threaded down to
 * the cards so the heart button hydrates with the right initial
 * state and points actions at the right user.
 */
export function DvsFeedSection({
  icon,
  title,
  subtitle,
  shares,
  emptyState,
  hideWhenEmpty = false,
  viewerId = null,
  viewerUsername = null,
  viewerAvatarUrl = null,
  viewerLikedIds,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  shares: DvsShareDisplay[];
  emptyState?: React.ReactNode;
  hideWhenEmpty?: boolean;
  viewerId?: string | null;
  viewerUsername?: string | null;
  viewerAvatarUrl?: string | null;
  viewerLikedIds?: Set<string>;
}) {
  const isEmpty = shares.length === 0;
  if (isEmpty && hideWhenEmpty) return null;

  return (
    <section className="flex flex-col gap-3">
      <header>
        <h2 className="flex items-center gap-2 text-lg font-bold tracking-tight">
          <span aria-hidden>{icon}</span>
          {title}
        </h2>
        {subtitle && (
          <p className="mt-0.5 text-xs text-muted">{subtitle}</p>
        )}
      </header>
      {isEmpty ? (
        <div className="wc-frame-ghost rounded-2xl px-4 py-6 text-center text-sm text-muted">
          {emptyState ?? "Nothing here yet."}
        </div>
      ) : (
        <DvsList
          shares={shares}
          viewerId={viewerId}
          viewerUsername={viewerUsername}
          viewerAvatarUrl={viewerAvatarUrl}
          viewerLikedIds={viewerLikedIds}
        />
      )}
    </section>
  );
}

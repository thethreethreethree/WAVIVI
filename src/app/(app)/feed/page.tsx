import Link from "next/link";

import { FeedShareButton } from "@/components/ui/feed-share-button";
import { DvsFeedSection } from "@/features/dvs/dvs-feed-section";
import {
  hasSharedToday,
  loadDvsForUserDestinations,
  loadDvsFromFollowing,
  loadDvsNow,
  loadDvsTodaysBest,
} from "@/lib/dvs/server";
import { getCurrentProfile } from "@/lib/profiles";

/**
 * Travelers Feed — sectioned Daily Vibe Share stream.
 *
 * Sections follow the DVS spec (see
 * Wondavu_Daily_Vibe_Share_DVS_UPDATED.docx §6 Feed Layout):
 *
 *   🔥 NOW              — last hour, anyone (always renders)
 *   ⭐ TODAY'S BEST     — today's shares ranked (always renders)
 *   📍 YOUR DESTINATIONS — based on the user's travel plans
 *                          (hidden when no plans / no matches)
 *   👥 FOLLOWING        — group chat co-members
 *                          (hidden when not in any group / no peer
 *                          shares)
 *
 * Signed-out viewers see NOW + TODAY'S BEST only (the personalised
 * sections need a user id). They still get a sign-up CTA via the
 * share button in the header.
 */
export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const profile = await getCurrentProfile();
  const userId = profile?.id ?? null;

  // Fetch in parallel — each loader is its own query so the page's
  // tail latency tracks the slowest section, not the sum.
  const [nowShares, bestShares, destShares, followingShares, sharedToday] =
    await Promise.all([
      loadDvsNow(12),
      loadDvsTodaysBest(12),
      userId ? loadDvsForUserDestinations(userId, 20) : Promise.resolve([]),
      userId ? loadDvsFromFollowing(userId, 20) : Promise.resolve([]),
      userId ? hasSharedToday(userId) : Promise.resolve(false),
    ]);

  const totalShares =
    nowShares.length +
    bestShares.length +
    destShares.length +
    followingShares.length;

  return (
    <div className="relative flex flex-1 flex-col gap-6 px-4 pb-10 pt-[max(3rem,calc(env(safe-area-inset-top)+1.25rem))]">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Daily Vibe Feed</h1>
          <p className="mt-0.5 text-xs text-muted">
            Live shares from travelers across Wondavu.
          </p>
        </div>
        <FeedShareButton />
      </header>

      {/* Composer entry-point for signed-in users who haven't shared
          today. Sits at the top so it's the first thing they see. */}
      {userId && !sharedToday && (
        <Link
          href="/profile/share-vibe"
          className="wc-frame flex items-center justify-between rounded-2xl bg-sunset px-4 py-3 text-white shadow-card active:scale-[0.99]"
        >
          <span>
            <span className="block text-sm font-bold">
              + Share today&apos;s vibe
            </span>
            <span className="block text-[11px] font-medium text-white/85">
              Five quick questions — tips help the next traveler.
            </span>
          </span>
          <span className="text-lg">›</span>
        </Link>
      )}

      <DvsFeedSection
        icon="🔥"
        title="Now"
        subtitle="People currently traveling — last hour"
        shares={nowShares}
        emptyState="Nothing in the last hour. Come back soon — or share your own."
      />

      <DvsFeedSection
        icon="⭐"
        title="Today's best"
        subtitle="Highest-vibe shares from today"
        shares={bestShares}
        emptyState="No shares today yet."
      />

      <DvsFeedSection
        icon="📍"
        title="Your destinations"
        subtitle="Travelers in places you're planning"
        shares={destShares}
        hideWhenEmpty
        emptyState="Add a destination in your travel plans to see live tips from there."
      />

      <DvsFeedSection
        icon="👥"
        title="Following"
        subtitle="People in your travel groups"
        shares={followingShares}
        hideWhenEmpty
        emptyState="Join a group chat to see shares from fellow travelers here."
      />

      {/* Bottom safety net — only shows when literally zero shares
          exist anywhere. Keeps a brand-new install from looking dead. */}
      {totalShares === 0 && (
        <p className="rounded-2xl bg-surface px-4 py-6 text-center text-sm text-muted ring-1 ring-border">
          The community feed is just getting started.{" "}
          {userId ? (
            <Link
              href="/profile/share-vibe"
              className="font-bold text-glow underline"
            >
              Share the first vibe →
            </Link>
          ) : (
            "Sign up to be the first to share."
          )}
        </p>
      )}
    </div>
  );
}

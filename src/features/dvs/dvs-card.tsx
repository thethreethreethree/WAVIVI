"use client";

import Image from "next/image";
import Link from "next/link";
import { useState, useTransition } from "react";

import { toggleDvsLike } from "@/lib/dvs/actions";
import type { DvsShareDisplay } from "@/lib/dvs/types";

import { DvsCommentsThread } from "./dvs-comments-thread";

/**
 * Daily Vibe Share card — progressive disclosure with live engagement.
 *
 * COLLAPSED (default):
 *   • Author chip (avatar + handle + relative time)
 *   • Photo (or painted brand fallback when null) with caption overlay
 *   • Vibe rating + location + engagement counters
 *   • Heart (live toggle) · Comments badge · Tap-to-expand button
 *
 * EXPANDED:
 *   • Same header + photo
 *   • All five answers stacked: vibe, location, tip, costs, Q&A
 *   • Comments thread (lazy-loaded on first expand)
 *
 * The collapsed state stays tight (one screenful) so the feed scrolls
 * fast; expanded is the deep-dive view per the DVS spec.
 *
 * Engagement state (viewerLiked) is hydrated from the server via a
 * one-shot batch lookup at the page level, then maintained locally
 * with optimistic UI on every toggle so the heart feels instant.
 */
export function DvsCard({
  share,
  viewerId = null,
  viewerUsername = null,
  viewerAvatarUrl = null,
  viewerLiked = false,
}: {
  share: DvsShareDisplay;
  /** Signed-in viewer id, or null for anonymous viewers. */
  viewerId?: string | null;
  viewerUsername?: string | null;
  viewerAvatarUrl?: string | null;
  /** Whether the signed-in viewer has already liked this share. */
  viewerLiked?: boolean;
}) {
  const [expanded, setExpanded] = useState(false);
  const [liked, setLiked] = useState(viewerLiked);
  const [likeCount, setLikeCount] = useState(share.likeCount);
  const [pending, startTransition] = useTransition();

  const fullLocation = [share.locationLabel, share.cityLabel, share.regionLabel]
    .filter(Boolean)
    .join(", ");

  const hasCosts =
    share.costMeal != null ||
    share.costHotel != null ||
    share.costActivity != null;

  const hasQa = Boolean(share.qaQuestion && share.qaAnswer);

  function onToggleLike() {
    if (!viewerId) {
      // Anonymous viewer — the heart renders as a Link to /login below.
      // This handler shouldn't fire for them, but the guard stays as a
      // belt-and-suspenders defence so we don't hit toggleDvsLike with
      // no session and surface a misleading "Sign in to react" error.
      return;
    }
    // Optimistic flip — snap back if the server says no.
    const nextLiked = !liked;
    setLiked(nextLiked);
    setLikeCount((c) => Math.max(0, c + (nextLiked ? 1 : -1)));
    startTransition(async () => {
      const res = await toggleDvsLike(share.id);
      if (!res.ok) {
        setLiked(!nextLiked);
        setLikeCount((c) => Math.max(0, c + (nextLiked ? -1 : 1)));
      } else if (res.liked !== nextLiked) {
        // Server disagrees with our optimistic guess (e.g. user had
        // already liked from another device). Sync to truth.
        setLiked(res.liked);
        setLikeCount(share.likeCount + (res.liked ? 1 : 0));
      }
    });
  }

  return (
    <article className="wc-frame relative flex flex-col rounded-2xl bg-surface p-3 shadow-card">
      {/* Author chip */}
      <header className="mb-2 flex items-center gap-2.5">
        <Link
          href={`/u/${encodeURIComponent(share.authorUsername)}`}
          className="block h-9 w-9 shrink-0 overflow-hidden rounded-full bg-surface-elevated"
        >
          {share.authorAvatarUrl ? (
            <Image
              src={share.authorAvatarUrl}
              alt={share.authorDisplayName}
              width={36}
              height={36}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="flex h-full w-full items-center justify-center text-sm font-bold text-glow">
              {share.authorDisplayName.charAt(0).toUpperCase()}
            </span>
          )}
        </Link>
        <div className="min-w-0 flex-1">
          <Link
            href={`/u/${encodeURIComponent(share.authorUsername)}`}
            className="block truncate text-sm font-bold leading-tight text-foreground"
          >
            @{share.authorUsername}
          </Link>
          <p className="truncate text-[11px] leading-tight text-muted">
            {fullLocation || "Somewhere"} · {formatRelative(share.createdAt)}
          </p>
        </div>
        <VibeBadge rating={share.vibeRating} />
      </header>

      {/* Photo (or fallback) — caption overlays the bottom. */}
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        className="group relative block aspect-[4/5] w-full overflow-hidden rounded-xl bg-surface-elevated text-left"
      >
        {share.photoUrl ? (
          <Image
            src={share.photoUrl}
            alt={share.caption}
            fill
            sizes="448px"
            className="object-cover transition-transform group-hover:scale-[1.02]"
          />
        ) : (
          // Painted brand fallback when the traveler skipped the photo.
          // Same gradient family as the Instagram-thumb fix so missing
          // images never read as broken.
          <span
            aria-hidden
            className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#fdb86a] via-[#f6917c] to-[#c267a5] text-5xl"
          >
            🎈
          </span>
        )}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-3.5 pb-3 text-white">
          <p className="text-sm font-bold leading-snug drop-shadow">
            &ldquo;{share.caption}&rdquo;
          </p>
        </div>
      </button>

      {/* Engagement row */}
      <div className="mt-2 flex items-center gap-3 text-xs font-bold">
        {viewerId ? (
          <button
            type="button"
            onClick={onToggleLike}
            disabled={pending}
            aria-pressed={liked}
            aria-label={liked ? "Unlike" : "Like"}
            className={`flex items-center gap-1 transition-transform active:scale-90 disabled:opacity-50 ${
              liked ? "text-heat" : "text-muted"
            }`}
          >
            <span aria-hidden>{liked ? "❤" : "🤍"}</span>
            {formatCount(likeCount)}
          </button>
        ) : (
          // Signed-out viewers used to see a silent no-op heart. Now
          // it routes them to /login with a returnTo so they land
          // back on the feed and can like the share they wanted to.
          <Link
            href={`/login?next=${encodeURIComponent("/feed")}`}
            aria-label="Sign in to react"
            className="flex items-center gap-1 text-muted transition-transform active:scale-90"
          >
            <span aria-hidden>🤍</span>
            {formatCount(likeCount)}
          </Link>
        )}
        <button
          type="button"
          onClick={() => setExpanded(true)}
          className="flex items-center gap-1 text-muted"
        >
          <span aria-hidden>💬</span>
          {formatCount(share.commentCount)}
        </button>
        <span className="flex items-center gap-1 text-muted">
          <span aria-hidden>↗</span>
          {formatCount(share.shareCount)}
        </span>
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="ml-auto rounded-full bg-glow/10 px-3 py-1 text-[11px] font-bold text-glow active:scale-95"
        >
          {expanded ? "Collapse ▲" : "Tap to see all details ▼"}
        </button>
      </div>

      {/* Expanded body — all 5 answers + comments thread. */}
      {expanded && (
        <div className="mt-3 flex flex-col gap-3 text-sm">
          <Section icon="🎈" label="Vibe today">
            <p className="font-bold text-foreground">
              {"⭐".repeat(share.vibeRating)}{" "}
              <span className="font-normal text-muted">
                ({share.vibeRating}/5)
              </span>
            </p>
            <p className="text-foreground">&ldquo;{share.caption}&rdquo;</p>
          </Section>

          {fullLocation && (
            <Section icon="📍" label="Location">
              <p className="text-foreground">{fullLocation}</p>
            </Section>
          )}

          {share.tip && (
            <Section icon="💡" label="Tip for travelers">
              <p className="text-foreground">{share.tip}</p>
            </Section>
          )}

          {hasCosts && (
            <Section icon="💰" label="Real costs today">
              <p className="text-foreground">
                {[
                  share.costMeal != null
                    ? `Meal: ${fmtCost(share.costMeal, share.costCurrency)}`
                    : null,
                  share.costHotel != null
                    ? `Hotel: ${fmtCost(share.costHotel, share.costCurrency)}`
                    : null,
                  share.costActivity != null
                    ? `Activity: ${fmtCost(share.costActivity, share.costCurrency)}`
                    : null,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </Section>
          )}

          {hasQa && (
            <Section icon="❓" label="Traveler question">
              <p className="text-foreground">
                <span className="font-bold">Q:</span> &ldquo;{share.qaQuestion}&rdquo;
              </p>
              <p className="text-foreground">
                <span className="font-bold">A:</span> &ldquo;{share.qaAnswer}&rdquo;
              </p>
            </Section>
          )}

          {/* Lazy comments thread — mounted on expand so its
              /api/dvs/[shareId]/comments fetch only fires for cards
              the user actually opens. */}
          <DvsCommentsThread
            shareId={share.id}
            viewerId={viewerId}
            viewerUsername={viewerUsername}
            viewerAvatarUrl={viewerAvatarUrl}
          />
        </div>
      )}
    </article>
  );
}

/** One section inside the expanded card. Compact heading + body. */
function Section({
  icon,
  label,
  children,
}: {
  icon: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl bg-surface-elevated p-3 ring-1 ring-border">
      <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-muted">
        <span aria-hidden>{icon}</span> {label}
      </p>
      <div className="flex flex-col gap-1 text-sm">{children}</div>
    </section>
  );
}

/** Vibe rating chip — top-right of the header. */
function VibeBadge({ rating }: { rating: number }) {
  return (
    <span
      className="flex shrink-0 items-center gap-1 rounded-full bg-glow/15 px-2 py-0.5 text-xs font-bold text-glow"
      title={`${rating}/5 vibe`}
    >
      <span aria-hidden>🎈</span>
      {rating}/5
    </span>
  );
}

/** "2 mins ago" / "3 hours ago" / "2 days ago". UTC-stable; the
 *  difference math doesn't care about timezone. */
function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const now = Date.now();
  const sec = Math.max(0, Math.floor((now - then) / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

/** "2.4K" / "156" — same shape as the existing feed counters. */
function formatCount(n: number): string {
  if (n < 1000) return String(n);
  if (n < 10_000) return `${(n / 1000).toFixed(1)}K`;
  if (n < 1_000_000) return `${Math.round(n / 1000)}K`;
  return `${(n / 1_000_000).toFixed(1)}M`;
}

/** Render a cost with its currency. Free activity → "Free". */
function fmtCost(amount: number, currency: string | null): string {
  if (amount === 0) return "Free";
  const code = currency ?? "";
  return `${amount.toLocaleString()} ${code}`.trim();
}

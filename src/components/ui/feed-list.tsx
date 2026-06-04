"use client";

import Image from "next/image";
import { useRef, useState } from "react";

import { Icon } from "@/components/ui/icon";
import type { FeedDisplayPost } from "@/lib/feed/server";

/**
 * Client side of the Travelers Feed — same visual language as the
 * original mock-driven version (worn-paper frame, photo with caption
 * overlay, like / comment / share row). Lifted out so the page itself
 * can be a Server Component that does the DB fetch.
 *
 * `isMockFallback` is forwarded so we can dim the engagement row on
 * seed cards (those numbers aren't backed by anything — they were
 * design placeholders). On real DB posts the buttons stay live.
 */
export function FeedList({
  posts,
  isMockFallback,
}: {
  posts: FeedDisplayPost[];
  isMockFallback: boolean;
}) {
  return (
    <div className="flex flex-col gap-5">
      {posts.map((post) => (
        <FeedItem key={post.id} post={post} isMock={isMockFallback} />
      ))}
    </div>
  );
}

/** Character ceiling for the collapsed caption. Past this we show a
 *  "more" toggle so the caption never grows tall enough to cover the
 *  photo. Picked by eye to fit ~2 lines at the existing text-sm size
 *  on a 448px-wide card without wrapping into a third line. */
const CAPTION_COLLAPSED_CHARS = 90;

function FeedItem({
  post,
  isMock,
}: {
  post: FeedDisplayPost;
  isMock: boolean;
}) {
  const [liked, setLiked] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const captionNeedsTruncate = post.caption.length > CAPTION_COLLAPSED_CHARS;
  const captionShown =
    expanded || !captionNeedsTruncate
      ? post.caption
      : // Cut at the last space before the limit so we don't slice a word
        // in half — "Lost in the magic of El Nido's hidden lago…" beats
        // "Lost in the magic of El Nido's hidden lagoo…".
        post.caption.slice(0, CAPTION_COLLAPSED_CHARS).replace(/\s+\S*$/, "") +
        "…";

  // Per direction (2026-06-04 screenshot): @handle is the IG escape
  // hatch, NOT the photo. Photo area is reserved for the inline video
  // player so its play button does the right thing. The handle links
  // straight to instagram.com/<handle>/ — the universal convention is
  // "@username → user profile," and we already have the handle.
  const igProfileUrl = `https://www.instagram.com/${encodeURIComponent(post.handle)}/`;

  return (
    <article className="wc-frame relative rounded-2xl p-2.5">
      {/* Photo (or video, when set) with caption overlay. */}
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl">
        <FeedMedia post={post} />
        <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />

        {/* Caption pinned to the bottom of the photo. pointer-events:none
            on the wrapper so the caption box doesn't intercept taps meant
            for the video's native controls underneath — the @handle link
            and the "more" button re-enable pointer events on themselves. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-3.5 pb-3 text-white">
          <a
            href={igProfileUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open @${post.handle} on Instagram`}
            className="pointer-events-auto flex items-center gap-1.5 text-sm font-bold transition-opacity active:opacity-70"
          >
            @{post.handle}
            {post.verified && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-glow text-[9px]">
                ✓
              </span>
            )}
          </a>
          <p className="mt-1 text-sm leading-snug">
            {captionShown}
            {captionNeedsTruncate && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setExpanded((v) => !v);
                }}
                className="pointer-events-auto ml-1 font-bold underline-offset-2 hover:underline"
                aria-expanded={expanded}
              >
                {expanded ? "less" : "more"}
              </button>
            )}
          </p>
          {post.location && (
            <p className="mt-1 flex items-center gap-1 text-xs text-white/85">
              📍 {post.location}
            </p>
          )}
        </div>
      </div>

      {/* Action row under the photo. Dimmed when this is a mock-seed
          card — those numbers were design placeholders, not data. */}
      <div
        className={`mt-2.5 flex items-center gap-5 px-1 text-foreground ${
          isMock ? "opacity-60" : ""
        }`}
      >
        <button
          type="button"
          onClick={() => setLiked((l) => !l)}
          className="flex items-center gap-1.5 transition-transform active:scale-95"
          aria-label="Like"
        >
          <span
            className={`flex h-8 w-8 items-center justify-center rounded-full ${
              liked ? "bg-heat text-white" : "bg-border/60 text-foreground"
            }`}
          >
            <Icon name="heart" className="h-4 w-4" strokeWidth={2} />
          </span>
          <span className="text-xs font-bold">{post.likes}</span>
        </button>
        <span className="flex items-center gap-1.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-border/60">
            <Icon name="comment" className="h-4 w-4" strokeWidth={2} />
          </span>
          <span className="text-xs font-bold">{post.comments}</span>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="flex h-8 w-8 items-center justify-center rounded-full bg-border/60">
            <Icon name="share" className="h-4 w-4" strokeWidth={2} />
          </span>
          <span className="text-xs font-bold">{post.shares}</span>
        </span>
      </div>
    </article>
  );
}

/**
 * Photo or inline video for a feed card.
 *
 * Pre-tap state: the poster image (post.image) renders just like a
 * still post would, plus a centered ▶ button overlaid in the middle.
 * The button is the affordance — the user taps it to start playback.
 * Native browser controls (play / pause / seek / fullscreen / volume)
 * then take over for the duration of playback.
 *
 * Why poster-then-swap instead of always rendering <video>:
 *   - <video preload="none"> still requests metadata on some Safari
 *     versions, which means 50 cards in a feed = 50 metadata pings
 *     before the user has touched anything. The poster image is
 *     already loaded for layout; we don't mount <video> until the
 *     user actually wants to play.
 *   - The <Image> path also gets next/image optimization (responsive
 *     sizes, lazy-load, format negotiation) which <video poster=>
 *     does not.
 *
 * No autoplay — explicit user direction. Each video starts only when
 * the user taps. If they scroll to a new card, the browser pauses the
 * old <video> automatically when it leaves the viewport's audio focus
 * (the inline player is its own element; nothing reaches across cards).
 */
function FeedMedia({ post }: { post: FeedDisplayPost }) {
  const [playing, setPlaying] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Still-only posts (no video_url): pure image, no play affordance.
  if (!post.videoUrl) {
    return (
      <Image
        src={post.image}
        alt={post.caption}
        fill
        sizes="448px"
        className="object-cover"
      />
    );
  }

  if (!playing) {
    return (
      <button
        type="button"
        onClick={() => {
          setPlaying(true);
          // Defer to the next frame so the <video> mounts before we
          // try to play() it. iOS Safari is picky about play() being
          // called synchronously with user interaction; the ref will
          // exist on the next paint.
          requestAnimationFrame(() => {
            videoRef.current?.play().catch(() => {
              // Autoplay-with-sound restrictions vary; if play()
              // throws we leave the controls visible so the user can
              // hit play themselves.
            });
          });
        }}
        aria-label="Play video"
        className="group absolute inset-0 block"
      >
        <Image
          src={post.image}
          alt={post.caption}
          fill
          sizes="448px"
          className="object-cover"
        />
        {/* Center play button — sits above the gradient so it stays
            visible even when the bottom caption overlay is dark. */}
        <span
          aria-hidden
          className="pointer-events-none absolute left-1/2 top-1/2 flex h-16 w-16 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-black/55 text-white shadow-lg ring-2 ring-white/80 backdrop-blur-sm transition-transform group-active:scale-95 group-hover:scale-105"
        >
          {/* Off-center triangle so the visual play icon reads as
              centered rather than left-leaning (the optical-center
              correction every play button needs). */}
          <svg
            viewBox="0 0 24 24"
            fill="currentColor"
            className="ml-1 h-6 w-6"
          >
            <path d="M8 5v14l11-7z" />
          </svg>
        </span>
      </button>
    );
  }

  return (
    <video
      ref={videoRef}
      src={post.videoUrl}
      poster={post.image}
      controls
      playsInline
      preload="metadata"
      className="absolute inset-0 h-full w-full object-cover"
    />
  );
}

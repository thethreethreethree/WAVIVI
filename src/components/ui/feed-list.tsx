"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

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

  // If the source carried an Instagram post URL, the photo behaves as a
  // tap target that opens the original post in a new tab. This is the
  // "fix" for the play-triangle baked into IG video thumbnails — the
  // image LOOKS clickable, so clicking now does the most useful thing
  // we can do without hosting video ourselves. Falls back to a static
  // image when there's no source URL.
  const igLink = post.igPostUrl;

  const photoBody = (
    <>
      <Image
        src={post.image}
        alt={post.caption}
        fill
        sizes="448px"
        className="object-cover"
      />
      <span className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />
    </>
  );

  return (
    <article className="wc-frame relative rounded-2xl p-2.5">
      {/* Photo with caption overlay — worn paper look via wc-frame above */}
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl">
        {igLink ? (
          <a
            href={igLink}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open @${post.handle}'s original Instagram post`}
            className="absolute inset-0 block"
          >
            {photoBody}
          </a>
        ) : (
          photoBody
        )}

        {/* Caption pinned to the bottom of the photo. pointer-events:none
            on the wrapper so the caption box doesn't intercept taps meant
            for the IG link above — the inner Link / button re-enable
            pointer events only where they're needed. */}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 px-3.5 pb-3 text-white">
          <Link
            href={`/u/${post.handle}`}
            className="pointer-events-auto flex items-center gap-1.5 text-sm font-bold transition-opacity active:opacity-70"
          >
            @{post.handle}
            {post.verified && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-glow text-[9px]">
                ✓
              </span>
            )}
          </Link>
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

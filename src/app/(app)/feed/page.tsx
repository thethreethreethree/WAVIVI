"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { Icon } from "@/components/ui/icon";
import { type FeedPost, feedPosts } from "@/lib/travejor/feed";

/**
 * Traveler feed — a vertical stack of watercolor-framed post cards.
 *
 * Designed to clear the iOS status bar (safe-area top inset) and the
 * floating bottom nav, with each card sized so the system chrome stays
 * visible. Posts no longer take the full viewport — they read like a
 * worn-paper photo journal.
 */
export default function FeedPage() {
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

      <div className="flex flex-col gap-5">
        {feedPosts.map((post) => (
          <FeedItem key={post.id} post={post} />
        ))}
      </div>

      <Link
        href="#"
        aria-label="Create post"
        className="fixed bottom-24 right-4 z-30 flex h-12 w-12 items-center
                   justify-center rounded-full bg-glow text-2xl text-white shadow-lg
                   active:scale-95"
      >
        +
      </Link>
    </div>
  );
}

function FeedItem({ post }: { post: FeedPost }) {
  const [liked, setLiked] = useState(false);

  return (
    <article className="wc-frame relative rounded-2xl p-2.5">
      {/* Photo with caption overlay — worn paper look via wc-frame above */}
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl">
        <Image
          src={post.image}
          alt={post.caption}
          fill
          sizes="448px"
          className="object-cover"
        />
        <span className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent" />

        {/* Caption pinned to the bottom of the photo */}
        <div className="absolute inset-x-0 bottom-0 px-3.5 pb-3 text-white">
          <Link
            href={`/u/${post.handle}`}
            className="flex items-center gap-1.5 text-sm font-bold transition-opacity active:opacity-70"
          >
            @{post.handle}
            {post.verified && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-glow text-[9px]">
                ✓
              </span>
            )}
          </Link>
          <p className="mt-1 text-sm leading-snug">{post.caption}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-white/85">
            📍 {post.location}
          </p>
        </div>
      </div>

      {/* Action row under the photo */}
      <div className="mt-2.5 flex items-center gap-5 px-1 text-foreground">
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

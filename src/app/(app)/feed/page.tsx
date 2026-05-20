"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";

import { Icon } from "@/components/ui/icon";
import { type FeedPost, feedPosts } from "@/lib/travejor/feed";

export default function FeedPage() {
  return (
    <div className="relative flex-1">
      <div className="absolute right-4 top-4 z-20">
        <button
          type="button"
          aria-label="Share"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur"
        >
          <svg
            viewBox="0 0 24 24"
            className="h-4.5 w-4.5"
            fill="currentColor"
            aria-hidden
          >
            <path d="M2 12l19-9-9 19-2-8-8-2z" />
          </svg>
        </button>
      </div>

      <div className="h-[calc(100dvh-4.75rem)] snap-y snap-mandatory overflow-y-auto">
        {feedPosts.map((post) => (
          <FeedItem key={post.id} post={post} />
        ))}
      </div>

      <button
        type="button"
        aria-label="Create post"
        className="absolute bottom-4 right-4 z-20 flex h-12 w-12 items-center
                   justify-center rounded-full bg-glow text-2xl text-white shadow-lg"
      >
        +
      </button>
    </div>
  );
}

function FeedItem({ post }: { post: FeedPost }) {
  const [liked, setLiked] = useState(false);

  return (
    <article className="wc-frame relative h-[calc(100dvh-4.75rem)] w-full snap-start p-2">
      <span className="relative block h-full w-full overflow-hidden rounded-xl">
        <Image
          src={post.image}
          alt={post.caption}
          fill
          sizes="448px"
          className="object-cover"
        />
        <span className="absolute inset-0 bg-gradient-to-t from-black/75 via-transparent to-black/20" />
      </span>

      {/* Action rail */}
      <div className="absolute bottom-28 right-3 flex flex-col items-center gap-5 text-white">
        <button
          type="button"
          onClick={() => setLiked((l) => !l)}
          className="flex flex-col items-center gap-1"
          aria-label="Like"
        >
          <span
            className={`flex h-11 w-11 items-center justify-center rounded-full backdrop-blur ${
              liked ? "bg-heat" : "bg-black/40"
            }`}
          >
            <Icon name="heart" className="h-5 w-5" strokeWidth={1.9} />
          </span>
          <span className="text-xs font-semibold">{post.likes}</span>
        </button>
        <span className="flex flex-col items-center gap-1">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur">
            <Icon name="comment" className="h-5 w-5" strokeWidth={1.9} />
          </span>
          <span className="text-xs font-semibold">{post.comments}</span>
        </span>
        <span className="flex flex-col items-center gap-1">
          <span className="flex h-11 w-11 items-center justify-center rounded-full bg-black/40 backdrop-blur">
            <Icon name="share" className="h-5 w-5" strokeWidth={1.9} />
          </span>
          <span className="text-xs font-semibold">{post.shares}</span>
        </span>
      </div>

      {/* Caption */}
      <div className="absolute inset-x-0 bottom-6 px-4 text-white">
        <Link
          href={`/u/${post.handle}`}
          className="flex items-center gap-1.5 text-base font-bold transition-opacity active:opacity-70"
        >
          @{post.handle}
          {post.verified && (
            <span className="flex h-4 w-4 items-center justify-center rounded-full bg-glow text-[9px]">
              ✓
            </span>
          )}
        </Link>
        <p className="mt-1 max-w-[80%] text-sm">{post.caption}</p>
        <p className="mt-1.5 flex items-center gap-1 text-xs text-white/80">
          📍 {post.location}
        </p>
      </div>
    </article>
  );
}

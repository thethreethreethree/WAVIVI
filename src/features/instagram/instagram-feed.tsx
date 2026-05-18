import Image from "next/image";

import { InstagramIcon } from "@/features/instagram/instagram-icon";
import type { InstagramPost } from "@/features/instagram/types";

/**
 * Travel Feed — a swipeable carousel of a traveler's Instagram posts.
 *
 * Horizontal scroll-snap keeps the profile compact: one post in focus at a
 * time, swipe for the next. Same Instagram source as the showcase grid;
 * lightweight preview cards keep it fast on weak data.
 */
export function InstagramFeed({
  posts,
  username,
}: {
  posts: InstagramPost[];
  username: string;
}) {
  if (posts.length === 0) {
    return (
      <p className="wc-frame-ghost rounded-2xl px-4 py-8 text-center text-sm text-muted">
        No travel posts yet — connect Instagram to bring this feed to life.
      </p>
    );
  }

  return (
    <div
      className="-mx-5 flex snap-x snap-mandatory gap-3 overflow-x-auto px-5 pb-1
                 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
    >
      {posts.map((post) => (
        <a
          key={post.id}
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          className="wc-frame group relative w-[78%] shrink-0 snap-center rounded-2xl p-2"
        >
          {/* Crisp, undistorted photo inside the painted frame */}
          <span className="relative block overflow-hidden rounded-xl">
            <span className="relative block aspect-[4/5] w-full">
              <Image
                src={post.image}
                alt="Instagram travel post"
                fill
                loading="lazy"
                sizes="340px"
                className="object-cover transition-transform group-hover:scale-105"
              />
            </span>
            <span className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-black/15" />
            <span className="absolute right-3 top-3 text-white">
              <InstagramIcon className="h-5 w-5" />
            </span>
            <span className="absolute bottom-3 left-3 flex items-center gap-1.5 text-sm font-bold text-white">
              @{username}
              <span className="text-xs font-medium text-white/80">
                · View on Instagram
              </span>
            </span>
          </span>
        </a>
      ))}
    </div>
  );
}

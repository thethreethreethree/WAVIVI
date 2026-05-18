import Image from "next/image";

import { InstagramIcon } from "@/features/instagram/instagram-icon";
import type { InstagramPost } from "@/features/instagram/types";

/**
 * Featured Travel Moments — a lightweight preview grid of selected posts.
 *
 * Preview cards (not live embeds) are the default: they load fast on weak
 * hostel WiFi and store no media. For true embeds, swap in `InstagramEmbed`.
 * Capped at 6 per the performance rules.
 */
export function InstagramShowcase({ posts }: { posts: InstagramPost[] }) {
  const shown = posts.slice(0, 6);
  if (shown.length === 0) return null;

  return (
    <div className="grid grid-cols-3 gap-2">
      {shown.map((post) => (
        <a
          key={post.id}
          href={post.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group relative aspect-square overflow-hidden rounded-xl ring-1 ring-border"
        >
          <Image
            src={post.image}
            alt="Instagram travel moment"
            fill
            loading="lazy"
            sizes="120px"
            className="object-cover transition-transform group-hover:scale-105"
          />
          <span className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
          <span className="absolute right-1.5 top-1.5 text-white">
            <InstagramIcon className="h-4 w-4" />
          </span>
        </a>
      ))}
    </div>
  );
}

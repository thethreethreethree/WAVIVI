import { InstagramThumb } from "@/features/instagram/instagram-thumb";
import type { InstagramPost } from "@/features/instagram/types";

/**
 * Featured Travel Moments — a lightweight preview grid of selected posts.
 *
 * Preview cards (not live embeds) are the default: they load fast on weak
 * hostel WiFi and store no media. For true embeds, swap in `InstagramEmbed`.
 * Capped at 6 per the performance rules.
 *
 * Thumbnail rendering goes through `InstagramThumb` so missing /
 * broken-source tiles fall back to a self-contained brand gradient
 * instead of the broken-image icon (was a regression caused by
 * picsum.photos rate-limiting Vercel's image optimizer).
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
          className="wc-frame group relative aspect-square rounded-xl p-1.5"
        >
          <span className="relative block h-full w-full overflow-hidden rounded-lg">
            <InstagramThumb
              src={post.image}
              alt="Instagram travel moment"
              badgeSize="h-4 w-4"
            />
          </span>
        </a>
      ))}
    </div>
  );
}

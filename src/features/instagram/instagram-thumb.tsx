"use client";

import { useState } from "react";

import { InstagramIcon } from "@/features/instagram/instagram-icon";

/**
 * Thumbnail renderer for an Instagram post tile that DOES NOT depend on
 * any third-party placeholder service.
 *
 * Previously the showcase + feed both rendered `<Image src={picsumUrl}>`
 * when no real Instagram thumbnail was stored. Picsum.photos rate-limits
 * Vercel's image optimizer, so a fresh web session would render the
 * broken-image SVG + alt text. PWA-cached mobile sessions kept working
 * because the prior successful fetch was still in the service-worker
 * cache, which is why the symptom looked "broken on web but not on
 * mobile."
 *
 * This component takes the thumbnail src (or null) and:
 *  - renders the image when src is a real URL
 *  - swaps to a self-contained CSS fallback (gradient + Instagram glyph)
 *    when src is null OR the image errors on load
 *
 * Uses a plain <img> instead of next/image so we can run onError + so
 * the fallback never depends on the optimizer round-trip. The visual
 * weight is small (≤340px), so optimization isn't critical here.
 */
export function InstagramThumb({
  src,
  alt,
  badgeSize = "h-4 w-4",
}: {
  src: string | null;
  alt: string;
  /** Tailwind class for the corner Instagram badge. */
  badgeSize?: string;
}) {
  const [failed, setFailed] = useState(false);
  const showFallback = !src || failed;

  return (
    <>
      {!showFallback && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={alt}
          loading="lazy"
          decoding="async"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className="absolute inset-0 h-full w-full object-cover transition-transform group-hover:scale-105"
        />
      )}
      {showFallback && (
        // Brand-coloured fallback: warm-orange → pink gradient evokes the
        // Instagram identity without copying it, an Instagram glyph keeps
        // the affordance clear, no remote asset required.
        <span
          aria-hidden
          className="absolute inset-0 flex items-center justify-center bg-gradient-to-br from-[#fdb86a] via-[#f6917c] to-[#c267a5] text-white/90"
        >
          <InstagramIcon className="h-1/3 w-1/3 opacity-80" />
        </span>
      )}
      {/* Subtle darkening so any overlaid badges / text stay readable. */}
      <span
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black/55 via-transparent to-black/15"
      />
      <span className="absolute right-3 top-3 text-white">
        <InstagramIcon className={badgeSize} />
      </span>
    </>
  );
}

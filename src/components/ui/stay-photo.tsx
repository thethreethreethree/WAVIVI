"use client";

import { useState } from "react";

import { photoThumb } from "@/lib/utils/images";

/**
 * Photo thumbnail that swaps to a 🏠 emoji if the remote image fails.
 * Google's lh3.googleusercontent.com URLs 403 on hotlinks unless we send
 * no referrer, so we set referrerPolicy explicitly.
 *
 * `width` requests a downsized image from hosts that support it (see
 * photoThumb) — defaults to a cover-sized 800px. Images lazy-load and decode
 * off the main thread, and fade in over a shimmer skeleton so long lists
 * stay responsive and don't pop in abruptly.
 */
export function StayPhoto({
  src,
  alt,
  className,
  emojiSize = "text-2xl",
  width = 800,
}: {
  src: string | null;
  alt: string;
  className?: string;
  emojiSize?: string;
  width?: number;
}) {
  const [failed, setFailed] = useState(false);
  const [loaded, setLoaded] = useState(false);

  if (!src || failed) {
    return (
      <span
        className={`flex h-full w-full items-center justify-center bg-background ${className ?? ""}`}
      >
        <span className={emojiSize} aria-hidden>
          🏠
        </span>
      </span>
    );
  }
  return (
    <>
      {/* Shimmer skeleton — sits behind the image until it decodes. */}
      {!loaded && (
        <span
          className="absolute inset-0 skeleton-shimmer"
          aria-hidden
        />
      )}
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={photoThumb(src, width)}
        alt={alt}
        loading="lazy"
        decoding="async"
        referrerPolicy="no-referrer"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
        className={`h-full w-full object-cover transition-opacity duration-500 ${
          loaded ? "opacity-100" : "opacity-0"
        } ${className ?? ""}`}
      />
    </>
  );
}

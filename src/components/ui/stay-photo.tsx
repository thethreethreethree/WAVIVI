"use client";

import { useState } from "react";

/**
 * Photo thumbnail that swaps to a 🏠 emoji if the remote image fails.
 * Google's lh3.googleusercontent.com URLs 403 on hotlinks unless we send
 * no referrer, so we set referrerPolicy explicitly.
 */
export function StayPhoto({
  src,
  alt,
  className,
  emojiSize = "text-2xl",
}: {
  src: string | null;
  alt: string;
  className?: string;
  emojiSize?: string;
}) {
  const [failed, setFailed] = useState(false);
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
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
      className={`h-full w-full object-cover ${className ?? ""}`}
    />
  );
}

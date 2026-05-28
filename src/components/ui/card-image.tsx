"use client";

import Image, { type ImageProps } from "next/image";
import { useState } from "react";

/** next/image wrapper that gracefully degrades to a soft watercolor
 *  swatch when the remote image fails (404, 504, blocked, etc.) instead
 *  of leaving a broken card. Used on the home "Recommended for you"
 *  rail where the photo source can be anything from Supabase Storage
 *  to a legacy picsum placeholder. */
export function CardImage(props: ImageProps) {
  const [failed, setFailed] = useState(false);
  if (failed) {
    return (
      <span
        aria-label={typeof props.alt === "string" ? props.alt : undefined}
        className="flex h-full w-full items-center justify-center bg-surface text-3xl text-muted"
      >
        🌅
      </span>
    );
  }
  return <Image {...props} onError={() => setFailed(true)} />;
}

"use client";

import { useCallback, useEffect, useRef, useState } from "react";

import { StayPhoto } from "./stay-photo";

/**
 * Swipeable hero photo gallery for stay detail pages.
 *
 * Renders a horizontal scroll-snap container with one image per pane plus a
 * dots indicator. Native CSS scroll-snap handles touch, trackpad, and mouse
 * drag — no carousel library needed. When only a single photo is supplied
 * we render `<StayPhoto>` directly so the layout doesn't change.
 *
 * The container is meant to be dropped inside an existing relative-positioned
 * hero box; it fills 100% of that box.
 */
export function StayPhotoGallery({
  photos,
  alt,
  emojiSize = "text-5xl",
}: {
  photos: string[];
  alt: string;
  emojiSize?: string;
}) {
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [active, setActive] = useState(0);

  // Track which slide is currently in view. Run on scroll + mount so the
  // dots stay correct as the user swipes.
  const updateActive = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const w = el.clientWidth || 1;
    setActive(Math.round(el.scrollLeft / w));
  }, []);

  useEffect(() => {
    updateActive();
  }, [updateActive]);

  // Single-photo case — bypass the carousel chrome entirely. Placed after
  // hooks so the hook order stays stable across renders.
  if (photos.length <= 1) {
    return <StayPhoto src={photos[0] ?? null} alt={alt} emojiSize={emojiSize} />;
  }

  function jumpTo(i: number) {
    const el = scrollerRef.current;
    if (!el) return;
    el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  }

  return (
    <>
      <div
        ref={scrollerRef}
        onScroll={updateActive}
        className="flex h-full w-full snap-x snap-mandatory overflow-x-auto overflow-y-hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {photos.map((src, i) => (
          <div
            key={`${i}-${src}`}
            className="relative h-full w-full shrink-0 snap-center"
          >
            <StayPhoto src={src} alt={`${alt} — ${i + 1}`} emojiSize={emojiSize} />
          </div>
        ))}
      </div>

      {/* Dots indicator — tap to jump between photos. Sits high enough above
          the existing amenity strip on the stay hero so the two don't
          collide; pointer-events-none on the wrapper, auto on the buttons. */}
      <div className="pointer-events-none absolute inset-x-0 bottom-16 z-20 flex justify-center gap-1.5">
        {photos.map((_, i) => (
          <button
            key={i}
            type="button"
            onClick={() => jumpTo(i)}
            aria-label={`Show photo ${i + 1}`}
            className={`pointer-events-auto h-1.5 rounded-full bg-white/95 shadow-card transition-all ${
              i === active ? "w-6" : "w-1.5 opacity-60"
            }`}
          />
        ))}
      </div>

      {/* Photo counter — small pill top-right so users see how many they can
          swipe through. Hidden when only a single photo. */}
      <span className="absolute right-3 top-3 z-20 rounded-full bg-black/45 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">
        {active + 1} / {photos.length}
      </span>
    </>
  );
}

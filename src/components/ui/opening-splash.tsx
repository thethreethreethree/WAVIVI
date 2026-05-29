"use client";

import { useEffect, useRef, useState } from "react";

const SHOWN_KEY = "wavivi:opening-shown";
/** Hard cap so a broken/slow video never traps the user behind the splash.
 *  Set to ~1s longer than the actual video length (6s) so the natural
 *  `onEnded` always fires first under normal conditions. */
const MAX_DURATION_MS = 7000;

/**
 * Full-viewport opening animation, painted from the very first frame —
 * the markup is rendered server-side so there's no flash of home before
 * the splash takes over. A synchronous inline `<script>` in the root
 * layout's <head> adds `splash-hide` to <html> for return visitors
 * (sessionStorage flag), and the CSS rule in globals.css hides this
 * overlay accordingly *before* paint.
 *
 * The splash is intentionally **not dismissible** — no click-to-skip — so
 * every first-time visitor sees the brand intro in full. The only exits
 * are the video's natural `onEnded`, an `onError` (broken file), or the
 * 7s safety timer (slow connection).
 *
 * We try to autoplay *with sound* first. Most browsers block unmuted
 * autoplay without a user gesture; when they do, the play() promise
 * rejects, and we fall back to muted autoplay so the visuals still run.
 */
export function OpeningSplash() {
  const [closing, setClosing] = useState(false);
  const [unmounted, setUnmounted] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    // Returning visitor — the inline head script already CSS-hid this
    // overlay before paint, so the user has not seen us. Tear down quietly.
    if (sessionStorage.getItem(SHOWN_KEY)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time guard against rendering the video element
      setUnmounted(true);
      return;
    }
    sessionStorage.setItem(SHOWN_KEY, "1");

    const v = videoRef.current;
    if (v) {
      v.muted = false;
      v.play().catch(() => {
        // Autoplay with sound was blocked — retry muted so the video still
        // plays. Visitors can experience the audio after their first tap
        // anywhere in the app on subsequent sessions if we ever decide to
        // re-show the splash.
        v.muted = true;
        v.play().catch(() => {
          /* even muted autoplay failed; safety timer will close us */
        });
      });
    }

    const safety = window.setTimeout(close, MAX_DURATION_MS);
    return () => window.clearTimeout(safety);
  }, []);

  function close() {
    setClosing(true);
    // Match the CSS fade-out duration before unmounting.
    window.setTimeout(() => setUnmounted(true), 350);
  }

  if (unmounted) return null;

  return (
    <div
      role="presentation"
      className={`opening-splash fixed inset-0 z-[100] flex items-center justify-center bg-background transition-opacity duration-300 ${
        closing ? "opacity-0" : "opacity-100"
      }`}
    >
      <video
        ref={videoRef}
        src="/decor/opening.mp4"
        poster="/decor/opening-poster.jpg"
        autoPlay
        playsInline
        preload="auto"
        onEnded={close}
        onError={close}
        className="h-full w-full object-cover"
      />
    </div>
  );
}

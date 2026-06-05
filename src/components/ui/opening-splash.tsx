"use client";

import { useEffect, useState } from "react";

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
 * **Tap to skip.** Users on slow connections or who've seen enough can
 * tap anywhere on the splash to dismiss it. The "no click-to-skip" rule
 * was a brand-experience preference that lost to a "page loads
 * incredibly slow" report — letting users out of the 6-second video
 * dominates the brand win when the cold-load impression is the
 * primary criticism. Natural `onEnded` still fires for users who let
 * it play through. 7s safety timer still kicks in on broken video.
 *
 * The video is **muted** because browser autoplay policies block sound
 * without a prior user gesture — trying to play unmuted first and falling
 * back to muted caused a visible glitch (browser blocks → poster sits →
 * JS retries muted → finally plays). Smooth playback wins; if we want
 * sound later it needs an explicit "Tap to start" gate.
 */
export function OpeningSplash() {
  const [closing, setClosing] = useState(false);
  const [unmounted, setUnmounted] = useState(false);

  useEffect(() => {
    // Returning visitor — the inline head script already CSS-hid this
    // overlay before paint, so the user has not seen us. Tear down quietly.
    if (sessionStorage.getItem(SHOWN_KEY)) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time guard against rendering the video element
      setUnmounted(true);
      return;
    }
    sessionStorage.setItem(SHOWN_KEY, "1");

    const safety = window.setTimeout(close, MAX_DURATION_MS);
    return () => window.clearTimeout(safety);
  }, []);

  function close() {
    // Reveal the app content underneath. The inline <head> script added
    // `.splash-active` to <html> for first-time visitors, which hid every
    // direct body child except the splash itself; clearing it now lets the
    // shell fade in beneath the splash's opacity transition.
    document.documentElement.classList.remove("splash-active");
    setClosing(true);
    // Match the CSS fade-out duration before unmounting.
    window.setTimeout(() => setUnmounted(true), 350);
  }

  if (unmounted) return null;

  return (
    <button
      type="button"
      onClick={close}
      aria-label="Skip intro"
      className={`opening-splash fixed inset-0 z-[100] flex items-center justify-center bg-background transition-opacity duration-300 ${
        closing ? "opacity-0" : "opacity-100"
      }`}
    >
      <video
        src="/decor/opening.mp4"
        poster="/decor/opening-poster.jpg"
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={close}
        onError={close}
        /* Absolute positioning so iOS Safari can't substitute the
         * video's intrinsic aspect ratio for the requested height.
         * h-full on a <video> in a flex column is ignored on iOS and
         * the element collapses to width × (videoH/videoW), leaving a
         * white band wherever it doesn't reach the viewport edge.
         * Absolute + inset-0 forces the element box to fill the
         * splash; object-fit:cover handles the aspect mismatch by
         * cropping the content, not the box.
         *
         * pointer-events:none so the tap-to-skip button below the
         * video element catches the click — without this the <video>
         * eats the tap and `close` never fires. */
        className="pointer-events-none absolute inset-0 h-full w-full object-cover"
      />
      {/* Small "tap to skip" hint at the bottom — visible from the
          first frame so users who showed up impatient can act, but
          quiet enough (60% opacity, 11px) that brand-conscious
          first-timers can ignore it and let the video play through.
          pointer-events:none so clicks pass through to the parent
          <button>'s onClick handler. */}
      <span
        aria-hidden
        className="pointer-events-none absolute bottom-[max(2rem,calc(env(safe-area-inset-bottom)+1.5rem))] left-1/2 -translate-x-1/2 text-[11px] font-semibold uppercase tracking-[0.18em] text-white/60 drop-shadow"
      >
        Tap to skip
      </span>
    </button>
  );
}

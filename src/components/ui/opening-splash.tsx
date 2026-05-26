"use client";

import { useEffect, useRef, useState } from "react";

const SHOWN_KEY = "wavivi:opening-shown";
/** Hard cap so a broken/slow video never traps the user behind the splash. */
const MAX_DURATION_MS = 7000;

/**
 * Full-viewport opening animation that plays once per browser session
 * (sessionStorage flag). Fades out when the video ends, on tap, or after
 * MAX_DURATION_MS as a safety. Renders nothing on subsequent navigations.
 *
 * Autoplay requires the video to be muted + playsInline (iOS); both are
 * set below.
 */
export function OpeningSplash() {
  // Default to hidden — we flip to visible on mount only if this session
  // hasn't seen the splash yet. Hiding-by-default avoids a flash on
  // already-shown sessions.
  const [visible, setVisible] = useState(false);
  const [closing, setClosing] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (sessionStorage.getItem(SHOWN_KEY)) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- one-time session-flag read; can't run during SSR render
    setVisible(true);
    sessionStorage.setItem(SHOWN_KEY, "1");

    const safety = window.setTimeout(() => close(), MAX_DURATION_MS);
    return () => window.clearTimeout(safety);
  }, []);

  function close() {
    setClosing(true);
    // Match the CSS fade-out duration before unmounting.
    window.setTimeout(() => setVisible(false), 350);
  }

  if (!visible) return null;

  return (
    <div
      role="presentation"
      onClick={close}
      className={`fixed inset-0 z-[100] flex items-center justify-center bg-background transition-opacity duration-300 ${
        closing ? "opacity-0" : "opacity-100"
      }`}
    >
      <video
        ref={videoRef}
        src="/decor/opening.mp4"
        autoPlay
        muted
        playsInline
        preload="auto"
        onEnded={close}
        onError={close}
        className="h-full w-full object-cover"
      />
    </div>
  );
}

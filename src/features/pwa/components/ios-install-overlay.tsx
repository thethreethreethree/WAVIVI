"use client";

import { useEffect } from "react";

/**
 * iOS install instruction overlay.
 *
 * Replaces the prior one-line tooltip ("Tap Share → Add to Home Screen")
 * with a guided fullscreen modal. iOS Safari has NO JavaScript API to
 * trigger Add to Home Screen — Apple deliberately gates this — so the
 * best we can do is make the two-tap path so visible the user can't
 * miss it. The modal mimics Safari's bottom bar and share sheet so
 * the user maps "this picture → my screen" instantly.
 *
 * Closes on backdrop click, on Escape, and on the Close button. The
 * caller controls visibility via the `open` prop; this component is
 * pure presentation.
 */
export function IosInstallOverlay({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="ios-install-title"
      onClick={onClose}
      className="fixed inset-0 z-[150] flex items-end justify-center bg-black/55 backdrop-blur-sm sm:items-center"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="wc-frame relative mx-3 mb-3 w-full max-w-md rounded-3xl bg-background p-5 sm:mb-0"
      >
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 text-2xl leading-none text-muted hover:text-foreground"
        >
          ×
        </button>

        <h2
          id="ios-install-title"
          className="pr-8 text-xl font-bold tracking-tight"
        >
          Install Wondavu on your iPhone
        </h2>
        <p className="mt-1 text-sm text-muted">
          Two taps and Wondavu lives on your home screen — no app store,
          no signup wall.
        </p>

        <ol className="mt-5 flex flex-col gap-4 text-sm">
          <li className="flex gap-3">
            <span
              aria-hidden
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-glow font-bold text-white"
            >
              1
            </span>
            <div className="flex-1">
              <p className="font-semibold text-foreground">
                Tap the <strong>Share</strong> button at the bottom of
                Safari.
              </p>
              <SafariBottomBarMock />
            </div>
          </li>

          <li className="flex gap-3">
            <span
              aria-hidden
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-glow font-bold text-white"
            >
              2
            </span>
            <div className="flex-1">
              <p className="font-semibold text-foreground">
                Scroll down and pick <strong>Add to Home Screen</strong>.
              </p>
              <ShareSheetMock />
            </div>
          </li>
        </ol>

        <p className="mt-4 text-xs text-muted">
          On iPad, the Share button sits at the top instead. Look for
          the same icon (square with arrow).
        </p>

        <button
          type="button"
          onClick={onClose}
          className="mt-5 w-full rounded-full bg-glow px-4 py-3 text-center text-base font-bold text-white shadow-card hover:opacity-90"
        >
          Got it
        </button>
      </div>
    </div>
  );
}

/** Mini-mockup of Safari's bottom toolbar with the Share button
 *  visually highlighted. Hand-drawn-ish at this size; the goal is
 *  pattern-matching, not photorealism. */
function SafariBottomBarMock() {
  return (
    <div className="mt-2 flex items-center justify-between gap-1.5 rounded-2xl bg-foreground/10 px-3 py-2 ring-1 ring-border">
      <ToolbarIcon glyph="‹" />
      <ToolbarIcon glyph="›" />
      <span className="relative">
        <ToolbarIcon glyph={<ShareSvg />} highlighted />
        <span
          aria-hidden
          className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 animate-bounce text-xl"
        >
          ⬇
        </span>
      </span>
      <ToolbarIcon glyph="❐" />
      <ToolbarIcon glyph="≡" />
    </div>
  );
}

/** Mini-mockup of the iOS share sheet with "Add to Home Screen"
 *  highlighted. Strips back the visual chrome to the row + icon
 *  the user is looking for. */
function ShareSheetMock() {
  return (
    <div className="mt-2 overflow-hidden rounded-2xl bg-foreground/10 ring-1 ring-border">
      <div className="flex items-center gap-3 px-3 py-2 text-xs opacity-60">
        <span aria-hidden>✎</span>
        Edit Bookmark
      </div>
      <div className="flex items-center gap-3 border-t border-border px-3 py-2 text-xs opacity-60">
        <span aria-hidden>⌘</span>
        Create a QR Code
      </div>
      <div className="flex items-center gap-3 border-t-2 border-glow bg-glow/15 px-3 py-2.5 text-xs font-bold text-foreground">
        <span
          aria-hidden
          className="flex h-5 w-5 items-center justify-center rounded-md bg-white text-foreground ring-1 ring-border"
        >
          +
        </span>
        Add to Home Screen
        <span aria-hidden className="ml-auto text-glow">
          ←
        </span>
      </div>
      <div className="flex items-center gap-3 border-t border-border px-3 py-2 text-xs opacity-60">
        <span aria-hidden>✎</span>
        Add to Quick Note
      </div>
    </div>
  );
}

function ToolbarIcon({
  glyph,
  highlighted,
}: {
  glyph: React.ReactNode;
  highlighted?: boolean;
}) {
  return (
    <span
      className={`flex h-7 w-7 items-center justify-center rounded-md text-sm ${
        highlighted
          ? "bg-glow text-white ring-2 ring-glow shadow-card"
          : "text-foreground/60"
      }`}
    >
      {glyph}
    </span>
  );
}

/** Inline SVG of iOS Safari's share glyph — square with up-arrow. */
function ShareSvg() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <path d="M4 12v7a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-7" />
      <path d="M16 6l-4-4-4 4" />
      <path d="M12 2v14" />
    </svg>
  );
}

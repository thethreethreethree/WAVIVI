"use client";

import { useEffect } from "react";

/**
 * iOS install instruction overlay.
 *
 * Replaces the prior one-line tooltip ("Tap Share → Add to Home Screen")
 * with a guided fullscreen modal. iOS Safari has NO JavaScript API to
 * trigger Add to Home Screen — Apple deliberately gates this — so the
 * best we can do is make the path so visible the user can't miss it.
 *
 * Reality check (verified 2026-06-06 via real-device screenshots
 * + Apple Support docs): iOS 17/18 with the Bottom Tab Bar layout
 * (default on newer iPhones) hides Share inside a "•••" menu. The
 * Share Sheet then opens in a collapsed state and the "Add to Home
 * Screen" row only appears after the user taps "View More" / the
 * "⌄" arrow. So the modern flow is FOUR taps, not two. Users with the
 * Top Tab Bar setting see Share directly in the bottom bar — the
 * overlay below calls that out as the alternative first step.
 *
 * Also: Apple deliberately blocks Add to Home Screen entirely in
 * Private Browsing mode. The overlay surfaces this loud and clear
 * because users testing PWA install in incognito (a common debugging
 * habit) would otherwise hit a silent dead end at the last step.
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
        className="wc-frame relative mx-3 mb-3 max-h-[92dvh] w-full max-w-md overflow-y-auto rounded-3xl bg-background p-5 sm:mb-0"
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
          A few taps and Wondavu lives on your home screen — no app store,
          no signup wall.
        </p>

        {/* Private-browsing warning — separated as its own visual block so
            users testing PWA install in incognito (which Apple silently
            blocks) hit a loud dead-end-up-front warning instead of a
            silent dead-end at the last step. */}
        <div className="mt-3 rounded-2xl bg-heat/10 px-3 py-2.5 text-xs ring-1 ring-heat/30">
          <strong className="text-heat">
            ⚠ Not in Private Browsing.
          </strong>{" "}
          <span className="text-foreground/85">
            Apple blocks Add to Home Screen in Private tabs. Use a regular
            Safari tab to finish the install.
          </span>
        </div>

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
                Tap the <strong>•••</strong> button in Safari&apos;s bottom
                bar.
              </p>
              <p className="mt-0.5 text-xs text-muted">
                Or the <ShareSvgInline /> Share button if your Safari uses
                the older top-tab-bar layout (skip to step 3).
              </p>
              <SafariBottomBarMock highlight="ellipsis" />
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
                Tap <strong>Share</strong> from the menu that pops up.
              </p>
              <BottomMenuMock />
            </div>
          </li>

          <li className="flex gap-3">
            <span
              aria-hidden
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-glow font-bold text-white"
            >
              3
            </span>
            <div className="flex-1">
              <p className="font-semibold text-foreground">
                In the share sheet, tap <strong>View More</strong> (the{" "}
                <span aria-hidden>⌄</span>) — or swipe up.
              </p>
              <ShareSheetTopMock />
            </div>
          </li>

          <li className="flex gap-3">
            <span
              aria-hidden
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-glow font-bold text-white"
            >
              4
            </span>
            <div className="flex-1">
              <p className="font-semibold text-foreground">
                Pick <strong>Add to Home Screen</strong>.
              </p>
              <ShareSheetExpandedMock />
            </div>
          </li>
        </ol>

        <p className="mt-4 text-xs text-muted">
          On iPad the bottom bar is at the top instead — same icons, same
          steps.
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

/** Mini-mockup of Safari's bottom toolbar with the ••• menu (or Share,
 *  for the Top Tab Bar alternative) visually highlighted. */
function SafariBottomBarMock({
  highlight,
}: {
  highlight: "ellipsis" | "share";
}) {
  return (
    <div className="mt-2 flex items-center justify-between gap-1.5 rounded-2xl bg-foreground/10 px-3 py-2 ring-1 ring-border">
      <ToolbarIcon glyph="‹" />
      <ToolbarIcon glyph={<TabsSvg />} />
      <span className="flex flex-1 items-center gap-1 rounded-full bg-white/40 px-2 py-1 text-[10px] font-medium text-foreground/70">
        wondavu.com
      </span>
      <ToolbarIcon glyph="↻" />
      <span className="relative">
        <ToolbarIcon
          glyph={highlight === "ellipsis" ? "•••" : <ShareSvg />}
          highlighted
        />
        <span
          aria-hidden
          className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 animate-bounce text-xl"
        >
          ⬇
        </span>
      </span>
    </div>
  );
}

/** Mockup of the popover menu that opens after tapping ••• — Share is
 *  highlighted as the row to pick. */
function BottomMenuMock() {
  return (
    <div className="mt-2 overflow-hidden rounded-2xl bg-foreground/10 ring-1 ring-border">
      <div className="flex items-center gap-3 border-t-2 border-glow bg-glow/15 px-3 py-2.5 text-xs font-bold text-foreground">
        <ShareSvgInline />
        Share
        <span aria-hidden className="ml-auto text-glow">
          ←
        </span>
      </div>
      <div className="flex items-center gap-3 border-t border-border px-3 py-2 text-xs opacity-60">
        <span aria-hidden>🔖</span> Add to Bookmarks
      </div>
      <div className="flex items-center gap-3 border-t border-border px-3 py-2 text-xs opacity-60">
        <span aria-hidden>＋</span> New Tab
      </div>
    </div>
  );
}

/** Mockup of the share sheet's collapsed top half, with "View More"
 *  highlighted in the bottom-right corner. */
function ShareSheetTopMock() {
  return (
    <div className="mt-2 overflow-hidden rounded-2xl bg-foreground/10 ring-1 ring-border">
      <div className="border-b border-border px-3 py-2 text-[11px] font-bold text-foreground">
        Wondavu
        <span className="ml-1 font-normal text-muted">wondavu.com</span>
      </div>
      <div className="grid grid-cols-4 gap-1 px-3 py-2 text-center text-[10px] text-muted">
        <span>Copy</span>
        <span>Bookmarks</span>
        <span>Reading List</span>
        <span className="relative flex items-center justify-center gap-0.5 rounded-md bg-glow/20 py-1 font-bold text-foreground ring-2 ring-glow">
          View More
          <span aria-hidden>⌄</span>
        </span>
      </div>
    </div>
  );
}

/** Mockup of the fully-expanded share sheet with Add to Home Screen
 *  highlighted as the row to pick. */
function ShareSheetExpandedMock() {
  return (
    <div className="mt-2 overflow-hidden rounded-2xl bg-foreground/10 ring-1 ring-border">
      <div className="flex items-center gap-3 px-3 py-2 text-xs opacity-60">
        <span aria-hidden>📖</span> Add Bookmark to…
      </div>
      <div className="flex items-center gap-3 border-t border-border px-3 py-2 text-xs opacity-60">
        <span aria-hidden>★</span> Add to Favorites
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
        <span aria-hidden>✎</span> Markup
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

/** Tab-stack icon (two overlapping squares) — Safari's tabs button. */
function TabsSvg() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden
    >
      <rect x="6" y="6" width="13" height="13" rx="2" />
      <path d="M3 14V5a2 2 0 0 1 2-2h9" />
    </svg>
  );
}

/** iOS Safari share glyph (square with up-arrow) — used in the toolbar
 *  mock and inline references. */
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

/** Inline-text version of ShareSvg — sized to sit next to body text. */
function ShareSvgInline() {
  return (
    <span className="inline-flex h-4 w-4 items-center justify-center align-text-bottom text-foreground">
      <ShareSvg />
    </span>
  );
}

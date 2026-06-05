"use client";

import { useEffect, useState } from "react";

import { IosInstallOverlay } from "./ios-install-overlay";

/** Minimal shape of the non-standard `beforeinstallprompt` event. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "wavivi:install-pill-dismissed";

/**
 * Small hand-drawn pill that nudges first-time visitors to install Wondavu
 * as a PWA. Rendered next to the home-screen logo for unauthenticated
 * visitors only (the parent decides; this component just handles state +
 * install mechanics + dismissal).
 *
 * Hides itself when:
 *  - the user already dismissed it (persisted in localStorage)
 *  - the app is already running in standalone / installed mode
 *  - there's no `beforeinstallprompt` available *and* we're not on iOS
 *    Safari (where install is a manual "Share → Add to Home Screen" flow)
 */
export function InstallPill() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );
  const [iosHint, setIosHint] = useState(false);
  const [dismissed, setDismissed] = useState(true); // start hidden; flip on mount
  // iOS Safari has no JS API to trigger Add to Home Screen, so we
  // show a guided fullscreen overlay (IosInstallOverlay) when the pill
  // is tapped on iOS. Replaces the prior tiny tooltip which read as
  // "small hint to a feature you can't find" instead of a guide.
  const [showIosOverlay, setShowIosOverlay] = useState(false);

  useEffect(() => {
    // Already installed → never show.
    if (window.matchMedia("(display-mode: standalone)").matches) return;
    if (
      "standalone" in window.navigator &&
      (window.navigator as Navigator & { standalone?: boolean }).standalone
    )
      return;

    if (localStorage.getItem(DISMISSED_KEY)) return;

    // eslint-disable-next-line react-hooks/set-state-in-effect -- syncing browser state (display-mode + localStorage) into React on mount
    setDismissed(false);

    // Detect iOS Safari, where install is via Share menu (no event API).
    const ua = window.navigator.userAgent;
    const isIos = /iPad|iPhone|iPod/.test(ua);
    const isSafari =
      /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS/.test(ua);
    if (isIos && isSafari) setIosHint(true);

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (dismissed) return null;
  // On non-iOS browsers without a deferred prompt, nothing useful to do.
  if (!deferred && !iosHint) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDismissed(true);
  };

  const onClick = async () => {
    if (deferred) {
      // Android Chrome / Edge / Brave / desktop Chrome path — native
      // one-tap install via the deferred beforeinstallprompt event.
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") dismiss();
      setDeferred(null);
      return;
    }
    // iOS Safari path — no native prompt API exists. Open the guided
    // overlay so the user sees exactly which Share button to tap and
    // which row to pick on the share sheet.
    setShowIosOverlay(true);
  };

  return (
    <div className="relative inline-flex">
      <button
        type="button"
        onClick={onClick}
        className="wc-edge-soft flex items-center gap-1.5 rounded-full bg-[#fdf4e2] px-3 py-1.5 text-[11px] font-bold text-[#3d1f06] ring-[1.5px] ring-[#3d1f06]/55 shadow-[0_2px_8px_-2px_rgba(120,70,30,0.22)] active:scale-95"
        aria-label="Start wondering — download Wondavu to your phone"
      >
        <span aria-hidden>📲</span>
        <span>Start wondering — get the app on your phone</span>
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="ml-1 self-center text-[#3d1f06]/55 hover:text-[#3d1f06]"
      >
        ×
      </button>
      <IosInstallOverlay
        open={showIosOverlay}
        onClose={() => setShowIosOverlay(false)}
      />
    </div>
  );
}

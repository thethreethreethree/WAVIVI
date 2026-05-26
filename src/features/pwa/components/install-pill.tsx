"use client";

import { useEffect, useState } from "react";

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
  const [showIosTip, setShowIosTip] = useState(false);

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
      await deferred.prompt();
      const choice = await deferred.userChoice;
      if (choice.outcome === "accepted") dismiss();
      setDeferred(null);
      return;
    }
    // iOS: no native prompt — show the share-menu hint.
    setShowIosTip((v) => !v);
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
      {showIosTip && (
        <span className="wc-edge-soft absolute left-0 top-full mt-2 w-64 rounded-xl bg-[#fdf4e2] px-3 py-2 text-[11px] font-medium leading-snug text-[#3d1f06] ring-[1.5px] ring-[#3d1f06]/55 shadow-[0_4px_12px_-4px_rgba(120,70,30,0.28)]">
          Tap the <strong>Share</strong> button in Safari, then choose{" "}
          <strong>Add to Home Screen</strong>.
        </span>
      )}
    </div>
  );
}

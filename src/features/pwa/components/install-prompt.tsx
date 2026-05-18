"use client";

import { useEffect, useState } from "react";

import { siteConfig } from "@/config/site";

/** Minimal shape of the non-standard `beforeinstallprompt` event. */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISSED_KEY = "wavivi:install-dismissed";

/** A dismissable banner that offers to install WAVIVI as a PWA. */
export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(
    null,
  );

  useEffect(() => {
    if (localStorage.getItem(DISMISSED_KEY)) return;

    const onPrompt = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!deferred) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISSED_KEY, "1");
    setDeferred(null);
  };

  const install = async () => {
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
  };

  return (
    <div className="fixed inset-x-0 bottom-0 z-50 px-4 pb-4">
      <div
        className="mx-auto flex max-w-md items-center gap-3 rounded-2xl border
                   border-border bg-surface-elevated p-4 shadow-lg"
      >
        <span className="min-w-0 flex-1 text-sm">
          <span className="block font-medium">Install {siteConfig.name}</span>
          <span className="block text-xs text-muted">
            Add it to your home screen for the full app experience.
          </span>
        </span>
        <button
          type="button"
          onClick={dismiss}
          className="rounded-lg px-2 py-2 text-sm text-muted transition-colors hover:text-foreground"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={install}
          className="rounded-lg bg-glow px-3 py-2 text-sm font-medium text-white
                     transition-opacity hover:opacity-90"
        >
          Install
        </button>
      </div>
    </div>
  );
}

"use client";

import Image from "next/image";
import { useEffect } from "react";

/**
 * iOS install instruction overlay.
 *
 * iOS Safari has NO JavaScript API to trigger Add to Home Screen —
 * Apple deliberately gates this — so the overlay's job is to show the
 * user the exact taps they need.
 *
 * The visual content is a single designed asset
 * (public/install-instructions-ios.webp, source under
 * ASSETS SOURCE/INSTALLATION INSTRUCTION.png). It carries the
 * headline, the three-step illustration, and the highlights together
 * in the brand's hand-drawn paper aesthetic — replacing the prior
 * CSS-and-SVG mockup soup with one cohesive image. Re-export from the
 * source PNG and re-run scripts/convert-install-assets.mjs to refresh.
 *
 * Only chrome around the image is owned by this component: the modal
 * container, the close × button, and the Got it dismissal at the
 * bottom. Everything else lives in the artwork.
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
        {/* Modal title is in the artwork itself; this sr-only h2 carries
            the accessible name referenced by aria-labelledby. */}
        <h2 id="ios-install-title" className="sr-only">
          Install Wondavu on your iPhone
        </h2>

        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="absolute right-4 top-4 z-10 text-2xl leading-none text-muted hover:text-foreground"
        >
          ×
        </button>

        <Image
          src="/install-instructions-ios.webp"
          alt="Install Wondavu on your iPhone — three illustrated steps showing how to tap the … menu, the Share icon, and Add to Home Screen in Safari."
          width={461}
          height={826}
          priority
          sizes="(max-width: 640px) 90vw, 420px"
          className="mx-auto h-auto w-full max-w-sm"
        />

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

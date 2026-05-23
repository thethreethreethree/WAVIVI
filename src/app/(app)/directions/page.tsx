"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";

import { BackButton } from "@/components/ui/back-button";

/**
 * Travejor in-app directions view.
 *
 * Google Maps lives inside an iframe so the user stays inside Travejor —
 * there's no hop to a new tab and no "where do I go back?" moment. The
 * watercolor top bar carries the place name and a real history-based back
 * button; an "Open in Google Maps" pill lets power users hand off to the
 * native app when they want turn-by-turn nav.
 *
 * Uses the keyless `maps.google.com/maps?...&output=embed` URL so this works
 * without provisioning a Google Maps Embed API key — good enough for the
 * "see where it is + get directions" use case.
 */
export default function DirectionsPage() {
  return (
    <Suspense fallback={<div className="flex flex-1" />}>
      <DirectionsView />
    </Suspense>
  );
}

function DirectionsView() {
  const params = useSearchParams();
  const lat = params.get("lat");
  const lng = params.get("lng");
  const name = params.get("name") ?? "Destination";

  const { embedSrc, openInMapsUrl } = useMemo(() => {
    if (!lat || !lng) return { embedSrc: null, openInMapsUrl: null };
    // `daddr` = destination; the embed asks the browser for the origin so
    // directions auto-route from the user's location. `output=embed` is the
    // keyless variant that works inside an iframe.
    const q = `${lat},${lng}(${encodeURIComponent(name)})`;
    return {
      embedSrc: `https://maps.google.com/maps?daddr=${q}&z=14&output=embed`,
      openInMapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodeURIComponent(name)}&travelmode=driving`,
    };
  }, [lat, lng, name]);

  return (
    <div className="relative flex flex-1 flex-col">
      {/* Top bar — back button + truncated place name. Floats over the map
          so the embed uses the full viewport behind it. */}
      <header className="absolute inset-x-0 top-0 z-10 flex items-center gap-3 px-4 pb-3 pt-[max(2.75rem,calc(env(safe-area-inset-top)+1.5rem))]">
        <BackButton
          fallback="/"
          className="wc-frame wc-frame-orange-white flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-glow shadow-card transition-transform active:scale-95"
        />
        <div className="wc-frame min-w-0 flex-1 rounded-2xl bg-surface/95 px-3 py-2 shadow-card backdrop-blur">
          <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
            Directions to
          </p>
          <p className="truncate text-sm font-bold text-foreground">{name}</p>
        </div>
      </header>

      {/* Map embed */}
      {embedSrc ? (
        <iframe
          src={embedSrc}
          title={`Map directions to ${name}`}
          loading="eager"
          referrerPolicy="no-referrer-when-downgrade"
          allow="geolocation"
          className="h-[calc(100dvh-6.75rem)] w-full border-0"
        />
      ) : (
        <div className="flex flex-1 items-center justify-center px-6 text-center">
          <p className="rounded-2xl bg-heat/15 px-4 py-3 text-sm font-semibold text-heat">
            Missing destination — go back and try again.
          </p>
        </div>
      )}

      {/* "Open in Google Maps" — for users who want native turn-by-turn nav.
          Sits above the bottom nav with a comfortable margin. */}
      {openInMapsUrl && (
        <a
          href={openInMapsUrl}
          target="_blank"
          rel="noreferrer"
          className="wc-frame wc-frame-sunset absolute inset-x-5 bottom-[max(7.5rem,calc(env(safe-area-inset-bottom)+7.25rem))] z-10 rounded-2xl py-3 text-center text-sm font-bold text-white shadow-card active:scale-[0.98]"
        >
          Open in Google Maps app ↗
        </a>
      )}
    </div>
  );
}

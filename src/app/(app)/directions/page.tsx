"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { BackButton } from "@/components/ui/back-button";

/**
 * Travejor in-app directions view.
 *
 * Google Maps lives inside an iframe so the user stays inside Travejor —
 * there's no hop to a new tab and no "where do I go back?" moment. The
 * watercolor top bar carries the place name and a real history-based back
 * button; an "Open in Google Maps app" pill lets power users hand off to the
 * native app when they want turn-by-turn nav.
 *
 * To actually draw the route line (the blue path in Maps), the embed needs
 * both an origin and a destination. We ask the browser for the user's
 * location once on mount and feed `saddr=lat,lng&daddr=lat,lng` into the
 * keyless embed URL — Maps then plots the route with the ETA bubble. If the
 * user denies geolocation, we fall back to a destination-pin view.
 */
export default function DirectionsPage() {
  return (
    <Suspense fallback={<div className="flex flex-1" />}>
      <DirectionsView />
    </Suspense>
  );
}

type Pos = { lat: number; lng: number };

function DirectionsView() {
  const params = useSearchParams();
  const lat = params.get("lat");
  const lng = params.get("lng");
  const name = params.get("name") ?? "Destination";

  const [userPos, setUserPos] = useState<Pos | null>(null);
  const [geoState, setGeoState] = useState<"idle" | "asking" | "denied">(
    "idle",
  );

  // Ask for the browser location on mount. We need it to plot the blue route
  // line; without it Maps just shows the destination pin.
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoState("denied");
      return;
    }
    setGeoState("asking");
    navigator.geolocation.getCurrentPosition(
      (p) => {
        setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setGeoState("idle");
      },
      () => setGeoState("denied"),
      { enableHighAccuracy: true, timeout: 10_000 },
    );
  }, []);

  const { embedSrc, openInMapsUrl } = useMemo(() => {
    if (!lat || !lng) return { embedSrc: null, openInMapsUrl: null };
    // With an origin: full route line + ETA bubble. Without: destination pin.
    const dest = `${lat},${lng}`;
    const src = userPos
      ? `https://maps.google.com/maps?saddr=${userPos.lat},${userPos.lng}&daddr=${dest}&output=embed`
      : `https://maps.google.com/maps?q=${dest}(${encodeURIComponent(name)})&z=15&output=embed`;
    return {
      embedSrc: src,
      openInMapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${dest}&destination_place_id=${encodeURIComponent(name)}&travelmode=driving`,
    };
  }, [lat, lng, name, userPos]);

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
          // `userPos` flips the URL once we have coords, which remounts the
          // iframe and replots the route — the natural way to refresh.
          key={embedSrc}
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

      {/* Location nudge — only when the browser refused / hasn't shared.
          Without coords the route line can't be drawn; surface why and offer
          a quick retry. */}
      {embedSrc && geoState === "denied" && (
        <div className="absolute inset-x-4 top-[max(7.5rem,calc(env(safe-area-inset-top)+5.5rem))] z-10 rounded-2xl bg-surface/95 px-3 py-2 text-[11px] font-semibold text-foreground shadow-card backdrop-blur ring-1 ring-border">
          📍 Allow location to plot the route from where you are. Showing the
          destination only.
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

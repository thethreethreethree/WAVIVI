"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { BackButton } from "@/components/ui/back-button";
import {
  CAR_KMH,
  SCOOTER_KMH,
  WALK_KMH,
  fmtKm,
  fmtMins,
  haversineKm,
} from "@/lib/utils/geo";

/**
 * Travejor in-app directions view.
 *
 * Google Maps lives inside an iframe so the user stays inside Travejor —
 * no hop to a new tab. The map is sized as a flex child between a header
 * (back button + place name + travel-time pills + saves count) and a footer
 * (Open in Google Maps app), so the route auto-fits *inside the visible
 * area* rather than under the floating chrome.
 *
 * Drawing the blue route line needs both an origin and destination, so we
 * ask the browser for the user's location on mount and feed
 * `saddr=lat,lng&daddr=lat,lng` into the keyless embed URL. When location
 * is denied we fall back to a destination pin.
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
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const name = params.get("name") ?? "Destination";
  const type = params.get("type") ?? ""; // stay | restaurant | experience | event
  const id = params.get("id") ?? "";
  const hasDest = Number.isFinite(lat) && Number.isFinite(lng);

  const [userPos, setUserPos] = useState<Pos | null>(null);
  const [geoState, setGeoState] = useState<"idle" | "asking" | "denied">(
    "idle",
  );
  const [saves, setSaves] = useState<number | null>(null);

  // Ask the browser for current location — needed to plot the route line.
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

  // How many travelers saved this place — small social-proof pill.
  useEffect(() => {
    if (!type || !id) return;
    let cancelled = false;
    fetch(`/api/saves/count?type=${type}&id=${id}`)
      .then((r) => (r.ok ? r.json() : { count: 0 }))
      .then((b: { count: number }) => {
        if (!cancelled) setSaves(b.count);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [type, id]);

  const distanceKm = useMemo(() => {
    if (!userPos || !hasDest) return null;
    return haversineKm(userPos, { lat, lng });
  }, [userPos, hasDest, lat, lng]);

  const { embedSrc, openInMapsUrl } = useMemo(() => {
    if (!hasDest) return { embedSrc: null, openInMapsUrl: null };
    const dest = `${lat},${lng}`;
    const src = userPos
      ? `https://maps.google.com/maps?saddr=${userPos.lat},${userPos.lng}&daddr=${dest}&output=embed`
      : `https://maps.google.com/maps?q=${dest}(${encodeURIComponent(name)})&z=15&output=embed`;
    return {
      embedSrc: src,
      openInMapsUrl: `https://www.google.com/maps/dir/?api=1&destination=${dest}&destination_place_id=${encodeURIComponent(name)}&travelmode=driving`,
    };
  }, [hasDest, lat, lng, name, userPos]);

  return (
    <div className="flex flex-1 flex-col">
      {/* Header — back button + place name */}
      <header className="flex items-center gap-3 px-4 pb-3 pt-[max(2.75rem,calc(env(safe-area-inset-top)+1.5rem))]">
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

      {/* Travel-time + saves pills */}
      {(distanceKm != null || saves != null) && (
        <div className="-mx-1 flex flex-wrap items-center gap-1.5 px-5 pb-2 text-[11px] font-bold">
          {distanceKm != null && (
            <>
              <span className="wc-frame wc-frame-orange rounded-full px-2.5 py-1 text-foreground">
                📍 {fmtKm(distanceKm)}
              </span>
              <span className="wc-frame rounded-full px-2.5 py-1 text-foreground">
                🚗 {fmtMins((distanceKm / CAR_KMH) * 60)}
              </span>
              <span className="wc-frame rounded-full px-2.5 py-1 text-foreground">
                🛵 {fmtMins((distanceKm / SCOOTER_KMH) * 60)}
              </span>
              <span className="wc-frame rounded-full px-2.5 py-1 text-foreground">
                🚶 {fmtMins((distanceKm / WALK_KMH) * 60)}
              </span>
            </>
          )}
          {saves != null && saves > 0 && (
            <span className="rounded-full bg-glow/15 px-2.5 py-1 text-glow">
              🎒 {saves} traveler{saves === 1 ? "" : "s"} saved
            </span>
          )}
        </div>
      )}

      {geoState === "denied" && (
        <p className="mx-5 mb-2 rounded-2xl bg-surface/95 px-3 py-2 text-[11px] font-semibold text-foreground shadow-card ring-1 ring-border">
          📍 Allow location to plot the route from where you are — showing the
          destination only.
        </p>
      )}

      {/* Map — fills the remaining vertical space, so it's naturally centered
          between the header above and the action button below. */}
      {embedSrc ? (
        <iframe
          // key flips with the URL once we have coords, remounting the iframe
          // to plot the route — the natural way to refresh.
          key={embedSrc}
          src={embedSrc}
          title={`Map directions to ${name}`}
          loading="eager"
          referrerPolicy="no-referrer-when-downgrade"
          allow="geolocation"
          className="w-full flex-1 border-0"
        />
      ) : (
        <div className="flex flex-1 items-center justify-center px-6 text-center">
          <p className="rounded-2xl bg-heat/15 px-4 py-3 text-sm font-semibold text-heat">
            Missing destination — go back and try again.
          </p>
        </div>
      )}

      {/* Hand-off to the native Google Maps app for full turn-by-turn nav. */}
      {openInMapsUrl && (
        <div className="px-5 py-3">
          <a
            href={openInMapsUrl}
            target="_blank"
            rel="noreferrer"
            className="wc-frame wc-frame-sunset mx-auto block w-full max-w-xs rounded-2xl py-3 text-center text-sm font-bold text-white shadow-card active:scale-[0.98]"
          >
            Open in Google Maps app ↗
          </a>
        </div>
      )}
    </div>
  );
}

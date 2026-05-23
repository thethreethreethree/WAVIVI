"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useState } from "react";

import { BackButton } from "@/components/ui/back-button";
import {
  type NavMode,
  type NavRoute,
  fetchRoute,
  formatStep,
  stepGlyph,
} from "@/lib/nav/osrm";
import { fmtKm, fmtMins } from "@/lib/utils/geo";

// Leaflet doesn't survive SSR — load the map client-only.
const NavMap = dynamic(
  () => import("@/components/ui/nav-map").then((m) => m.NavMap),
  { ssr: false },
);

const MODES: { id: NavMode; label: string; emoji: string }[] = [
  { id: "driving", label: "Drive", emoji: "🚗" },
  { id: "walking", label: "Walk", emoji: "🚶" },
  { id: "cycling", label: "Bike", emoji: "🚴" },
];

/**
 * Travejor in-app navigation page.
 *
 * Built on Leaflet + CARTO Voyager tiles + the public OSRM routing service.
 * Plots a sunset-orange route from the user's current location to a
 * destination supplied via search params, with a live pulsing user marker
 * (watchPosition), distance/ETA, mode chips (drive/walk/bike), a collapsible
 * step list, and a Google Maps fallback for actual turn-by-turn voice nav.
 *
 * Required search params: ?lat=…&lng=…&name=…
 * Optional:               &mode=driving|walking|cycling
 */
export default function NavPage() {
  return (
    <Suspense fallback={<div className="flex flex-1" />}>
      <NavView />
    </Suspense>
  );
}

type Pos = { lat: number; lng: number };

function NavView() {
  const params = useSearchParams();
  const lat = Number(params.get("lat"));
  const lng = Number(params.get("lng"));
  const name = params.get("name") ?? "Destination";
  const initialMode = (params.get("mode") as NavMode) ?? "driving";
  const hasDest = Number.isFinite(lat) && Number.isFinite(lng);

  const [mode, setMode] = useState<NavMode>(initialMode);
  const [userPos, setUserPos] = useState<Pos | null>(null);
  const [geoState, setGeoState] = useState<"idle" | "asking" | "denied">(
    "idle",
  );
  const [route, setRoute] = useState<NavRoute | null>(null);
  const [routing, setRouting] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [stepsOpen, setStepsOpen] = useState(false);

  // Watch the browser's geolocation — first fix gives us a routing origin;
  // continued updates move the live marker as the user travels.
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoState("denied");
      return;
    }
    setGeoState("asking");
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setGeoState("idle");
      },
      () => setGeoState("denied"),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 5_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Fetch the route whenever we have both endpoints + a mode. Re-running
  // when userPos changes lets the user pick "Walk" / "Bike" and see the
  // route recalc; we don't fully re-route on every position tick (too
  // chatty for the public OSRM demo), only when mode flips or origin
  // shifts > 75m from the previous routing origin.
  const routingOrigin = useStableOrigin(userPos);
  useEffect(() => {
    if (!hasDest || !routingOrigin) return;
    const ctrl = new AbortController();
    setRouting(true);
    setRouteError(null);
    fetchRoute(routingOrigin, { lat, lng }, mode, ctrl.signal)
      .then((r) => {
        if (ctrl.signal.aborted) return;
        if (!r) {
          setRouteError("Couldn't compute a route here. Try a different mode.");
        }
        setRoute(r);
      })
      .catch(() => {
        if (!ctrl.signal.aborted) setRouteError("Route lookup failed.");
      })
      .finally(() => {
        if (!ctrl.signal.aborted) setRouting(false);
      });
    return () => ctrl.abort();
  }, [routingOrigin, hasDest, lat, lng, mode]);

  const gmapsHandoff = useMemo(() => {
    if (!hasDest) return null;
    const profile =
      mode === "walking"
        ? "walking"
        : mode === "cycling"
          ? "bicycling"
          : "driving";
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&destination_place_id=${encodeURIComponent(name)}&travelmode=${profile}&dir_action=navigate`;
  }, [hasDest, lat, lng, name, mode]);

  return (
    <div className="relative flex flex-1 flex-col">
      {/* Header — back button + place name + mode chips */}
      <header className="relative z-10 flex flex-col gap-2 px-4 pb-2 pt-[max(2.75rem,calc(env(safe-area-inset-top)+1.5rem))]">
        <div className="flex items-center gap-3">
          <BackButton
            fallback="/"
            className="wc-frame wc-frame-orange-white flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-glow shadow-card transition-transform active:scale-95"
          />
          <div className="wc-frame min-w-0 flex-1 rounded-2xl bg-surface/95 px-3 py-2 shadow-card backdrop-blur">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
              Navigate to
            </p>
            <p className="truncate text-sm font-bold text-foreground">{name}</p>
          </div>
        </div>
        <div className="flex gap-1.5">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              onClick={() => setMode(m.id)}
              className={`inline-flex items-center gap-1 rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                mode === m.id
                  ? "wc-frame wc-frame-sunset text-white"
                  : "wc-frame wc-frame-orange-white text-foreground"
              }`}
            >
              <span aria-hidden>{m.emoji}</span>
              {m.label}
            </button>
          ))}
        </div>
      </header>

      {geoState === "denied" && (
        <p className="mx-4 mt-1 rounded-2xl bg-heat/15 px-3 py-2 text-[11px] font-semibold text-heat">
          Allow location access to plot the route from where you are.
        </p>
      )}

      {/* Map — fills remaining vertical space between header and footer. */}
      <div className="relative flex-1">
        {hasDest ? (
          <NavMap
            start={userPos}
            end={{ lat, lng }}
            destinationName={name}
            route={route}
          />
        ) : (
          <div className="flex h-full items-center justify-center px-6 text-center">
            <p className="rounded-2xl bg-heat/15 px-4 py-3 text-sm font-semibold text-heat">
              Missing destination — go back and try again.
            </p>
          </div>
        )}

        {/* Routing indicator floating over the map */}
        {routing && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center">
            <span className="rounded-full bg-surface/95 px-3 py-1 text-[11px] font-bold text-foreground shadow-card ring-1 ring-border backdrop-blur">
              Plotting route…
            </span>
          </div>
        )}
        {routeError && !routing && (
          <div className="pointer-events-none absolute inset-x-0 top-3 z-10 flex justify-center">
            <span className="rounded-full bg-heat/90 px-3 py-1 text-[11px] font-bold text-white shadow-card">
              {routeError}
            </span>
          </div>
        )}
      </div>

      {/* Footer — distance/ETA summary, step list, and Maps handoff. */}
      <div className="relative z-10 flex flex-col gap-2 px-4 pb-3 pt-2">
        {route && (
          <div className="wc-frame flex items-center justify-between gap-3 rounded-2xl px-3 py-2 text-sm shadow-card">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-wide text-muted">
                {mode === "driving"
                  ? "Driving"
                  : mode === "walking"
                    ? "Walking"
                    : "Cycling"}
              </p>
              <p className="font-bold text-foreground">
                {fmtKm(route.distance / 1000)} ·{" "}
                {fmtMins(route.duration / 60)}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setStepsOpen((o) => !o)}
              className="rounded-full px-3 py-1.5 text-xs font-bold text-glow ring-1 ring-border hover:bg-foreground/5"
            >
              {stepsOpen ? "Hide steps" : `${route.steps.length} steps`}
            </button>
          </div>
        )}

        {stepsOpen && route && (
          <ol className="wc-frame max-h-56 overflow-y-auto rounded-2xl bg-surface/95 p-3 text-sm shadow-card">
            {route.steps.map((s, i) => (
              <li
                key={i}
                className={`flex items-start gap-2 py-1.5 ${
                  i > 0 ? "border-t border-border" : ""
                }`}
              >
                <span aria-hidden className="mt-0.5 text-base leading-none">
                  {stepGlyph(s)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold text-foreground">
                    {formatStep(s, name)}
                  </span>
                  {s.distance > 5 && (
                    <span className="text-[11px] text-muted">
                      {fmtKm(s.distance / 1000)}
                    </span>
                  )}
                </span>
              </li>
            ))}
          </ol>
        )}

        {gmapsHandoff && (
          <a
            href={gmapsHandoff}
            target="_blank"
            rel="noreferrer"
            className="block text-center text-xs font-bold text-glow underline-offset-4 hover:underline"
          >
            ▶ Start voice navigation in Google Maps
          </a>
        )}
      </div>
    </div>
  );
}

/**
 * Returns a "stable" routing origin: only updates when the user has moved
 * more than ~75m from the previous origin. Stops us from blasting OSRM with
 * a request every couple of seconds during a normal GPS jitter, while still
 * keeping the route fresh as the traveler actually moves.
 */
function useStableOrigin(pos: { lat: number; lng: number } | null) {
  const [origin, setOrigin] = useState<{ lat: number; lng: number } | null>(
    null,
  );
  useEffect(() => {
    if (!pos) return;
    setOrigin((prev) => {
      if (!prev) return pos;
      const dKm = haversineKm(prev, pos);
      return dKm > 0.075 ? pos : prev;
    });
  }, [pos]);
  return origin;
}

function haversineKm(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const R = 6371;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

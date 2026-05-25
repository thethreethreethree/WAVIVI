"use client";

import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useMemo, useRef, useState } from "react";

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
 * Wondavu in-app navigation page.
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
  /** Compass heading (deg from North). Sourced from geolocation when the user
   *  is moving fast enough for the OS to report it, otherwise from the device
   *  orientation sensor when available. null = unknown. */
  const [heading, setHeading] = useState<number | null>(null);
  /** iOS Safari requires DeviceOrientationEvent.requestPermission() from a
   *  user gesture before the deviceorientation event fires. We detect that
   *  scenario and show a small "Enable compass" pill the user can tap. */
  const [needsCompassGrant, setNeedsCompassGrant] = useState(false);
  // Starts as "asking" — the geolocation effect below either confirms a fix
  // (→ "idle"), denies (→ "denied"), or, if the API is missing entirely,
  // skips straight to "denied" on mount.
  const [geoState, setGeoState] = useState<"idle" | "asking" | "denied">(
    "asking",
  );
  const [route, setRoute] = useState<NavRoute | null>(null);
  const [routing, setRouting] = useState(false);
  const [routeError, setRouteError] = useState<string | null>(null);
  const [stepsOpen, setStepsOpen] = useState(false);
  const [voiceOn, setVoiceOn] = useState(false);
  // Index of the next step the user hasn't reached yet. Advanced as the
  // user passes each maneuver. Reset whenever a fresh route lands.
  const stepIdxRef = useRef(0);
  // Keys of phrases we've already spoken, so we don't repeat the same warn.
  const spokenRef = useRef<Set<string>>(new Set());
  // Live tracking of next-turn UI (distance + step shown above the map).
  const [nextTurn, setNextTurn] = useState<{
    text: string;
    distanceM: number;
  } | null>(null);

  // Watch the browser's geolocation — first fix gives us a routing origin;
  // continued updates move the live marker as the user travels.
  useEffect(() => {
    if (!navigator.geolocation) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- browser capability fallback; cannot read `navigator` during render (SSR)
      setGeoState("denied");
      return;
    }
    const id = navigator.geolocation.watchPosition(
      (p) => {
        setUserPos({ lat: p.coords.latitude, lng: p.coords.longitude });
        setGeoState("idle");
        // coords.heading is degrees clockwise from true north — only present
        // when the device is moving fast enough for the OS to compute one.
        // When stationary it's null/NaN; we let the device-orientation
        // listener (below) supply heading in that case.
        const h = p.coords.heading;
        if (typeof h === "number" && !Number.isNaN(h)) {
          setHeading(h);
        }
      },
      () => setGeoState("denied"),
      { enableHighAccuracy: true, timeout: 15_000, maximumAge: 5_000 },
    );
    return () => navigator.geolocation.clearWatch(id);
  }, []);

  // Device-orientation compass — fills in heading when the user is standing
  // still. Browsers vary: Chrome / Android Firefox / desktop Chrome with a
  // magnetometer get it for free; iOS Safari needs an explicit permission
  // call (DeviceOrientationEvent.requestPermission), which only succeeds
  // from a user gesture. We attempt to request silently and ignore failures.
  useEffect(() => {
    if (typeof window === "undefined") return;
    type IOSOrientation = {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
    const ios = (
      window as unknown as { DeviceOrientationEvent?: IOSOrientation }
    ).DeviceOrientationEvent;
    // If iOS's permission gate exists we cannot silently invoke it — it must
    // come from a user gesture. Surface a button (handler below) instead.
    if (typeof ios?.requestPermission === "function") {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- iOS-only capability detection; can't run during SSR render
      setNeedsCompassGrant(true);
    }
    function onOrient(e: DeviceOrientationEvent & { webkitCompassHeading?: number }) {
      // iOS gives a direct compass heading; everyone else gives alpha
      // (rotation around z-axis) which we convert to compass-from-north.
      const compass =
        typeof e.webkitCompassHeading === "number"
          ? e.webkitCompassHeading
          : typeof e.alpha === "number"
            ? (360 - e.alpha) % 360
            : null;
      if (compass != null && !Number.isNaN(compass)) {
        setHeading(compass);
      }
    }
    window.addEventListener("deviceorientation", onOrient);
    return () => window.removeEventListener("deviceorientation", onOrient);
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
    // Standard "kick off an async fetch when deps change" pattern: flip
    // loading + clear stale error before the request, then resolve in the
    // promise callbacks (which the lint rule doesn't flag).
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pre-fetch UI reset
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

  // Reset step tracker + spoken-phrase log every time we get a fresh route.
  // (Moving this to a `key` on the component would force a full Map remount,
  // which is too heavy.)
  useEffect(() => {
    stepIdxRef.current = 0;
    spokenRef.current = new Set();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- derived reset on route change; key-based remount would re-init the map
    setNextTurn(null);
  }, [route]);

  // Voice cues + next-turn UI. Each user-position update walks forward
  // through the step list until we find the next un-passed maneuver, then
  // announces:
  //   • "In {dist}, {instruction}" once when ~250m out
  //   • "{instruction}"          once when ~40m out (and advances past it)
  // Depart fires on the first tick; arrive fires within ~30m.
  useEffect(() => {
    if (!route || !userPos) return;
    let idx = stepIdxRef.current;
    let upcoming: { text: string; distanceM: number } | null = null;

    while (idx < route.steps.length) {
      const step = route.steps[idx];
      const dM =
        haversineMeters(userPos, { lat: step.location[1], lng: step.location[0] });
      const text = formatStep(step, name);

      if (step.type === "depart") {
        const key = `${idx}-depart`;
        if (voiceOn && !spokenRef.current.has(key)) {
          spokenRef.current.add(key);
          speak(text);
        }
        idx++;
        continue;
      }

      if (step.type === "arrive") {
        const key = `${idx}-arrive`;
        upcoming = { text, distanceM: dM };
        if (dM < 30 && voiceOn && !spokenRef.current.has(key)) {
          spokenRef.current.add(key);
          speak(text);
          idx++;
        }
        break;
      }

      // Mid-route maneuver — show in the next-turn pill regardless of voice.
      upcoming = { text, distanceM: dM };

      const warnKey = `${idx}-warn`;
      const nowKey = `${idx}-now`;
      if (voiceOn && dM < 250 && !spokenRef.current.has(warnKey)) {
        spokenRef.current.add(warnKey);
        speak(`In ${fmtMeters(dM)}, ${lowerFirst(text)}`);
      }
      if (dM < 40 && !spokenRef.current.has(nowKey)) {
        if (voiceOn) {
          spokenRef.current.add(nowKey);
          speak(text);
        } else {
          // Even with voice off, mark the step as passed so the next-turn
          // pill advances when the user crosses the maneuver.
          spokenRef.current.add(nowKey);
        }
        idx++;
        continue;
      }
      break; // still approaching this step
    }

    stepIdxRef.current = idx;
    setNextTurn(upcoming);
  }, [userPos, route, voiceOn, name]);

  /**
   * Request iOS Safari's compass permission. Only meaningful when
   * needsCompassGrant is true; safe no-op everywhere else. Called from the
   * "Enable compass" pill (a user gesture, which iOS demands).
   */
  async function enableCompass() {
    if (typeof window === "undefined") return;
    type IOSOrientation = {
      requestPermission?: () => Promise<"granted" | "denied">;
    };
    const ios = (
      window as unknown as { DeviceOrientationEvent?: IOSOrientation }
    ).DeviceOrientationEvent;
    try {
      const result = await ios?.requestPermission?.();
      if (result === "granted") setNeedsCompassGrant(false);
    } catch {
      /* user dismissed — leave the pill visible so they can retry */
    }
  }

  // Toggling voice should also clear the queue of any pending utterances —
  // and the first tap doubles as the user gesture iOS Safari needs before
  // it will speak (we prime the synth with a silent utterance).
  function toggleVoice() {
    if (typeof window === "undefined") return;
    const next = !voiceOn;
    setVoiceOn(next);
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    if (next) {
      // Prime — silent utterance counts as the user-gesture unlock.
      const u = new SpeechSynthesisUtterance(" ");
      u.volume = 0;
      synth.speak(u);
    }
  }

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
    // Explicit height (viewport minus bottom-nav reservation) so flex-1
    // children — notably the Leaflet map — get a real, measurable canvas.
    <div className="relative flex h-[calc(100dvh-6.75rem)] flex-col overflow-hidden">
      {/* Header — back button + place name + mode chips */}
      <header className="relative z-10 flex flex-col gap-2 px-4 pb-2 pt-[max(2.75rem,calc(env(safe-area-inset-top)+1.5rem))]">
        <div className="flex items-center gap-3">
          <BackButton fallback="/" className="shrink-0" />
          <div className="wc-frame min-w-0 flex-1 rounded-2xl bg-surface/95 px-3 py-2 shadow-card backdrop-blur">
            <p className="text-[10px] font-bold uppercase tracking-wide text-muted">
              Navigate to
            </p>
            <p className="truncate text-sm font-bold text-foreground">{name}</p>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
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
          <button
            type="button"
            onClick={toggleVoice}
            aria-pressed={voiceOn}
            aria-label={voiceOn ? "Mute voice guidance" : "Enable voice guidance"}
            className={`ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full text-base font-bold transition-colors ${
              voiceOn
                ? "wc-frame wc-frame-sunset text-white"
                : "wc-frame wc-frame-orange-white text-foreground"
            }`}
          >
            {voiceOn ? "🔊" : "🔇"}
          </button>
        </div>
      </header>

      {geoState === "denied" && (
        <p className="mx-4 mt-1 rounded-2xl bg-heat/15 px-3 py-2 text-[11px] font-semibold text-heat">
          Allow location access to plot the route from where you are.
        </p>
      )}

      {/* iOS-only — enable compass so the directional arrow works while
          standing still. Browsers without the permission gate (Android,
          desktop) don't show this. Auto-hides once a heading is known. */}
      {needsCompassGrant && heading == null && (
        <div className="mx-4 mt-1 flex items-center justify-between gap-2 rounded-2xl bg-surface/95 px-3 py-2 text-[11px] font-semibold shadow-card ring-1 ring-border">
          <span className="text-foreground">
            🧭 Enable the compass so the arrow knows which way you&apos;re facing.
          </span>
          <button
            type="button"
            onClick={enableCompass}
            className="shrink-0 rounded-full bg-sunset px-2.5 py-1 text-[11px] font-bold text-white active:scale-95"
          >
            Enable
          </button>
        </div>
      )}

      {/* Map fills the remaining space between header and footer. The
          outer container's explicit height (above) is what makes flex-1
          here actually compute to a real number for Leaflet to render into. */}
      <div className="relative flex-1">
        {hasDest ? (
          <NavMap
            start={userPos}
            heading={heading}
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

        {/* Next-turn pill — the current upcoming maneuver. Lives near the
            top of the map; this is the on-screen counterpart to the voice
            cue, so users always know what's next even with voice muted. */}
        {nextTurn && !routing && (
          <div className="pointer-events-none absolute inset-x-3 top-3 z-10 flex justify-center">
            <span className="wc-frame max-w-[calc(100%-1.5rem)] truncate rounded-2xl bg-surface/95 px-3 py-1.5 text-[12px] font-bold text-foreground shadow-card backdrop-blur">
              <span className="text-glow">
                {nextTurn.distanceM < 40
                  ? "Now"
                  : `In ${fmtMeters(nextTurn.distanceM)}`}
              </span>
              {" · "}
              {nextTurn.text}
            </span>
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- threshold-debounce of an external (GPS) signal; functional update keeps it correct under concurrent ticks
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

function haversineMeters(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  return haversineKm(a, b) * 1000;
}

/** Format a meter distance for voice — "200 metres" / "1.2 kilometres". */
function fmtMeters(m: number): string {
  if (m < 1000) return `${Math.round(m / 10) * 10} metres`;
  return `${(m / 1000).toFixed(1)} kilometres`;
}

function lowerFirst(s: string): string {
  return s.length > 0 ? s[0].toLowerCase() + s.slice(1) : s;
}

/** Speak a phrase via the browser's free Web Speech API. Cancels any
 * still-queued utterance first so a closer "now" announcement supersedes
 * a stale "in 200 m" cue. No-op when the browser doesn't support it. */
function speak(text: string) {
  if (typeof window === "undefined") return;
  const synth = window.speechSynthesis;
  if (!synth) return;
  synth.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.rate = 1.0;
  u.pitch = 1.0;
  u.volume = 1.0;
  synth.speak(u);
}

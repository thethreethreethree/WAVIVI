"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";

import {
  type VibeCategory,
  type VibeSpot,
  vibeSpots,
} from "@/lib/travejor/vibemap";

import "leaflet/dist/leaflet.css";

/* ── Vibe categories — same structure as YumYumPo's Vibe Map. ──── */
const VIBES: { id: VibeCategory | "all"; label: string }[] = [
  { id: "all", label: "All" },
  { id: "buzzing", label: "Buzzing" },
  { id: "social", label: "Social" },
  { id: "nightlife", label: "Nightlife" },
  { id: "chill", label: "Chill" },
  { id: "event", label: "Events" },
];

/** Glyph shown inside each marker, by vibe. */
const VIBE_GLYPH: Record<string, string> = {
  buzzing: "🔥",
  social: "🥂",
  nightlife: "🌙",
  chill: "🌿",
  event: "🎉",
};

const KIND_LABEL: Record<string, string> = {
  group: "Group chat",
  event: "Event",
  stay: "Stay",
  spot: "Hotspot",
};

const DEFAULT_CENTER: [number, number] = [13.7563, 100.4977];
const DEFAULT_ZOOM = 6;

function regionPrimary(loc: string): string {
  return loc.split(",")[0].trim();
}
function regionKey(loc: string): string {
  return regionPrimary(loc).toLowerCase().replace(/[^a-z0-9]+/g, "-");
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
function fmtKm(km: number): string {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(km < 10 ? 1 : 0)} km`;
}
function fmtMins(m: number): string {
  if (m < 1) return "<1 min";
  if (m < 60) return `${Math.round(m)} min`;
  return `${Math.floor(m / 60)}h ${Math.round(m % 60)}m`;
}

/* ── Prominence — drives marker size + draw order. ────────────── */
function prominence(s: VibeSpot): number {
  return Math.round(
    s.vibeScore * 0.7 + Math.min(30, Math.log10(s.travelers + 1) * 16),
  );
}
function tierOf(score: number): "premium" | "prominent" | "standard" {
  if (score >= 78) return "premium";
  if (score >= 58) return "prominent";
  return "standard";
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}

/**
 * Travejor Vibe Map — Leaflet map of live traveler social density.
 * Layout and behaviour mirror YumYumPo's Vibe Map; styled in Travejor's brand.
 */
export function VibeMap() {
  const [active, setActive] = useState<VibeCategory | "all">("all");
  const [region, setRegion] = useState("bangkok");
  const [loading, setLoading] = useState(true);
  const [located, setLocated] = useState(false);
  const [nearby, setNearby] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletRef = useRef<any>(null);
  const markersRef = useRef<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { marker: any; spot: VibeSpot }[]
  >([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userMarkerRef = useRef<any>(null);
  const userPosRef = useRef<{ lat: number; lng: number } | null>(null);
  const applyRef = useRef<() => void>(() => {});

  const regions = useMemo(() => {
    const map = new Map<string, { key: string; label: string; count: number }>();
    for (const s of vibeSpots) {
      const key = regionKey(s.location);
      if (!map.has(key))
        map.set(key, { key, label: regionPrimary(s.location), count: 0 });
      map.get(key)!.count++;
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, []);

  const counts = useMemo(() => {
    const c: Record<string, number> = { all: 0 };
    VIBES.forEach((v) => (c[v.id] = 0));
    for (const s of vibeSpots) {
      if (region !== "all" && regionKey(s.location) !== region) continue;
      c.all++;
      c[s.vibe]++;
    }
    return c;
  }, [region]);

  // --- Map init (once) ------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      const el = document.getElementById("vm-map");
      if (cancelled || !el || mapRef.current) return;
      leafletRef.current = L;

      const map = L.map(el, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: true,
      });
      // Stamen Watercolor — a hand-painted map base that matches Travejor's
      // artsy, travel-journal aesthetic. Keyless on localhost; for production
      // register the deploy domain on a free Stadia Maps account.
      L.tileLayer(
        "https://tiles.stadiamaps.com/tiles/stamen_watercolor/{z}/{x}/{y}.jpg",
        {
          maxZoom: 16,
          attribution:
            '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> &copy; <a href="https://stamen.com/">Stamen Design</a> &copy; <a href="https://openstreetmap.org/">OpenStreetMap</a>',
        },
      ).addTo(map);
      mapRef.current = map;

      const scored = vibeSpots
        .map((spot) => ({ spot, score: prominence(spot) }))
        .sort((a, b) => a.score - b.score);

      for (const { spot, score } of scored) {
        const tier = tierOf(score);
        const size = tier === "premium" ? 46 : tier === "prominent" ? 36 : 26;
        const icon = L.divIcon({
          className: "",
          html: `<div class="vm-marker ${spot.vibe} tier-${tier}" title="${escapeHtml(spot.name)}">${VIBE_GLYPH[spot.vibe] ?? ""}</div>`,
          iconSize: [size, size],
          iconAnchor: [size / 2, size / 2],
          popupAnchor: [0, -size / 2],
        });
        const marker = L.marker([spot.lat, spot.lng], {
          icon,
          zIndexOffset:
            tier === "premium" ? 1000 : tier === "prominent" ? 400 : 0,
        });
        marker.bindPopup(buildPopup(spot, null), { autoPan: true });
        markersRef.current.push({ marker, spot });
      }

      setLoading(false);
      applyRef.current();
      // Leaflet needs a nudge once the flex container has its final size.
      setTimeout(() => map.invalidateSize(), 150);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = [];
    };
  }, []);

  // --- Filter application ---------------------------------------------------
  useEffect(() => {
    applyRef.current = () => {
      const L = leafletRef.current;
      const map = mapRef.current;
      if (!L || !map) return;

      const bounds = L.latLngBounds([]);
      for (const { marker, spot } of markersRef.current) {
        const vibeOk = active === "all" || spot.vibe === active;
        const regionOk = region === "all" || regionKey(spot.location) === region;
        if (vibeOk && regionOk) {
          marker.addTo(map);
          bounds.extend([spot.lat, spot.lng]);
        } else {
          marker.remove();
        }
      }
      if (userPosRef.current) {
        bounds.extend([userPosRef.current.lat, userPosRef.current.lng]);
      }
      if (bounds.isValid()) {
        map.fitBounds(bounds, { padding: [60, 60], maxZoom: 15 });
      } else {
        map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
      }
    };
    applyRef.current();
  }, [active, region]);

  // --- Geolocation ----------------------------------------------------------
  function locate() {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;
    if (!navigator.geolocation) {
      setNotice("Location isn't available on this device.");
      return;
    }
    setNotice("Finding your location…");

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        userPosRef.current = { lat, lng };
        setLocated(true);
        setNotice(null);

        userMarkerRef.current?.remove();
        const icon = L.divIcon({
          className: "",
          html: `<div class="vm-user-marker"><div class="vm-user-pulse"></div><div class="vm-user-pin"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M12 2a4.5 4.5 0 1 1 0 9 4.5 4.5 0 0 1 0-9zm0 11c4.5 0 8 2.6 8 5.6V21H4v-2.4C4 15.6 7.5 13 12 13z"/></svg></div></div>`,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        });
        userMarkerRef.current = L.marker([lat, lng], {
          icon,
          zIndexOffset: 2000,
          interactive: false,
        }).addTo(map);

        for (const { marker, spot } of markersRef.current) {
          marker.bindPopup(buildPopup(spot, { lat, lng }), { autoPan: true });
        }

        const within = markersRef.current.filter(
          ({ spot }) =>
            haversineKm({ lat, lng }, { lat: spot.lat, lng: spot.lng }) <= 5,
        );
        setNearby(within.length);
        map.setView([lat, lng], 14, { animate: true });
      },
      (err) => {
        setNearby(null);
        setNotice(
          err.code === err.PERMISSION_DENIED
            ? "Location permission denied — enable it to see what's near you."
            : "Couldn't get your location. Try again.",
        );
      },
      { enableHighAccuracy: true, timeout: 8000, maximumAge: 60000 },
    );
  }

  const visibleCount = active === "all" ? counts.all : (counts[active] ?? 0);

  return (
    <div className="flex flex-1 flex-col">
      {/* Top bar — mirrors the YumYumPo Vibe Map layout */}
      <div className="z-20 flex flex-col gap-2.5 border-b border-border bg-surface px-4 pb-3 pt-4 shadow-sm">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold tracking-tight">
            Vibe Map
            <span className="ml-2 align-middle text-xs font-medium text-muted">
              Where the vibe is right now
            </span>
          </h1>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={locate}
              className="rounded-full bg-glow px-3 py-1.5 text-xs font-bold text-white transition-transform active:scale-95"
            >
              📍 {located ? "Re-center" : "What's near me"}
            </button>
            <Link
              href="/"
              className="rounded-full bg-surface-elevated px-3 py-1.5 text-xs font-bold text-foreground ring-1 ring-border"
            >
              ‹ Home
            </Link>
          </div>
        </div>

        {/* Region row */}
        <div className="flex items-center gap-2.5">
          <label
            htmlFor="vm-region"
            className="shrink-0 text-xs font-bold text-foreground"
          >
            📍 Region
          </label>
          <select
            id="vm-region"
            value={region}
            onChange={(e) => setRegion(e.target.value)}
            className="min-w-0 flex-1 rounded-xl border border-border bg-surface-elevated px-3 py-1.5 text-xs font-bold text-foreground outline-none focus-visible:border-glow"
          >
            <option value="all">All regions ({vibeSpots.length})</option>
            {regions.map((r) => (
              <option key={r.key} value={r.key}>
                {r.label} ({r.count})
              </option>
            ))}
          </select>
          <span className="shrink-0 text-[11px] font-semibold text-muted">
            {visibleCount} shown
          </span>
        </div>

        {/* Vibe filter chips */}
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {VIBES.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => setActive(v.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
                active === v.id
                  ? "bg-foreground text-background"
                  : "bg-surface text-muted ring-1 ring-border"
              }`}
            >
              {v.label}
              <span
                className={`rounded-full px-1.5 text-[10px] ${
                  active === v.id ? "bg-background/25" : "bg-border"
                }`}
              >
                {counts[v.id] ?? 0}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="relative flex-1">
        <div id="vm-map" className="vm-leaflet absolute inset-0" />

        {loading && (
          <div className="absolute inset-0 z-[600] flex items-center justify-center bg-surface font-bold tracking-wide text-glow">
            Loading map…
          </div>
        )}

        {notice && (
          <div className="absolute inset-x-4 top-4 z-[600] mx-auto max-w-sm rounded-xl bg-foreground/92 px-4 py-2.5 text-center text-xs font-semibold text-background">
            {notice}
          </div>
        )}

        {visibleCount === 0 && !loading && (
          <div className="absolute inset-x-4 bottom-24 z-[600] mx-auto max-w-sm rounded-xl bg-foreground/90 px-4 py-3 text-center text-sm text-background">
            No spots match this filter yet. Try &ldquo;All&rdquo;.
          </div>
        )}

        {nearby !== null && (
          <div className="absolute left-1/2 top-4 z-[600] flex -translate-x-1/2 items-center gap-2 rounded-2xl bg-glow px-4 py-2.5 text-sm font-bold text-white shadow-lg">
            <span>📍</span>
            <span>
              {nearby
                ? `${nearby} ${nearby === 1 ? "spot" : "spots"} within 5 km`
                : "Nothing within 5 km — zoom out"}
            </span>
            <button
              type="button"
              onClick={() => setNearby(null)}
              aria-label="Dismiss"
              className="flex h-5 w-5 items-center justify-center rounded-full bg-black/20"
            >
              ×
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

/** Builds the Leaflet popup HTML for a spot. */
function buildPopup(
  spot: VibeSpot,
  userPos: { lat: number; lng: number } | null,
): string {
  const tags = spot.tags
    .slice(0, 3)
    .map((t) => `<span class="vm-pop-tag">${escapeHtml(t)}</span>`)
    .join("");

  let distRow = "";
  if (userPos) {
    const km = haversineKm(userPos, { lat: spot.lat, lng: spot.lng });
    distRow = `<div class="vm-pop-dist">
      <span>📍 ${fmtKm(km)} away</span>
      <span>🚶 ${fmtMins((km / 4.8) * 60)}</span>
      <span>🛵 ${fmtMins((km / 25) * 60)}</span>
    </div>`;
  }

  return `
    <img class="vm-pop-img" src="${spot.image}" alt="${escapeHtml(spot.name)}" loading="lazy" />
    <div class="vm-pop-body">
      <div class="vm-pop-name">${escapeHtml(spot.name)}</div>
      <div class="vm-pop-meta">${KIND_LABEL[spot.kind]} · ${spot.travelers} travelers here · ${escapeHtml(spot.location)}</div>
      <div class="vm-pop-tags">${tags}</div>
      ${distRow}
      <a class="vm-pop-btn" href="${spot.href}">View &amp; join</a>
    </div>`;
}

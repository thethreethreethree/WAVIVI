"use client";

import { useRouter } from "next/navigation";
import { renderToStaticMarkup } from "react-dom/server";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { Icon } from "@/components/ui/icon";
import {
  backpackDisplay,
  backpackLabel,
  MAX_BACKPACKS,
} from "@/lib/toolbox/backpacks";
import {
  CATEGORY_BY_ID,
  type CategoryId,
  isCategoryId,
  TOOLBOX_CATEGORIES,
} from "@/lib/toolbox/categories";
import type { UtilityRow } from "@/types/supabase";

import "leaflet/dist/leaflet.css";

/* ── Region shape returned by GET /api/regions. ─────────────────── */
interface Region {
  id: string;
  display_name: string;
  city: string | null;
  country: string | null;
  latitude: number;
  longitude: number;
  radius_km: number;
}

/** The 6 report types accepted by POST /api/reports. */
const REPORT_TYPES: { value: string; label: string }[] = [
  { value: "offline", label: "Offline / not working" },
  { value: "bad_service", label: "Bad service" },
  { value: "temp_closure", label: "Temporarily closed" },
  { value: "moved", label: "Moved location" },
  { value: "incorrect_info", label: "Incorrect info" },
  { value: "other", label: "Other" },
];

const DEFAULT_CENTER: [number, number] = [13.7563, 100.4977];
const DEFAULT_ZOOM = 6;

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
  return km < 1
    ? `${Math.round(km * 1000)} m`
    : `${km.toFixed(km < 10 ? 1 : 0)} km`;
}
function fmtMins(min: number): string {
  if (min < 1) return "<1 min";
  if (min < 60) return `${Math.round(min)} min`;
  return `${Math.floor(min / 60)}h ${Math.round(min % 60)}m`;
}

/**
 * Categories that warrant a photo on the card. Most utilities (ATM,
 * bathroom, police…) are plain points; Wi-Fi spots are usually cafes or
 * restaurants, so they get a venue image.
 */
const IMAGE_CATEGORIES = new Set<string>(["public_wifi"]);
/** Fallback venue photo per image-category, used when a pin has no own photo. */
const CATEGORY_FALLBACK_IMAGE: Record<string, string> = {
  public_wifi:
    "https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=600&q=70",
};

/** Pre-rendered SVG glyph markup for each category icon (used in divIcon). */
const CATEGORY_GLYPH: Record<CategoryId, string> = Object.fromEntries(
  TOOLBOX_CATEGORIES.map((c) => [
    c.id,
    renderToStaticMarkup(<Icon name={c.icon} strokeWidth={2.4} />),
  ]),
) as Record<CategoryId, string>;

/**
 * Traveler Toolbox Map — Leaflet map of utility pins (ATMs, banks, pharmacies,
 * …). Cloned from the Vibe Map; data comes from the live toolbox API routes.
 */
export function ToolboxMap({
  initialCategory,
}: {
  initialCategory?: CategoryId;
}) {
  const router = useRouter();
  const [active, setActive] = useState<CategoryId | "all">(
    initialCategory ?? "all",
  );
  const [regions, setRegions] = useState<Region[]>([]);
  const [region, setRegion] = useState<string>("");
  const [utilities, setUtilities] = useState<UtilityRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [located, setLocated] = useState(false);
  const [nearby, setNearby] = useState<number | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [selected, setSelected] = useState<UtilityRow | null>(null);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletRef = useRef<any>(null);
  const markersRef = useRef<
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    { marker: any; util: UtilityRow }[]
  >([]);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const userMarkerRef = useRef<any>(null);
  const userPosRef = useRef<{ lat: number; lng: number } | null>(null);

  // --- Load regions (once) --------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/regions");
        const json = await res.json();
        if (cancelled) return;
        const list: Region[] = json.regions ?? [];
        setRegions(list);
        if (list.length > 0) setRegion(list[0].id);
      } catch {
        if (!cancelled) setNotice("Couldn't load regions.");
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // --- Map init (once) ------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      const el = document.getElementById("tb-map");
      if (cancelled || !el || mapRef.current) return;
      leafletRef.current = L;

      const map = L.map(el, {
        center: DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
        zoomControl: true,
      });
      L.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager_nolabels/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 19,
          subdomains: "abcd",
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>',
        },
      ).addTo(map);
      mapRef.current = map;
      setTimeout(() => map.invalidateSize(), 150);
    })();

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
      markersRef.current = [];
    };
  }, []);

  // --- Fetch utilities whenever region / category changes -------------------
  useEffect(() => {
    if (!region) return;
    let cancelled = false;
    setLoading(true);
    (async () => {
      try {
        const params = new URLSearchParams({ region });
        if (active !== "all") params.set("category", active);
        const res = await fetch(`/api/utilities?${params.toString()}`);
        const json = await res.json();
        if (cancelled) return;
        setUtilities(json.utilities ?? []);
      } catch {
        if (!cancelled) {
          setUtilities([]);
          setNotice("Couldn't load utilities.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [region, active]);

  // --- Render markers whenever utilities change -----------------------------
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    for (const { marker } of markersRef.current) marker.remove();
    markersRef.current = [];

    const size = 38;
    const bounds = L.latLngBounds([]);
    for (const util of utilities) {
      const cat = isCategoryId(util.category) ? util.category : null;
      const glyph = cat ? CATEGORY_GLYPH[cat] : "";
      const cls = cat ?? "";
      const icon = L.divIcon({
        className: "",
        html: `<div class="vm-marker tb-marker ${cls}" title="${escapeHtml(
          util.name,
        )}">${glyph}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
      const marker = L.marker([util.latitude, util.longitude], { icon });
      marker.on("click", () => setSelected(util));
      marker.addTo(map);
      markersRef.current.push({ marker, util });
      bounds.extend([util.latitude, util.longitude]);
    }
    if (userPosRef.current) {
      bounds.extend([userPosRef.current.lat, userPosRef.current.lng]);
    }
    if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: 14 });
    } else {
      const r = regions.find((x) => x.id === region);
      if (r) map.setView([r.latitude, r.longitude], 12);
    }
  }, [utilities, region, regions]);

  // --- Geolocation ----------------------------------------------------------
  const locate = useCallback(() => {
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

        const within = markersRef.current.filter(
          ({ util }) =>
            haversineKm(
              { lat, lng },
              { lat: util.latitude, lng: util.longitude },
            ) <= 5,
        );
        setNearby(within.length);
        map.setView([lat, lng], 13, { animate: true });
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
  }, []);

  const totalCount = utilities.length;

  return (
    <div className="flex flex-1 flex-col">
      {/* Top bar — watercolor sunset orange, matching the app's brand */}
      <div className="bg-sunset relative z-20 flex flex-col gap-2.5 overflow-hidden px-4 pb-3 pt-[max(3rem,calc(env(safe-area-inset-top)+2rem))] shadow-card">
        <span
          className="paper-grain-coarse pointer-events-none absolute inset-0"
          aria-hidden
        />
        <div className="relative flex items-center justify-between gap-3">
          <h1 className="text-xl font-bold tracking-tight text-white">
            Toolbox Map
            <span className="ml-2 align-middle text-xs font-medium text-white/80">
              Find what you need nearby
            </span>
          </h1>
          <div className="flex shrink-0 items-center gap-2">
            <button
              type="button"
              onClick={locate}
              className="relative rounded-full px-3.5 py-2 text-xs font-extrabold text-white transition-transform active:scale-95"
            >
              <span
                className="wc-edge absolute inset-0 rounded-full border-2 border-white bg-glow"
                aria-hidden
              />
              <span className="relative">
                📍 {located ? "Re-center" : "What's near me"}
              </span>
            </button>
            <button
              type="button"
              onClick={() => router.back()}
              aria-label="Go back"
              className="wc-frame wc-frame-orange relative flex h-9 w-9 items-center justify-center rounded-full text-glow transition-transform active:scale-90"
            >
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.6"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="h-4 w-4"
                aria-hidden
              >
                <path d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          </div>
        </div>

        {/* Region row */}
        <div className="relative flex items-center gap-2.5">
          <label
            htmlFor="tb-region"
            className="shrink-0 text-xs font-bold text-white"
          >
            📍 Region
          </label>
          <div className="wc-frame wc-frame-white relative min-w-0 flex-1 rounded-xl">
            <select
              id="tb-region"
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full appearance-none bg-transparent px-3 py-1.5 pr-8 text-xs font-bold text-white outline-none"
            >
              {regions.length === 0 && (
                <option value="" className="text-foreground">
                  Loading regions…
                </option>
              )}
              {regions.map((r) => (
                <option key={r.id} value={r.id} className="text-foreground">
                  {r.display_name}
                </option>
              ))}
            </select>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.6"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-white"
              aria-hidden
            >
              <path d="M6 9l6 6 6-6" />
            </svg>
          </div>
          <span className="shrink-0 text-[11px] font-semibold text-white/80">
            {totalCount} shown
          </span>
        </div>

        {/* Category filter chips */}
        <div className="relative -mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <button
            type="button"
            onClick={() => setActive("all")}
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
              active === "all"
                ? "wc-frame wc-frame-white-solid text-glow"
                : "wc-frame wc-frame-white text-white"
            }`}
          >
            All
            <span
              className={`rounded-full px-1.5 text-[10px] font-extrabold ${
                active === "all" ? "bg-glow/15" : "bg-white/25"
              }`}
            >
              {active === "all" ? totalCount : ""}
            </span>
          </button>
          {TOOLBOX_CATEGORIES.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setActive(c.id)}
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-bold transition-colors ${
                active === c.id
                  ? "wc-frame wc-frame-white-solid text-glow"
                  : "wc-frame wc-frame-white text-white"
              }`}
            >
              <Icon name={c.icon} className="h-3.5 w-3.5" strokeWidth={2.2} />
              {c.label}
              {active === c.id && (
                <span className="rounded-full bg-glow/15 px-1.5 text-[10px] font-extrabold">
                  {totalCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="relative flex-1">
        <div id="tb-map" className="vm-leaflet absolute inset-0" />

        <span
          className="wc-edge-strong pointer-events-none absolute inset-0 z-[500] border-[14px] border-white"
          aria-hidden
        />

        <span className="pointer-events-none absolute bottom-3.5 right-4 z-[600] text-[9px] font-semibold tracking-wide text-foreground/45">
          Map data © OpenStreetMap, © CARTO
        </span>

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

        {totalCount === 0 && !loading && (
          <div className="absolute inset-x-4 bottom-24 z-[600] mx-auto max-w-sm rounded-xl bg-foreground/90 px-4 py-3 text-center text-sm text-background">
            No utilities match this filter yet. Try &ldquo;All&rdquo;.
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

        {/* Utility card / bottom-sheet */}
        {selected && (
          <UtilityCard
            key={selected.id}
            utility={selected}
            userPos={userPosRef.current}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
    </div>
  );
}

/* ── Bottom-sheet card for a tapped utility. ────────────────────── */
function UtilityCard({
  utility,
  userPos,
  onClose,
}: {
  utility: UtilityRow;
  userPos: { lat: number; lng: number } | null;
  onClose: () => void;
}) {
  const [up, setUp] = useState(utility.thumbs_up);
  const [down, setDown] = useState(utility.thumbs_down);
  const [vote, setVote] = useState<1 | -1 | 0>(0);
  const [voteMsg, setVoteMsg] = useState<string | null>(null);
  const [showReport, setShowReport] = useState(false);
  const [reportType, setReportType] = useState(REPORT_TYPES[0].value);
  const [reportNote, setReportNote] = useState("");
  const [reportMsg, setReportMsg] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const cat = isCategoryId(utility.category)
    ? CATEGORY_BY_ID[utility.category]
    : null;
  const bp = backpackDisplay(utility.backpack_rating);

  const distance =
    userPos &&
    fmtKm(
      haversineKm(userPos, {
        lat: utility.latitude,
        lng: utility.longitude,
      }),
    );

  async function castVote(value: 1 | -1) {
    setBusy(true);
    setVoteMsg(null);
    try {
      // Tapping the active vote again removes it.
      const remove = vote === value;
      const res = await fetch(`/api/utilities/${utility.id}/vote`, {
        method: remove ? "DELETE" : "POST",
        headers: { "Content-Type": "application/json" },
        body: remove ? undefined : JSON.stringify({ vote: value }),
      });
      if (res.status === 401) {
        setVoteMsg("Sign in to vote");
        return;
      }
      if (!res.ok) {
        setVoteMsg("Couldn't save your vote");
        return;
      }
      // Optimistically reconcile the counts.
      let nUp = utility.thumbs_up;
      let nDown = utility.thumbs_down;
      const next: 1 | -1 | 0 = remove ? 0 : value;
      if (next === 1) nUp += 1;
      if (next === -1) nDown += 1;
      setUp(nUp);
      setDown(nDown);
      setVote(next);
    } catch {
      setVoteMsg("Couldn't save your vote");
    } finally {
      setBusy(false);
    }
  }

  async function submitReport() {
    setBusy(true);
    setReportMsg(null);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          utility_id: utility.id,
          report_type: reportType,
          note: reportNote.trim() || undefined,
        }),
      });
      if (res.status === 401) {
        setReportMsg("Sign in to report");
        return;
      }
      if (!res.ok) {
        setReportMsg("Couldn't send your report");
        return;
      }
      setReportMsg("Thanks — report sent");
      setShowReport(false);
      setReportNote("");
    } catch {
      setReportMsg("Couldn't send your report");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="absolute inset-x-0 bottom-0 z-[700] px-3 pb-3">
      <div className="wc-frame wc-frame-white-solid tb-sheet relative mx-auto max-w-md rounded-3xl bg-surface p-5 text-foreground shadow-card">
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="wc-frame wc-frame-orange absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full text-glow active:scale-90"
        >
          ×
        </button>

        {/* Header */}
        <div className="flex items-start gap-3 pr-9">
          {cat && (
            <span
              className={`vm-marker tb-marker ${utility.category} flex h-11 w-11 shrink-0`}
            >
              <Icon name={cat.icon} className="h-5 w-5" strokeWidth={2.4} />
            </span>
          )}
          <div className="min-w-0">
            <h2 className="text-base font-bold leading-tight">
              {utility.name}
            </h2>
            <p className="text-xs font-semibold text-muted">
              {cat?.label ?? utility.category}
            </p>
          </div>
        </div>

        {utility.description && (
          <p className="mt-3 text-sm text-foreground/80">
            {utility.description}
          </p>
        )}

        {/* Backpack rating */}
        <div className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          <span className="tracking-wide" aria-label="Backpack rating">
            {Array.from({ length: bp.full }).map((_, i) => (
              <span key={`f${i}`}>🎒</span>
            ))}
            {bp.half === 1 && (
              <span className="opacity-60">🎒</span>
            )}
            {Array.from({ length: bp.empty }).map((_, i) => (
              <span key={`e${i}`} className="opacity-25">
                🎒
              </span>
            ))}
          </span>
          <span className="font-bold text-glow">
            {backpackLabel(utility.backpack_rating)}
          </span>
          {utility.rating != null && (
            <span className="text-xs font-semibold text-muted">
              {utility.rating.toFixed(1)} ★ · {utility.review_count} reviews
            </span>
          )}
        </div>
        <p className="sr-only">
          {utility.backpack_rating} of {MAX_BACKPACKS} backpacks
        </p>

        {/* Distance */}
        {distance && (
          <p className="mt-1 text-xs font-semibold text-muted">
            📍 {distance} away
          </p>
        )}

        {/* Vote counts */}
        <div className="mt-3 flex items-center gap-3 text-sm font-bold">
          <button
            type="button"
            disabled={busy}
            onClick={() => castVote(1)}
            className={`wc-frame ${
              vote === 1 ? "wc-frame-sunset text-white" : "wc-frame-orange"
            } flex items-center gap-1.5 rounded-full px-3 py-1.5 active:scale-95 disabled:opacity-50`}
          >
            👍 {up}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => castVote(-1)}
            className={`wc-frame ${
              vote === -1 ? "wc-frame-sunset text-white" : "wc-frame-orange"
            } flex items-center gap-1.5 rounded-full px-3 py-1.5 active:scale-95 disabled:opacity-50`}
          >
            👎 {down}
          </button>
          {voteMsg && (
            <span className="text-xs font-semibold text-glow">{voteMsg}</span>
          )}
        </div>

        {/* Action buttons */}
        <div className="mt-4 flex gap-2">
          <button
            type="button"
            onClick={() => window.open(utility.google_maps_url, "_blank")}
            className="wc-frame wc-frame-sunset flex-1 rounded-xl px-3 py-2.5 text-sm font-bold text-white active:scale-[0.98]"
          >
            🧭 Directions
          </button>
          <button
            type="button"
            onClick={() => setShowReport((s) => !s)}
            className="wc-frame wc-frame-orange rounded-xl px-3 py-2.5 text-sm font-bold text-glow active:scale-[0.98]"
          >
            ⚠️ Report
          </button>
        </div>

        {/* Report form */}
        {showReport && (
          <div className="mt-3 rounded-xl border border-foreground/10 bg-surface-elevated p-3">
            <label
              htmlFor="tb-report-type"
              className="text-xs font-bold text-foreground"
            >
              What's wrong?
            </label>
            <select
              id="tb-report-type"
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
              className="mt-1 w-full rounded-lg border border-foreground/15 bg-surface px-2.5 py-2 text-sm font-semibold outline-none"
            >
              {REPORT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
            <textarea
              value={reportNote}
              onChange={(e) => setReportNote(e.target.value)}
              placeholder="Add a note (optional)…"
              rows={2}
              className="mt-2 w-full resize-none rounded-lg border border-foreground/15 bg-surface px-2.5 py-2 text-sm outline-none"
            />
            <button
              type="button"
              disabled={busy}
              onClick={submitReport}
              className="wc-frame wc-frame-sunset mt-2 w-full rounded-lg px-3 py-2 text-sm font-bold text-white active:scale-[0.98] disabled:opacity-50"
            >
              Send report
            </button>
          </div>
        )}
        {reportMsg && (
          <p className="mt-2 text-xs font-semibold text-glow">{reportMsg}</p>
        )}
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}

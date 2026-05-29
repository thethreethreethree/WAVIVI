"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";

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
/** Default view — roughly a 5 km radius around the region centre. */
const DEFAULT_ZOOM = 13;
/** "What's near me" view — street-level, close in around the user. */
const NEARBY_ZOOM = 16;

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

/** A backpack glyph — orange, so it can be tinted via `text-*` (vs the emoji). */
function BackpackGlyph({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden
      className={className}
    >
      <path d="M9 4.8a3 3 0 0 1 6 0V6h.4A3.6 3.6 0 0 1 19 9.6V19a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9.6A3.6 3.6 0 0 1 8.6 6H9V4.8zm1.5 1.2h3V4.8a1.5 1.5 0 0 0-3 0V6zM9 11.5v2.2h6v-2.2H9z" />
    </svg>
  );
}

/** Watercolor icon markup for each category marker (used in divIcon).
   Single source of truth — /icons/map/ — that renders identically across
   every theme (light, dark, cute, sketch, orange). Inline width/height
   guarantee sizing even if cached CSS is stale. */
const MAP_ICON_BY_CATEGORY: Record<CategoryId, string> = {
  atm: "/icons/map/map_atm.png",
  market: "/icons/map/map_market.png",
  bank: "/icons/map/map_bank.png",
  sim_card: "/icons/map/map_sim_card.png",
  public_wifi: "/icons/map/map_public_wifi.png",
  currency_exchange: "/icons/map/map_currency_exchange.png",
  bathroom: "/icons/map/map_bathroom.png",
  transportation: "/icons/map/map_bus_stop.png",
  medical_clinic: "/icons/map/map_medical_clinic.png",
  police: "/icons/map/map_police.png",
  embassy: "/icons/map/map_embassy.png",
  laundry: "/icons/map/map_laundry.png",
};
const CATEGORY_GLYPH: Record<CategoryId, string> = Object.fromEntries(
  TOOLBOX_CATEGORIES.map((c) => {
    const src = MAP_ICON_BY_CATEGORY[c.id];
    const base = `width:56px;height:56px;object-fit:contain;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.4))`;
    return [c.id, `<img class="tb-pin-img" src="${src}" alt="" style="${base}" />`];
  }),
) as Record<CategoryId, string>;

/* ── Floating quality badge on a marker, by Google rating. ──────── */
const BALLOON_SVG =
  '<svg viewBox="0 0 22 30" aria-hidden>' +
  '<path fill="currentColor" stroke="#fffaf0" stroke-width="1.6" d="M11 1.6c5 0 8.6 3.9 8.6 8.8 0 5.7-5 9.7-7.1 11.1H9.5C7.4 20.1 2.4 16.1 2.4 10.4 2.4 5.5 6 1.6 11 1.6Z"/>' +
  '<path fill="currentColor" stroke="#fffaf0" stroke-width="1.2" d="M9.4 21.2h3.2L11 24Z"/>' +
  '<path fill="none" stroke="#fffaf0" stroke-width="1.3" stroke-linecap="round" d="M11 24.2c-1.7 1.5 1.7 3 0 4.6"/>' +
  "</svg>";
const THUMB_SVG =
  '<svg viewBox="0 0 24 24" aria-hidden>' +
  '<path fill="currentColor" stroke="#fffaf0" stroke-width="1.5" stroke-linejoin="round" ' +
  'd="M7.4 10.6v9.6H4.5c-.7 0-1.2-.5-1.2-1.2v-7.2c0-.7.5-1.2 1.2-1.2zM9.4 10.6l4-7.2c1.3-.1 2.3.9 2.1 2.2l-.6 3.4h4.7c1.3 0 2.3 1.2 2 2.5l-1.5 6.5c-.2 1-1.1 1.8-2.1 1.8H9.4z"/>' +
  "</svg>";

/** Returns the badge HTML for a marker, or "" when the rating is too low. */
function qualityBadge(rating: number | null): string {
  if (rating == null) return "";
  if (rating >= 4.5) return `<span class="tb-badge tb-badge-thumb">${THUMB_SVG}</span>`;
  if (rating >= 4) return `<span class="tb-badge tb-badge-green">${BALLOON_SVG}</span>`;
  if (rating >= 3) return `<span class="tb-badge tb-badge-red">${BALLOON_SVG}</span>`;
  return "";
}

/**
 * Traveler Toolbox Map — Leaflet map of utility pins (ATMs, banks, pharmacies,
 * …). Cloned from the Vibe Map; data comes from the live toolbox API routes.
 */
export function ToolboxMap({
  initialCategory,
  initialRegion,
}: {
  initialCategory?: CategoryId;
  initialRegion?: string;
}) {
  const router = useRouter();
  const [active, setActive] = useState<CategoryId | "all">(
    initialCategory ?? "all",
  );
  const [regions, setRegions] = useState<Region[]>([]);
  const [region, setRegion] = useState<string>(initialRegion ?? "");
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
        const res = await fetch("/api/regions", { cache: "no-store" });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { regions?: Region[] };
        if (cancelled) return;
        const list: Region[] = json.regions ?? [];
        setRegions(list);
        // Honour the global region cookie passed as initialRegion if it's
        // still in the active list; otherwise fall back to the first one.
        const preferred =
          initialRegion && list.some((r) => r.id === initialRegion)
            ? initialRegion
            : list[0]?.id ?? "";
        if (preferred) setRegion(preferred);
        else setNotice("No regions yet — add one in the admin Toolbox.");
      } catch (err) {
        if (!cancelled) {
          setNotice(`Couldn't load regions (${String(err)}).`);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialRegion]);

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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- standard fetch-on-mount flag
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

    const size = 60;
    // Inline styles so the marker layout renders correctly even with stale
    // cached CSS. No background / border — the watercolor icon art carries
    // its own shadow + halo, so the cream disc isn't needed.
    const pinStyle =
      "width:60px;height:60px;display:flex;align-items:center;" +
      "justify-content:center;background:transparent;border:0;" +
      "box-shadow:none";
    const bounds = L.latLngBounds([]);
    for (const util of utilities) {
      const cat = isCategoryId(util.category) ? util.category : null;
      const glyph = cat ? CATEGORY_GLYPH[cat] : "";
      const cls = cat ?? "";
      const badge = qualityBadge(util.rating);
      const icon = L.divIcon({
        className: "",
        html: `<div class="tb-pin ${cls}" style="${pinStyle}" title="${escapeHtml(
          util.name,
        )}">${glyph}${badge}</div>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
      });
      const marker = L.marker([util.latitude, util.longitude], { icon });
      marker.on("click", () => setSelected(util));
      marker.addTo(map);
      markersRef.current.push({ marker, util });
      bounds.extend([util.latitude, util.longitude]);
    }
    // Always frame the region at the default 5 km-radius zoom rather than
    // fitting all markers — fit-to-all forces the map to zoom out whenever
    // pins are spread across a wide region, which felt too distant.
    const r = regions.find((x) => x.id === region);
    if (r) {
      map.setView([r.latitude, r.longitude], DEFAULT_ZOOM);
    } else if (bounds.isValid()) {
      map.fitBounds(bounds, { padding: [60, 60], maxZoom: DEFAULT_ZOOM });
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
        map.setView([lat, lng], NEARBY_ZOOM, { animate: true });
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
    <div className="bg-sunset flex flex-1 flex-col">
      {/* Top bar — painted CHARCOAL nav background (nav_background1) as
          the bar's bg-image, with the paper-grain overlay kept on top for
          consistency with the rest of the painted app shell. */}
      <div
        className="relative z-20 flex flex-col gap-2.5 px-4 pb-3 pt-[max(3rem,calc(env(safe-area-inset-top)+2rem))] shadow-card"
        style={{
          backgroundImage: "url('/decor/frames/nav_background1.png')",
          backgroundSize: "cover",
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
        }}
      >
        <span
          className="paper-grain-coarse pointer-events-none absolute inset-0"
          aria-hidden
        />
        <div className="relative flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold tracking-tight text-white">
            Toolbox Map
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
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[#fdf4e2]/85 ring-2 ring-white/85 shadow-[0_2px_8px_-2px_rgba(120,70,30,0.25)] active:scale-90"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/icons/orange/back_arrow.png"
                alt=""
                aria-hidden
                className="back-wiggle h-7 w-7 object-contain"
              />
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
            className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
              active === "all"
                ? "wc-frame wc-frame-white-solid text-glow"
                : "wc-frame wc-frame-white text-white"
            }`}
          >
            All
            <span
              className={`rounded-full px-1.5 text-xs font-extrabold ${
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
              className={`flex shrink-0 items-center gap-1.5 rounded-full px-4 py-2 text-sm font-bold transition-colors ${
                active === c.id
                  ? "wc-frame wc-frame-white-solid text-glow"
                  : "wc-frame wc-frame-white text-white"
              }`}
            >
              <Icon name={c.icon} className="h-4 w-4" strokeWidth={2.2} />
              {c.label}
              {active === c.id && (
                <span className="rounded-full bg-glow/15 px-1.5 text-xs font-extrabold">
                  {totalCount}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* Map */}
      <div className="relative flex-1 bg-background">
        <div
          id="tb-map"
          className="tb-map-torn vm-leaflet absolute inset-0"
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
            // eslint-disable-next-line react-hooks/refs -- pass last known pos to the card; never used to render
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

  const km = userPos
    ? haversineKm(userPos, {
        lat: utility.latitude,
        lng: utility.longitude,
      })
    : null;
  // Photo precedence: explicit `photo_url` (CSV-imported / admin-edited)
  // → metadata_json.image (legacy) → per-category fallback art (only for
  // categories where a stock photo improves discovery, e.g. cafes/hostels).
  const explicitPhoto = utility.photo_url?.trim() || null;
  const hasImage = Boolean(explicitPhoto) || IMAGE_CATEGORIES.has(utility.category);
  const imageUrl =
    explicitPhoto ||
    (utility.metadata_json?.image as string | undefined) ||
    CATEGORY_FALLBACK_IMAGE[utility.category];
  const topPick = utility.backpack_rating >= 4.5;

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
      <div className="wc-frame tb-sheet relative mx-auto w-full max-w-[290px] rounded-3xl p-3 text-foreground shadow-card">
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="wc-frame wc-frame-orange absolute right-2 top-2 z-10 flex h-7 w-7 items-center justify-center rounded-full text-sm font-bold text-glow active:scale-90"
        >
          ×
        </button>

        {/* Venue photo — image categories only (e.g. Wi-Fi cafes) */}
        {hasImage && imageUrl && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={imageUrl}
            alt={utility.name}
            loading="lazy"
            className="wc-edge mb-2.5 h-[108px] w-full rounded-xl object-cover"
          />
        )}

        <div>
          {/* Header */}
          <div className="flex items-start gap-2">
            {!hasImage && cat && (
              <span className="wc-frame wc-frame-orange relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-glow">
                <Icon name={cat.icon} className="h-4 w-4" strokeWidth={2.4} />
              </span>
            )}
            <div className="min-w-0 flex-1 pr-6">
              <h2 className="text-[0.95rem] font-bold leading-snug">
                {utility.name}
                {topPick && (
                  <span className="ml-1.5 inline-block whitespace-nowrap rounded-full bg-sunset px-1.5 py-0.5 align-middle text-[9px] font-bold text-white">
                    ★ Top pick
                  </span>
                )}
              </h2>
              <p className="mt-0.5 text-[0.72rem] text-muted">
                <span className="font-semibold text-foreground">
                  {cat?.label ?? utility.category}
                </span>
                {utility.rating != null && (
                  <>
                    {" · ★ "}
                    {utility.rating.toFixed(1)} (
                    {utility.review_count.toLocaleString()})
                  </>
                )}
              </p>
            </div>
          </div>

          {/* Backpack rating */}
          <div className="mt-1.5 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-xs">
            <span
              className="flex items-center gap-0.5"
              aria-label="Backpack rating"
            >
              {Array.from({ length: bp.full }).map((_, i) => (
                <BackpackGlyph key={`f${i}`} className="h-3.5 w-3.5 text-glow" />
              ))}
              {bp.half === 1 && (
                <BackpackGlyph className="h-3.5 w-3.5 text-glow/50" />
              )}
              {Array.from({ length: bp.empty }).map((_, i) => (
                <BackpackGlyph
                  key={`e${i}`}
                  className="h-3.5 w-3.5 text-glow/20"
                />
              ))}
            </span>
            <span className="font-bold text-glow">
              {backpackLabel(utility.backpack_rating)}
            </span>
            <span className="sr-only">
              {utility.backpack_rating} of {MAX_BACKPACKS} backpacks
            </span>
          </div>

          {/* Tags — traveler notes as pills */}
          {utility.traveler_notes.length > 0 && (
            <div className="mt-1.5 flex flex-wrap gap-1">
              {utility.traveler_notes.map((note) => (
                <span
                  key={note}
                  className="wc-frame wc-frame-ghost rounded-full px-2 py-0.5 text-[10px] font-bold text-glow"
                >
                  {note}
                </span>
              ))}
            </div>
          )}

          {utility.description && (
            <p className="mt-1.5 text-[0.72rem] leading-snug text-foreground/75">
              {utility.description}
            </p>
          )}

          {/* Distance + travel times */}
          {km != null && (
            <div className="wc-frame wc-frame-orange mt-2 flex flex-wrap gap-x-3 gap-y-0.5 rounded-xl px-2.5 py-1.5 text-[11px] font-bold text-foreground">
              <span>📍 {fmtKm(km)} away</span>
              <span>🚶 {fmtMins((km / 4.8) * 60)}</span>
              <span>🛵 {fmtMins((km / 25) * 60)}</span>
            </div>
          )}

          {/* Action buttons */}
          <div className="mt-2.5 flex gap-1.5">
            <Link
              href={`/nav?lat=${utility.latitude}&lng=${utility.longitude}&name=${encodeURIComponent(utility.name)}`}
              className="wc-frame wc-frame-sunset flex-1 rounded-full px-3 py-2 text-center text-xs font-bold text-white active:scale-[0.98]"
            >
              Directions
            </Link>
            <button
              type="button"
              onClick={() => setShowReport((s) => !s)}
              className="wc-frame wc-frame-orange rounded-full px-3 py-2 text-xs font-bold text-glow active:scale-[0.98]"
            >
              ⚠️ Report
            </button>
          </div>

          {/* Vote row */}
          <div className="mt-2 flex items-center gap-1.5 text-xs font-bold">
            <button
              type="button"
              disabled={busy}
              onClick={() => castVote(1)}
              className={`wc-frame ${
                vote === 1 ? "wc-frame-sunset text-white" : "wc-frame-orange"
              } flex items-center gap-1 rounded-full px-2.5 py-1 active:scale-95 disabled:opacity-50`}
            >
              👍 {up}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => castVote(-1)}
              className={`wc-frame ${
                vote === -1 ? "wc-frame-sunset text-white" : "wc-frame-orange"
              } flex items-center gap-1 rounded-full px-2.5 py-1 active:scale-95 disabled:opacity-50`}
            >
              👎 {down}
            </button>
            {voteMsg && (
              <span className="text-[10px] font-semibold text-glow">
                {voteMsg}
              </span>
            )}
          </div>

          {/* Report form */}
          {showReport && (
            <div className="wc-frame wc-frame-orange mt-2 rounded-xl p-2.5">
              <label
                htmlFor="tb-report-type"
                className="text-[11px] font-bold text-foreground"
              >
                What&apos;s wrong?
              </label>
              <select
                id="tb-report-type"
                value={reportType}
                onChange={(e) => setReportType(e.target.value)}
                className="wc-frame mt-1 w-full rounded-lg bg-transparent px-2 py-1.5 text-xs font-semibold outline-none"
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
                className="wc-frame mt-1.5 w-full resize-none rounded-lg bg-transparent px-2 py-1.5 text-xs outline-none"
              />
              <button
                type="button"
                disabled={busy}
                onClick={submitReport}
                className="wc-frame wc-frame-sunset mt-1.5 w-full rounded-lg px-3 py-1.5 text-xs font-bold text-white active:scale-[0.98] disabled:opacity-50"
              >
                Send report
              </button>
            </div>
          )}
          {reportMsg && (
            <p className="mt-1.5 text-[11px] font-semibold text-glow">
              {reportMsg}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"]/g, (c) =>
    c === "&" ? "&amp;" : c === "<" ? "&lt;" : c === ">" ? "&gt;" : "&quot;",
  );
}

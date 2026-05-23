"use client";

import type * as L from "leaflet";
import { useEffect, useRef } from "react";

import type { NavRoute } from "@/lib/nav/osrm";

import "leaflet/dist/leaflet.css";

type Pos = { lat: number; lng: number };

interface Props {
  /** User location — drives the live "you are here" marker. May be null. */
  start: Pos | null;
  /** Compass heading in degrees from North (0–360). null = unknown
   *  (typically because the user isn't moving). When known, the user
   *  marker grows a directional cone like Google Maps' nav arrow. */
  heading: number | null;
  /** Destination coordinates — fixed for the life of the page. */
  end: Pos;
  /** Display name shown in the destination popup. */
  destinationName: string;
  /** Resolved route from OSRM; the polyline + bounds fit. May be null until fetched. */
  route: NavRoute | null;
}

/**
 * Leaflet-backed navigation map. Renders the route polyline (sunset orange),
 * a watercolor destination pin, and a live user-position marker. Uses the
 * same CARTO Voyager tiles as the Vibe Map so it matches the brand.
 *
 * Leaflet itself isn't SSR-safe (depends on window), so we initialise inside
 * useEffect after a dynamic import.
 */
export function NavMap({
  start,
  heading,
  end,
  destinationName,
  route,
}: Props) {
  const mapRef = useRef<L.Map | null>(null);
  const Lref = useRef<typeof L | null>(null);
  const layersRef = useRef<{
    route?: L.Polyline;
    user?: L.Marker;
    dest?: L.Marker;
  }>({});

  // --- Map init (once) ---
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const Lm = (await import("leaflet")).default;
      const el = document.getElementById("nav-map");
      if (cancelled || !el || mapRef.current) return;
      Lref.current = Lm;

      const map = Lm.map(el, {
        center: [end.lat, end.lng],
        zoom: 14,
        zoomControl: true,
      });
      Lm.tileLayer(
        "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
        {
          maxZoom: 19,
          subdomains: "abcd",
          attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        },
      ).addTo(map);

      const destEsc = destinationName.replace(/"/g, "&quot;");
      const destMarker = Lm.marker([end.lat, end.lng], {
        title: destinationName,
        icon: Lm.divIcon({
          className: "",
          html: `<div class="nav-pin nav-pin-dest" title="${destEsc}">📍</div>`,
          iconSize: [40, 40],
          iconAnchor: [20, 38],
        }),
      }).addTo(map);
      destMarker.bindPopup(
        `<div style="font-weight:700">${destEsc}</div>`,
      );
      layersRef.current.dest = destMarker;
      mapRef.current = map;

      // Leaflet caches the container size on init; if the container was
      // mid-layout when we initialised, the tiles can render with the wrong
      // origin and look blank/grey. invalidateSize() forces a re-measure.
      // We also re-run on resize for orientation changes.
      const invalidate = () => map.invalidateSize();
      // Two ticks: one after this microtask, one after the next paint.
      setTimeout(invalidate, 0);
      setTimeout(invalidate, 250);
      const ro = new ResizeObserver(invalidate);
      ro.observe(el);
      (map as unknown as { __ro?: ResizeObserver }).__ro = ro;
    })();
    return () => {
      cancelled = true;
      // Clean up Leaflet + the size observer on unmount to avoid the
      // "already initialized" error on back/forward navigation.
      const m = mapRef.current as
        | (L.Map & { __ro?: ResizeObserver })
        | null;
      m?.__ro?.disconnect();
      m?.remove();
      mapRef.current = null;
      layersRef.current = {};
    };
    // Intentionally empty deps — destination is stable for the page's life.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- User marker — created/updated whenever start changes. ---
  useEffect(() => {
    const Lm = Lref.current;
    const map = mapRef.current;
    if (!Lm || !map || !start) return;
    if (layersRef.current.user) {
      layersRef.current.user.setLatLng([start.lat, start.lng]);
    } else {
      layersRef.current.user = Lm.marker([start.lat, start.lng], {
        icon: Lm.divIcon({
          className: "",
          // The wrapper rotates with `--heading`; an inner cone fades in
          // when we actually know the direction.
          html: `
            <div class="nav-pin-user-wrap" style="--heading:0deg">
              <span class="nav-pin-user-cone" aria-hidden></span>
              <span class="nav-pin-user-dot" aria-hidden></span>
            </div>
          `,
          iconSize: [44, 44],
          iconAnchor: [22, 22],
        }),
      }).addTo(map);
    }
  }, [start]);

  // --- Heading — rotate the user-marker wrapper in place. Done by
  // mutating the existing element so we never re-create the marker mid-flight. ---
  useEffect(() => {
    const m = layersRef.current.user;
    if (!m) return;
    const el = m.getElement();
    const wrap = el?.querySelector(".nav-pin-user-wrap") as HTMLElement | null;
    if (!wrap) return;
    if (heading == null || Number.isNaN(heading)) {
      wrap.classList.remove("has-heading");
      return;
    }
    wrap.style.setProperty("--heading", `${heading}deg`);
    wrap.classList.add("has-heading");
  }, [heading, start]);

  // --- Route polyline — redrawn whenever the route changes. ---
  useEffect(() => {
    const Lm = Lref.current;
    const map = mapRef.current;
    if (!Lm || !map || !route) return;
    if (layersRef.current.route) {
      map.removeLayer(layersRef.current.route);
    }
    const latlngs: [number, number][] = route.geometry.map(([lng, lat]) => [
      lat,
      lng,
    ]);
    const poly = Lm.polyline(latlngs, {
      color: "#f7941d",
      weight: 6,
      opacity: 0.9,
      lineJoin: "round",
      lineCap: "round",
    }).addTo(map);
    layersRef.current.route = poly;
    map.fitBounds(poly.getBounds(), { padding: [40, 40] });
  }, [route]);

  return <div id="nav-map" className="h-full w-full" />;
}

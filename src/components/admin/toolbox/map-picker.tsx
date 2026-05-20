"use client";

import { useEffect, useRef } from "react";

import "leaflet/dist/leaflet.css";

const DEFAULT_CENTER: [number, number] = [13.7563, 100.5018];
const DEFAULT_ZOOM = 4;

interface MapPickerProps {
  value: { lat: number; lng: number } | null;
  radiusKm: number;
  onPick: (coord: { lat: number; lng: number }) => void;
}

/**
 * Leaflet map picker for the admin Toolbox. Clicking the map reports a
 * coordinate; a marker + scan-radius circle track the current value.
 */
export function MapPicker({ value, radiusKm, onPick }: MapPickerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const leafletRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const markerRef = useRef<any>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const circleRef = useRef<any>(null);
  const onPickRef = useRef(onPick);
  useEffect(() => {
    onPickRef.current = onPick;
  });

  // --- Map init (once) ------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    let map: unknown = null;

    (async () => {
      try {
        const L = (await import("leaflet")).default;
        const el = containerRef.current;
        if (cancelled || !el || mapRef.current) return;
        leafletRef.current = L;

        const created = L.map(el, {
          center: DEFAULT_CENTER,
          zoom: DEFAULT_ZOOM,
          zoomControl: true,
        });
        map = created;
        mapRef.current = created;

        L.tileLayer(
          "https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
          {
            maxZoom: 19,
            subdomains: "abcd",
            attribution:
              '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
          },
        ).addTo(created);

        created.on("click", (e: { latlng: { lat: number; lng: number } }) => {
          onPickRef.current({ lat: e.latlng.lat, lng: e.latlng.lng });
        });

        // Nudge sizing a few times — the form animates open around us.
        for (const delay of [100, 350, 700]) {
          setTimeout(() => {
            if (!cancelled) created.invalidateSize();
          }, delay);
        }
      } catch (err) {
        // The map is optional — manual lat/lng inputs still work.
        console.error("Map picker failed to initialize:", err);
      }
    })();

    return () => {
      cancelled = true;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (map as any)?.remove?.();
      mapRef.current = null;
      markerRef.current = null;
      circleRef.current = null;
    };
  }, []);

  // --- Marker + radius circle sync -----------------------------------------
  useEffect(() => {
    const L = leafletRef.current;
    const map = mapRef.current;
    if (!L || !map) return;

    if (!value) {
      markerRef.current?.remove();
      circleRef.current?.remove();
      markerRef.current = null;
      circleRef.current = null;
      return;
    }

    const latlng: [number, number] = [value.lat, value.lng];
    if (!markerRef.current) {
      const icon = L.divIcon({
        className: "",
        html: `<div style="width:20px;height:20px;border-radius:9999px;background:#f7941d;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,0.4)"></div>`,
        iconSize: [20, 20],
        iconAnchor: [10, 10],
      });
      markerRef.current = L.marker(latlng, { icon }).addTo(map);
    } else {
      markerRef.current.setLatLng(latlng);
    }

    if (!circleRef.current) {
      circleRef.current = L.circle(latlng, {
        radius: radiusKm * 1000,
        color: "#f7941d",
        weight: 2,
        fillColor: "#f7941d",
        fillOpacity: 0.12,
      }).addTo(map);
    } else {
      circleRef.current.setLatLng(latlng);
      circleRef.current.setRadius(radiusKm * 1000);
    }

    map.setView(latlng, Math.max(map.getZoom(), 11), { animate: true });
  }, [value, radiusKm]);

  return (
    <div
      ref={containerRef}
      className="h-64 w-full overflow-hidden rounded-xl ring-1 ring-border"
    />
  );
}

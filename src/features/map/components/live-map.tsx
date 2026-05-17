"use client";

import { useEffect, useRef, useState } from "react";

import mapboxgl from "mapbox-gl";

import { MAP_DEFAULTS } from "@/lib/mapbox/config";
import type { Traveler, TravelerStatus } from "@/lib/travelers/types";

import "mapbox-gl/dist/mapbox-gl.css";

const STATUS_COLOR: Record<TravelerStatus, string> = {
  exploring: "#19c3a8",
  local: "#7c5cff",
  transit: "#ff5d73",
  offline: "#9a9aae",
};

const STATUS_LABEL: Record<TravelerStatus, string> = {
  exploring: "Exploring",
  local: "Local",
  transit: "In transit",
  offline: "Offline",
};

/** Builds the DOM element used as a traveler map marker. */
function buildMarkerElement(traveler: Traveler): HTMLElement {
  const color = STATUS_COLOR[traveler.status];
  const el = document.createElement("div");
  el.className = "wavivi-marker";
  el.style.cssText = `
    width: 36px; height: 36px; border-radius: 9999px;
    display: flex; align-items: center; justify-content: center;
    font: 600 12px/1 var(--font-sans), system-ui, sans-serif;
    color: #fff; cursor: pointer;
    background: ${color}33; border: 2px solid ${color};
    box-shadow: 0 0 12px ${color}66;
  `;
  el.textContent = traveler.initials;
  return el;
}

/** Builds the popup HTML for a traveler. */
function buildPopupHtml(traveler: Traveler): string {
  const color = STATUS_COLOR[traveler.status];
  return `
    <div style="font-family: var(--font-sans), system-ui, sans-serif; min-width: 160px;">
      <div style="font-weight:600; font-size:14px;">${traveler.displayName}</div>
      <div style="color:#9a9aae; font-size:12px;">@${traveler.username}</div>
      <div style="margin-top:6px; font-size:12px;">${traveler.place}</div>
      <span style="display:inline-block; margin-top:6px; padding:1px 8px;
        border-radius:9999px; font-size:11px; font-weight:600;
        color:${color}; background:${color}22; border:1px solid ${color}66;">
        ${STATUS_LABEL[traveler.status]}
      </span>
    </div>
  `;
}

export function LiveMap({
  token,
  travelers,
}: {
  token: string;
  travelers: Traveler[];
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const [ready, setReady] = useState(false);

  // Initialise the map once.
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapboxgl.accessToken = token;
    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: MAP_DEFAULTS.style,
      center: MAP_DEFAULTS.center,
      zoom: MAP_DEFAULTS.zoom,
      minZoom: MAP_DEFAULTS.minZoom,
      maxZoom: MAP_DEFAULTS.maxZoom,
      attributionControl: false,
    });
    map.addControl(new mapboxgl.NavigationControl({ showCompass: false }), "bottom-right");
    map.on("load", () => setReady(true));
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [token]);

  // Render traveler markers.
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !ready) return;

    const markers = travelers.map((traveler) => {
      const popup = new mapboxgl.Popup({
        offset: 22,
        closeButton: false,
      }).setHTML(buildPopupHtml(traveler));

      return new mapboxgl.Marker({ element: buildMarkerElement(traveler) })
        .setLngLat(traveler.coords)
        .setPopup(popup)
        .addTo(map);
    });

    return () => markers.forEach((m) => m.remove());
  }, [ready, travelers]);

  /** Centre the map on the user's current position. */
  function locateMe() {
    if (!mapRef.current || !navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition((pos) => {
      mapRef.current?.flyTo({
        center: [pos.coords.longitude, pos.coords.latitude],
        zoom: 11,
      });
    });
  }

  return (
    <div className="relative h-full w-full">
      <div ref={containerRef} className="h-full w-full" />
      <button
        type="button"
        onClick={locateMe}
        className="absolute left-4 top-4 rounded-lg border border-border
                   bg-surface-elevated/90 px-3 py-2 text-sm font-medium
                   backdrop-blur transition-colors hover:text-cool"
      >
        Locate me
      </button>
    </div>
  );
}

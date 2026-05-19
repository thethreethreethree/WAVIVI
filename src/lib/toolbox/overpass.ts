import "server-only";

import { CATEGORY_BY_ID, type CategoryId } from "@/lib/toolbox/categories";
import type {
  DataSourceProvider,
  FetchOptions,
  RawPlace,
} from "@/lib/toolbox/types";

/**
 * OpenStreetMap Overpass data-source provider.
 *
 * Queries the public, keyless Overpass API for POIs in a region. Fails over
 * across mirrors and retries on rate-limit / timeout responses.
 */

const OVERPASS_ENDPOINTS = [
  "https://overpass-api.de/api/interpreter",
  "https://overpass.kumi.systems/api/interpreter",
  "https://maps.mail.ru/osm/tools/overpass/api/interpreter",
];

const MAX_ATTEMPTS = 5;

interface OverpassElement {
  type: "node" | "way" | "relation";
  id: number;
  lat?: number;
  lon?: number;
  center?: { lat: number; lon: number };
  tags?: Record<string, string>;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Build an Overpass QL query for one category around a point. */
function buildQuery(
  category: CategoryId,
  lat: number,
  lng: number,
  radiusM: number,
): string {
  const clauses = CATEGORY_BY_ID[category].osmFilters
    .map(
      (f) =>
        `  nwr["${f.key}"="${f.value}"](around:${radiusM},${lat},${lng});`,
    )
    .join("\n");
  return `[out:json][timeout:60];\n(\n${clauses}\n);\nout center tags;`;
}

/** Map an Overpass element to a provider-agnostic RawPlace. */
function toRawPlace(el: OverpassElement): RawPlace | null {
  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (lat == null || lon == null) return null;

  const tags = el.tags ?? {};
  const name = (tags.name ?? tags.brand ?? tags.operator ?? "").trim();

  return {
    sourceRef: `osm:${el.type}/${el.id}`,
    source: "osm",
    name,
    latitude: lat,
    longitude: lon,
    tags,
  };
}

export const overpassProvider: DataSourceProvider = {
  name: "osm-overpass",

  async fetchPlaces({
    category,
    latitude,
    longitude,
    radiusKm,
  }: FetchOptions): Promise<RawPlace[]> {
    const radiusM = Math.round(radiusKm * 1000);
    const query = buildQuery(category, latitude, longitude, radiusM);

    let lastError: unknown;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const endpoint = OVERPASS_ENDPOINTS[attempt % OVERPASS_ENDPOINTS.length];
      try {
        const res = await fetch(endpoint, {
          method: "POST",
          headers: {
            "Content-Type": "application/x-www-form-urlencoded",
            // Overpass etiquette: identify the client, or requests 406.
            "User-Agent": "WaviviToolbox/1.0 (+https://travejor.com)",
            Accept: "application/json",
          },
          body: `data=${encodeURIComponent(query)}`,
        });

        // Overpass signals overload with 429 / 504 — back off and retry.
        if (res.status === 429 || res.status === 504) {
          await sleep(2500 * (attempt + 1));
          continue;
        }
        if (!res.ok) throw new Error(`Overpass HTTP ${res.status}`);

        const json = (await res.json()) as { elements?: OverpassElement[] };
        return (json.elements ?? [])
          .map(toRawPlace)
          .filter((p): p is RawPlace => p !== null);
      } catch (err) {
        lastError = err;
        await sleep(1800 * (attempt + 1));
      }
    }

    throw new Error(
      `Overpass fetch failed after ${MAX_ATTEMPTS} attempts: ${String(lastError)}`,
    );
  },
};

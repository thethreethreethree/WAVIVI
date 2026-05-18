import { CATEGORY_BY_ID, type CategoryId } from "@/lib/toolbox/categories";
import type { RawPlace } from "@/lib/toolbox/types";

/**
 * Normalization — turns a provider's RawPlace into a clean, structured
 * utility record (pre-enrichment). Provider-agnostic.
 */

export interface NormalizedUtility {
  category: CategoryId;
  name: string;
  latitude: number;
  longitude: number;
  google_maps_url: string;
  address: string | null;
  phone: string | null;
  website: string | null;
  open_24_hours: boolean;
  source: string;
  source_ref: string;
  metadata_json: Record<string, unknown>;
}

/** The canonical short Google Maps link — never a long share URL. */
export function googleMapsUrl(lat: number, lng: number): string {
  return `https://maps.google.com/?q=${lat.toFixed(5)},${lng.toFixed(5)}`;
}

/** Assemble a human address from OSM `addr:*` tags, if present. */
function buildAddress(t: Record<string, string>): string | null {
  const line1 = [t["addr:housenumber"], t["addr:street"]]
    .filter(Boolean)
    .join(" ");
  const parts = [
    line1,
    t["addr:suburb"] ?? t["addr:district"],
    t["addr:city"] ?? t["addr:town"] ?? t["addr:village"],
    t["addr:province"] ?? t["addr:state"],
  ].filter((p): p is string => Boolean(p && p.trim()));
  return parts.length ? parts.join(", ") : null;
}

export function normalizePlace(
  place: RawPlace,
  category: CategoryId,
): NormalizedUtility {
  const t = place.tags;
  const name = place.name?.trim() || CATEGORY_BY_ID[category].label;
  const phone =
    t.phone ?? t["contact:phone"] ?? t["contact:mobile"] ?? null;
  const website = t.website ?? t["contact:website"] ?? t.url ?? null;
  const open24 = (t.opening_hours ?? "").trim() === "24/7";

  return {
    category,
    name,
    latitude: place.latitude,
    longitude: place.longitude,
    google_maps_url: googleMapsUrl(place.latitude, place.longitude),
    address: buildAddress(t),
    phone,
    website,
    open_24_hours: open24,
    source: place.source,
    source_ref: place.sourceRef,
    metadata_json: {
      osm_tags: t,
      opening_hours: t.opening_hours ?? null,
      brand: t.brand ?? t.operator ?? null,
      wheelchair: t.wheelchair ?? null,
      internet_access: t.internet_access ?? null,
      fee: t.fee ?? null,
    },
  };
}

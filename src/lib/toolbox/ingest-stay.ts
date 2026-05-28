import "server-only";

import { googleMapsUrl } from "@/lib/toolbox/normalize";
import type { StayInsert, StayType } from "@/types/supabase";

/**
 * Mapping layer between the Partner Collection browser extension's CSV
 * shape and the `stays` table.
 *
 * The extension produces rows with these headers (see DCS repo,
 * combined-extension/popup.js):
 *
 *   Title, Rating, Reviews, Phone, WhatsApp, Instagram, Facebook,
 *   Industry, Address, Website, Image, Amenities, Pitch,
 *   Latitude, Longitude, Google Maps Link
 *
 * It is provider-agnostic — the route handler decides how to react to
 * mapping failures (skip vs error).
 */

/** Raw row from the extension. All fields optional/strings; we validate. */
export type IngestRow = {
  Title?: string;
  Rating?: string | number;
  Reviews?: string | number;
  Phone?: string;
  WhatsApp?: string;
  Instagram?: string;
  Facebook?: string;
  Industry?: string;
  Address?: string;
  Website?: string;
  Image?: string;
  Amenities?: string;
  Pitch?: string;
  Latitude?: string | number;
  Longitude?: string | number;
  "Google Maps Link"?: string;
};

const STAY_TYPES: readonly StayType[] = [
  "hostel",
  "hotel",
  "guesthouse",
  "resort",
  "apartment",
  "bnb",
  "camping",
  "other",
];

/** Best-effort industry-string → StayType. Unknown → "other". */
export function industryToStayType(industry: string | undefined): StayType {
  const s = (industry ?? "").toLowerCase();
  if (!s) return "other";
  if (s.includes("hostel")) return "hostel";
  if (s.includes("resort")) return "resort";
  if (s.includes("guesthouse") || s.includes("guest house")) return "guesthouse";
  if (s.includes("bed") && s.includes("breakfast")) return "bnb";
  if (s.includes("b&b") || s.includes("b & b")) return "bnb";
  if (s.includes("camping") || s.includes("campsite") || s.includes("glamping"))
    return "camping";
  if (s.includes("apartment") || s.includes("apartelle")) return "apartment";
  if (s.includes("hotel") || s.includes("inn") || s.includes("lodge"))
    return "hotel";
  return "other";
}

/** Extract the Google Place ID (`!1s<hex>:<hex>`) from a Maps URL. */
export function extractPlaceId(mapsUrl: string | undefined): string | null {
  if (!mapsUrl) return null;
  const m = mapsUrl.match(/!1s([0-9a-fx:]+)/i);
  return m ? m[1].toLowerCase() : null;
}

function toNumber(v: unknown): number | null {
  if (v === null || v === undefined || v === "") return null;
  const n = Number(String(v).replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

function toInt(v: unknown): number {
  const n = toNumber(v);
  return n == null ? 0 : Math.round(n);
}

function clean(s: string | undefined | null): string | null {
  if (s == null) return null;
  const t = s.toString().trim();
  return t.length ? t : null;
}

/**
 * Convert an extension row to a `StayInsert`. Returns `null` if the
 * row lacks the minimum we need (name + coordinates + a stable source
 * reference). The caller can treat null as a skip.
 */
export function rowToStayInsert(
  row: IngestRow,
  opts: { regionId?: string | null } = {},
): StayInsert | null {
  const name = clean(row.Title);
  const lat = toNumber(row.Latitude);
  const lng = toNumber(row.Longitude);
  if (!name || lat == null || lng == null) return null;

  const mapsUrl = clean(row["Google Maps Link"]) ?? "";
  const placeId = extractPlaceId(mapsUrl);
  // Stable upsert key — prefer the Google Place ID; otherwise lat/lng + name.
  const source_ref = placeId
    ? `google:${placeId}`
    : `coords:${lat.toFixed(5)},${lng.toFixed(5)}:${name.slice(0, 40)}`;

  const stay_type = industryToStayType(row.Industry);
  if (!STAY_TYPES.includes(stay_type)) {
    // Defensive — should never trip since industryToStayType is exhaustive.
    return null;
  }

  const amenities = clean(row.Amenities)
    ? clean(row.Amenities)!
        .split(/\s*,\s*/)
        .filter(Boolean)
    : [];

  return {
    region_id: opts.regionId ?? null,
    stay_type,
    name,
    latitude: lat,
    longitude: lng,
    google_maps_url: mapsUrl || googleMapsUrl(lat, lng),
    address: clean(row.Address),
    phone: clean(row.Phone),
    whatsapp: clean(row.WhatsApp),
    instagram: clean(row.Instagram),
    facebook: clean(row.Facebook),
    website: clean(row.Website),
    photo_url: clean(row.Image),
    amenities,
    description: clean(row.Pitch),
    rating: toNumber(row.Rating),
    review_count: toInt(row.Reviews),
    source: "google_maps_extension",
    source_ref,
    needs_review: true,
    metadata_json: {
      ingested_at: new Date().toISOString(),
      industry_raw: clean(row.Industry),
    },
  };
}

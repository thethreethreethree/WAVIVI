/**
 * Stays CSV import — admin-uploaded CSV of hostels / hotels / etc.
 *
 * Same parser shape as the toolbox-utility import. Header names are matched
 * case-insensitively; column order and blank spacer columns don't matter.
 *
 * Recognised headers (all optional unless flagged required):
 *   Title* | Name                 — required
 *   Latitude* | Lat               — required
 *   Longitude* | Lng | Lon        — required
 *   Rating
 *   Reviews | Review Count
 *   Phone
 *   WhatsApp | WhatsApp Number
 *   Instagram | IG | Instagram Handle
 *   Facebook | FB
 *   Email
 *   Industry | Type | Stay Type   — overrides the import's default stay type per row
 *   Address
 *   Website
 *   Photo | Image | Photo URL
 *   Google Maps Link | Google Maps URL | Link | URL
 */

import type { StayType } from "@/types/supabase";

export interface StayCsvRow {
  name: string;
  stayType: StayType | null;
  rating: number | null;
  reviewCount: number;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  facebook: string | null;
  email: string | null;
  address: string | null;
  website: string | null;
  photoUrl: string | null;
  latitude: number;
  longitude: number;
  /** Stable dedup ref from the Google Maps link, or a coord-based fallback. */
  placeRef: string;
}

export interface StayCsvParseResult {
  rows: StayCsvRow[];
  /** Human-readable problems with skipped lines. */
  errors: string[];
}

/** Split one CSV line into fields, honouring "quoted, fields" and "" escapes. */
function parseCsvLine(line: string): string[] {
  const fields: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      fields.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  fields.push(cur);
  return fields.map((f) => f.trim());
}

/** Pull a stable place reference out of a Google Maps URL. */
export function extractPlaceRef(url: string): string | null {
  const cid = url.match(/!19s(ChIJ[\w-]+)/);
  if (cid) return `google:${cid[1]}`;
  const hex = url.match(/!1s(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)/);
  if (hex) return `google:${hex[1]}`;
  return null;
}

const num = (v: string | undefined): number | null => {
  if (v == null || v.trim() === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const KNOWN_STAY_TYPES = new Set<StayType>([
  "hostel",
  "hotel",
  "guesthouse",
  "resort",
  "apartment",
  "bnb",
  "camping",
  "other",
]);

/** Best-effort normalisation of an industry string into our stay_type values. */
function normaliseStayType(raw: string): StayType | null {
  const v = raw.trim().toLowerCase();
  if (!v) return null;
  if (KNOWN_STAY_TYPES.has(v as StayType)) return v as StayType;
  if (/hostel/.test(v)) return "hostel";
  if (/hotel|inn|lodge/.test(v)) return "hotel";
  if (/guest|pension/.test(v)) return "guesthouse";
  if (/resort/.test(v)) return "resort";
  if (/apart|condo|studio/.test(v)) return "apartment";
  if (/b\s*&?\s*b|bed.*breakfast/.test(v)) return "bnb";
  if (/camp|tent/.test(v)) return "camping";
  return "other";
}

/** Parse CSV text into structured stay rows, collecting per-line errors. */
export function parseStaysCsv(text: string): StayCsvParseResult {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  if (lines.length < 2) {
    return { rows: [], errors: ["CSV has no data rows."] };
  }

  const header = parseCsvLine(lines[0]).map((h) => h.toLowerCase());
  const col = (...names: string[]): number => {
    for (const n of names) {
      const i = header.indexOf(n);
      if (i !== -1) return i;
    }
    return -1;
  };
  const idx = {
    title: col("title", "name"),
    rating: col("rating"),
    reviews: col("reviews", "review count", "reviewcount"),
    phone: col("phone", "phone number"),
    whatsapp: col("whatsapp", "whatsapp number"),
    instagram: col("instagram", "ig", "instagram handle"),
    facebook: col("facebook", "fb"),
    email: col("email", "e-mail"),
    type: col("industry", "type", "stay type", "stay_type"),
    address: col("address"),
    website: col("website"),
    photo: col(
      "photo",
      "image",
      "photo url",
      "photo_url",
      "image url",
      "image_url",
    ),
    lat: col("latitude", "lat"),
    lng: col("longitude", "lng", "lon"),
    link: col("google maps link", "google maps url", "link", "url"),
  };

  if (idx.title === -1 || idx.lat === -1 || idx.lng === -1) {
    return {
      rows: [],
      errors: [
        "CSV must have at least Title, Latitude and Longitude columns.",
      ],
    };
  }

  const rows: StayCsvRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const f = parseCsvLine(lines[i]);
    const name = (f[idx.title] ?? "").trim();
    const lat = num(f[idx.lat]);
    const lng = num(f[idx.lng]);

    if (!name || lat == null || lng == null) {
      errors.push(`Row ${i + 1}: missing name or coordinates — skipped.`);
      continue;
    }
    if (lat < -90 || lat > 90 || lng < -180 || lng > 180) {
      errors.push(`Row ${i + 1}: coordinates out of range — skipped.`);
      continue;
    }

    const link = idx.link === -1 ? "" : (f[idx.link] ?? "").trim();
    const ratingRaw = idx.rating === -1 ? null : num(f[idx.rating]);
    const rating =
      ratingRaw != null ? Math.max(0, Math.min(5, ratingRaw)) : null;

    const photoRaw =
      idx.photo === -1 ? "" : (f[idx.photo] || "").trim();
    const photoUrl =
      photoRaw && /^https?:\/\//i.test(photoRaw) ? photoRaw : null;

    const stayType =
      idx.type === -1 ? null : normaliseStayType(f[idx.type] ?? "");

    const text = (i: number, alt = ""): string | null => {
      if (i === -1) return alt || null;
      const v = (f[i] ?? "").trim();
      return v || (alt || null);
    };

    rows.push({
      name,
      stayType,
      rating,
      reviewCount:
        idx.reviews === -1 ? 0 : Math.max(0, num(f[idx.reviews]) ?? 0),
      phone: text(idx.phone),
      whatsapp: text(idx.whatsapp),
      instagram: text(idx.instagram),
      facebook: text(idx.facebook),
      email: text(idx.email),
      address: text(idx.address),
      website: text(idx.website),
      photoUrl,
      latitude: lat,
      longitude: lng,
      placeRef:
        extractPlaceRef(link) ?? `csv:${lat.toFixed(5)},${lng.toFixed(5)}`,
    });
  }

  return { rows, errors };
}

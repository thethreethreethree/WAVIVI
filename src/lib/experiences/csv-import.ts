/**
 * Experiences CSV import — admin-uploaded CSV of tours / dives / kayak
 * rentals / viewpoints / etc. (anything that lives on the experiences
 * table).
 *
 * Same parser shape as the stays import. Header names are matched
 * case-insensitively; column order and blank spacer columns don't matter.
 *
 * Recognised headers (all optional unless flagged required):
 *   Title* | Name                 — required
 *   Latitude* | Lat               — required
 *   Longitude* | Lng | Lon        — required
 *   Activity Type | Type | Category  — free-text label (per the user's
 *                                       spec, "Industry" is NOT imported)
 *   Description
 *   Rating
 *   Reviews | Review Count
 *   Phone
 *   WhatsApp | WhatsApp Number
 *   Instagram | IG | Instagram Handle
 *   Facebook | FB
 *   Email
 *   Address
 *   Website
 *   Photo | Image | Photo URL
 *   Amenities                       — quoted comma-separated list, same
 *                                     canonical vocabulary as stays
 *   Google Maps Link | Google Maps URL | Link | URL
 *
 * The Industry column is intentionally ignored (it's noisy text scraped
 * from Google "Tourist attraction · 597X+9C", etc.).
 */

import { cleanPhone, parseAmenitiesCell } from "@/lib/stays/csv-import";

/** Normalise a Category cell to morning | midday | nighttime | null. */
export function normaliseDayBucket(raw: string | undefined): string | null {
  const v = (raw ?? "").trim().toLowerCase();
  if (!v) return null;
  if (v.includes("morning")) return "morning";
  if (v.includes("midday") || v.includes("noon") || v.includes("afternoon"))
    return "midday";
  if (v.includes("night") || v.includes("evening")) return "nighttime";
  return null;
}

export interface ExperienceCsvRow {
  name: string;
  activityType: string | null;
  dayBucket: string | null;
  description: string | null;
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
  amenities: string[];
  latitude: number;
  longitude: number;
  /** Stable dedup ref from the Google Maps link, or a coord-based fallback. */
  placeRef: string;
}

export interface ExperienceCsvParseResult {
  rows: ExperienceCsvRow[];
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
  if (v == null) return null;
  // Strip parens, commas, and whitespace so "(99)" and "1,234" parse.
  const cleaned = v.replace(/[(),\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

/** Parse CSV text into structured experience rows, collecting per-line errors. */
export function parseExperiencesCsv(text: string): ExperienceCsvParseResult {
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
    activityType: col("activity type", "activitytype", "type"),
    dayBucket: col("category", "day", "day bucket", "time", "bucket"),
    description: col("description", "pitch", "about"),
    rating: col("rating"),
    reviews: col("reviews", "review count", "reviewcount"),
    phone: col("phone", "phone number"),
    whatsapp: col("whatsapp", "whatsapp number"),
    instagram: col("instagram", "ig", "instagram handle"),
    facebook: col("facebook", "fb"),
    email: col("email", "e-mail"),
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
    amenities: col("amenities", "amenity", "features", "perks"),
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

  const rows: ExperienceCsvRow[] = [];
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
    // Google's default "no image" placeholder URL — treat as empty so the
    // detail card can fall back to the 🏠/emoji affordance instead of
    // rendering a generic grey avatar.
    const isDefaultPlaceholder =
      /servicebusiness\/default_user\.png$/.test(photoRaw);
    const photoUrl =
      photoRaw && /^https?:\/\//i.test(photoRaw) && !isDefaultPlaceholder
        ? photoRaw
        : null;

    const text = (i: number, alt = ""): string | null => {
      if (i === -1) return alt || null;
      const v = (f[i] ?? "").trim();
      return v || (alt || null);
    };

    rows.push({
      name,
      activityType: text(idx.activityType),
      dayBucket:
        idx.dayBucket === -1 ? null : normaliseDayBucket(f[idx.dayBucket]),
      description: text(idx.description),
      rating,
      reviewCount:
        idx.reviews === -1 ? 0 : Math.max(0, num(f[idx.reviews]) ?? 0),
      phone: cleanPhone(text(idx.phone)),
      whatsapp: text(idx.whatsapp),
      instagram: text(idx.instagram),
      facebook: text(idx.facebook),
      email: text(idx.email),
      address: text(idx.address),
      website: text(idx.website),
      photoUrl,
      amenities:
        idx.amenities === -1 ? [] : parseAmenitiesCell(f[idx.amenities]),
      latitude: lat,
      longitude: lng,
      placeRef:
        extractPlaceRef(link) ?? `csv:${lat.toFixed(5)},${lng.toFixed(5)}`,
    });
  }

  return { rows, errors };
}

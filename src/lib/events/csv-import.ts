/**
 * Events CSV import — admin-uploaded CSV of socials / nights out / meetups
 * / festivals. Same parser shape as experiences. Headers matched case-
 * insensitively; column order doesn't matter.
 *
 * Recognised headers (all optional unless flagged required):
 *   Title* | Name                 — required
 *   Latitude* | Lat               — required
 *   Longitude* | Lng | Lon        — required
 *   Category | Day                — MORNING / MIDDAY / NIGHTTIME bucket
 *   Event Type | Type             — theme label (Nightlife, Meetup, …)
 *   When | Date | Schedule        — human date/time label
 *   Description | Pitch | About
 *   Rating, Reviews
 *   Phone, WhatsApp, Instagram, Facebook, Email
 *   Address | Area
 *   Website
 *   Photo | Image
 *   Amenities
 *   Google Maps Link | Link | URL
 */

import {
  cleanPhone,
  parseAmenitiesCell,
} from "@/lib/stays/csv-import";
import { normaliseDayBucket } from "@/lib/experiences/csv-import";

export interface EventCsvRow {
  name: string;
  category: string | null;
  dayBucket: string | null;
  whenText: string | null;
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
  placeRef: string;
}

export interface EventCsvParseResult {
  rows: EventCsvRow[];
  errors: string[];
}

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

export function extractPlaceRef(url: string): string | null {
  const cid = url.match(/!19s(ChIJ[\w-]+)/);
  if (cid) return `google:${cid[1]}`;
  const hex = url.match(/!1s(0x[0-9a-fA-F]+:0x[0-9a-fA-F]+)/);
  if (hex) return `google:${hex[1]}`;
  return null;
}

const num = (v: string | undefined): number | null => {
  if (v == null) return null;
  const cleaned = v.replace(/[(),\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

export function parseEventsCsv(text: string): EventCsvParseResult {
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
    dayBucket: col("category", "day", "day bucket", "time", "bucket"),
    category: col("event type", "type", "theme"),
    whenText: col("when", "date", "schedule", "time of event"),
    description: col("description", "pitch", "about"),
    rating: col("rating"),
    reviews: col("reviews", "review count", "reviewcount"),
    phone: col("phone", "phone number"),
    whatsapp: col("whatsapp", "whatsapp number"),
    instagram: col("instagram", "ig", "instagram handle"),
    facebook: col("facebook", "fb"),
    email: col("email", "e-mail"),
    address: col("address", "area"),
    website: col("website"),
    photo: col("photo", "image", "photo url", "photo_url", "image url"),
    amenities: col("amenities", "amenity", "features", "perks"),
    lat: col("latitude", "lat"),
    lng: col("longitude", "lng", "lon"),
    link: col("google maps link", "google maps url", "link", "url"),
  };

  if (idx.title === -1 || idx.lat === -1 || idx.lng === -1) {
    return {
      rows: [],
      errors: ["CSV must have at least Title, Latitude and Longitude columns."],
    };
  }

  const rows: EventCsvRow[] = [];
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

    const photoRaw = idx.photo === -1 ? "" : (f[idx.photo] || "").trim();
    const isPlaceholder = /servicebusiness\/default_user\.png$/.test(photoRaw);
    const photoUrl =
      photoRaw && /^https?:\/\//i.test(photoRaw) && !isPlaceholder
        ? photoRaw
        : null;

    const text = (i: number): string | null => {
      if (i === -1) return null;
      const v = (f[i] ?? "").trim();
      return v || null;
    };

    rows.push({
      name,
      category: text(idx.category),
      dayBucket:
        idx.dayBucket === -1 ? null : normaliseDayBucket(f[idx.dayBucket]),
      whenText: text(idx.whenText),
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

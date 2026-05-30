import { parseCsv } from "../bulk-import/csv";

/**
 * Partner Collection CSV parser.
 *
 * Accepts the exact CSV shape the Partner Collection Chrome extension
 * exports, plus any column subset of it. Maps each row to a target
 * source table (stays / restaurants / experiences) via the Industry
 * column, then collects the fields that look like real updates.
 *
 * Unlike the bulk-import tool (which matches existing rows by id), this
 * one matches by Title within the target table — exactly the use case
 * for fixing broken photos / descriptions from a fresh partner scrape.
 *
 * Recognised columns (header names matched case-insensitively):
 *   Title                 — REQUIRED, matches existing row by name
 *   Industry              — REQUIRED, decides which table the row hits
 *   Pitch | Description   — copy update
 *   Address               — update
 *   Phone | WhatsApp | Instagram | Facebook | Email | Website  — direct
 *   Image | Photo | Photo URL                                   — photo_url
 *   IG_Img_1 ... IG_Img_6 — collected into photo_urls
 *   Amenities             — comma-separated, only updates stays
 *   Google Maps Link | Google Maps URL                          — google_maps_url
 *   Latitude, Longitude   — updated only when both present
 *
 * No inserts. Rows that don't match an existing record are skipped
 * (we'd need lat/lng + source_ref for a safe insert; usually missing).
 */

export type PartnerSource = "stays" | "restaurants" | "experiences";

const INDUSTRY_TO_SOURCE: Record<string, PartnerSource> = {
  // Stays — every common lodging type
  hostel: "stays",
  hotel: "stays",
  resort: "stays",
  inn: "stays",
  guesthouse: "stays",
  apartment: "stays",
  camping: "stays",
  "bed & breakfast": "stays",
  "bed and breakfast": "stays",
  bnb: "stays",
  "b&b": "stays",
  stay: "stays",
  // Restaurants — eating + drinking
  restaurant: "restaurants",
  cafe: "restaurants",
  bar: "restaurants",
  bakery: "restaurants",
  food: "restaurants",
  // Experiences — anything activity / tour-shaped
  experience: "experiences",
  tour: "experiences",
  activity: "experiences",
  adventure: "experiences",
};

/** What Industry value to write into stays.stay_type. Only used for stays. */
import type { StayType } from "@/types/supabase";
const INDUSTRY_TO_STAY_TYPE: Record<string, StayType> = {
  hostel: "hostel",
  hotel: "hotel",
  resort: "resort",
  inn: "other",
  guesthouse: "guesthouse",
  apartment: "apartment",
  camping: "camping",
  "bed & breakfast": "bnb",
  "bed and breakfast": "bnb",
  bnb: "bnb",
  "b&b": "bnb",
};

/** Aliases for each canonical column name — matched against header cells
 *  case-insensitively, trimmed, and with whitespace collapsed. */
const COLUMN_ALIASES: Record<string, string[]> = {
  title: ["title", "name"],
  industry: ["industry", "type", "category"],
  pitch: ["pitch", "description", "blurb", "summary"],
  address: ["address", "location"],
  phone: ["phone", "telephone"],
  whatsapp: ["whatsapp", "whatsapp number"],
  instagram: ["instagram", "ig", "instagram handle"],
  facebook: ["facebook", "fb"],
  email: ["email"],
  website: ["website", "url"],
  image: ["image", "photo", "photo url"],
  amenities: ["amenities"],
  google_maps_link: ["google maps link", "google maps url", "maps link"],
  latitude: ["latitude", "lat"],
  longitude: ["longitude", "lng", "lon"],
};

/** Build a header-name → column-index lookup. Unknown headers (IG_Img_*)
 *  are kept separately so we can collect them into photo_urls later. */
function indexHeaders(header: string[]): {
  byCanonical: Map<string, number>;
  igImgIndexes: number[];
} {
  const canonByAlias = new Map<string, string>();
  for (const [canon, aliases] of Object.entries(COLUMN_ALIASES)) {
    for (const a of aliases) canonByAlias.set(a, canon);
  }
  const byCanonical = new Map<string, number>();
  const igImgIndexes: number[] = [];
  for (let i = 0; i < header.length; i++) {
    const h = header[i].trim().toLowerCase().replace(/\s+/g, " ");
    if (!h) continue;
    if (/^ig[_ ]?img[_ ]?\d+$/i.test(h)) {
      igImgIndexes.push(i);
      continue;
    }
    const canon = canonByAlias.get(h);
    if (canon && !byCanonical.has(canon)) byCanonical.set(canon, i);
  }
  return { byCanonical, igImgIndexes };
}

/** A trimmed cell value, or null when blank. */
function cell(row: string[], i: number | undefined): string | null {
  if (i == null) return null;
  const v = (row[i] ?? "").trim();
  return v.length > 0 ? v : null;
}

export type ParsedPartnerRow =
  | {
      ok: true;
      lineNumber: number;
      source: PartnerSource;
      titleRaw: string;
      titleNorm: string;
      addressNorm: string | null;
      updates: Record<string, string | number | boolean | string[] | null>;
    }
  | {
      ok: false;
      lineNumber: number;
      raw: string[];
      reason: string;
    };

export interface ParseSummary {
  rows: ParsedPartnerRow[];
  headerError: string | null;
}

export function parsePartnerCsv(input: string): ParseSummary {
  const grid = parseCsv(input);
  if (grid.length === 0) {
    return { rows: [], headerError: "CSV is empty." };
  }
  const header = grid[0];
  const { byCanonical, igImgIndexes } = indexHeaders(header);

  if (!byCanonical.has("title")) {
    return {
      rows: [],
      headerError:
        'Header must include a "Title" (or "Name") column — that\'s what matches existing rows.',
    };
  }
  if (!byCanonical.has("industry")) {
    return {
      rows: [],
      headerError:
        'Header must include an "Industry" column (Hostel / Hotel / Restaurant / Experience / …).',
    };
  }

  const rows: ParsedPartnerRow[] = [];
  for (let i = 1; i < grid.length; i++) {
    const raw = grid[i];
    const lineNumber = i + 1;

    const title = cell(raw, byCanonical.get("title"));
    const industryRaw = cell(raw, byCanonical.get("industry"));
    if (!title) {
      rows.push({ ok: false, lineNumber, raw, reason: "Title is empty." });
      continue;
    }
    if (!industryRaw) {
      rows.push({
        ok: false,
        lineNumber,
        raw,
        reason: "Industry is empty — can't decide which table this row belongs to.",
      });
      continue;
    }
    const industryKey = industryRaw.trim().toLowerCase();
    const source = INDUSTRY_TO_SOURCE[industryKey];
    if (!source) {
      rows.push({
        ok: false,
        lineNumber,
        raw,
        reason: `Industry "${industryRaw}" doesn't map to stays / restaurants / experiences. Add it to INDUSTRY_TO_SOURCE if it should.`,
      });
      continue;
    }

    const updates: Record<string, string | number | boolean | string[] | null> =
      {};

    const pitch = cell(raw, byCanonical.get("pitch"));
    if (pitch) updates.description = pitch;

    const address = cell(raw, byCanonical.get("address"));
    if (address) updates.address = address;

    const phone = cell(raw, byCanonical.get("phone"));
    if (phone) updates.phone = phone;
    const whatsapp = cell(raw, byCanonical.get("whatsapp"));
    if (whatsapp) updates.whatsapp = whatsapp;
    const instagram = cell(raw, byCanonical.get("instagram"));
    if (instagram) updates.instagram = instagram;
    const facebook = cell(raw, byCanonical.get("facebook"));
    if (facebook) updates.facebook = facebook;
    const email = cell(raw, byCanonical.get("email"));
    if (email) updates.email = email;
    const website = cell(raw, byCanonical.get("website"));
    if (website) updates.website = website;

    const image = cell(raw, byCanonical.get("image"));
    if (image) updates.photo_url = image;

    // Collect IG_Img_1..N into photo_urls. Image (the primary) wins as
    // photo_url; the IG gallery feeds photo_urls.
    const igPhotos: string[] = [];
    for (const idx of igImgIndexes) {
      const v = cell(raw, idx);
      if (v) igPhotos.push(v);
    }
    if (igPhotos.length > 0) {
      updates.photo_urls = igPhotos;
      // Also fall back to first IG image when no primary Image cell was set.
      if (!updates.photo_url) updates.photo_url = igPhotos[0];
    }

    const mapsLink = cell(raw, byCanonical.get("google_maps_link"));
    if (mapsLink) updates.google_maps_url = mapsLink;

    const latS = cell(raw, byCanonical.get("latitude"));
    const lngS = cell(raw, byCanonical.get("longitude"));
    if (latS != null && lngS != null) {
      const lat = Number(latS);
      const lng = Number(lngS);
      if (Number.isFinite(lat) && Number.isFinite(lng)) {
        updates.latitude = lat;
        updates.longitude = lng;
      }
    }

    // Amenities only make sense on stays — restaurants/experiences have
    // their own narrower amenity vocabularies the partner CSV doesn't fill.
    if (source === "stays") {
      const amenitiesCell = cell(raw, byCanonical.get("amenities"));
      if (amenitiesCell) {
        const parts = amenitiesCell
          .split(",")
          .map((p) => p.trim())
          .filter(Boolean);
        if (parts.length > 0) updates.amenities = parts;
      }
      const stayType = INDUSTRY_TO_STAY_TYPE[industryKey];
      if (stayType) updates.stay_type = stayType;
    }

    if (Object.keys(updates).length === 0) {
      rows.push({
        ok: false,
        lineNumber,
        raw,
        reason: "Row has no fields to update (every value is blank).",
      });
      continue;
    }

    rows.push({
      ok: true,
      lineNumber,
      source,
      titleRaw: title,
      titleNorm: title.toLowerCase().trim().replace(/\s+/g, " "),
      addressNorm: address ? address.toLowerCase() : null,
      updates,
    });
  }

  return { rows, headerError: null };
}

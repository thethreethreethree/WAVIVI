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

/**
 * Canonical activity vocabulary. The importer classifies every row into one
 * of these (from its Activity Type column, or inferred from the name +
 * description when blank) so listings land in a sensible category instead of
 * a single forced default. Open-ended at the end — an unmatched row keeps its
 * own free-text label.
 */
export const ACTIVITY_CATEGORIES = [
  "Tour Operator",
  "Travel Agency",
  "Diving Center",
  "Snorkeling",
  "Island Hopping",
  "Kayaking",
  "Surfing",
  "Adventure Sports",
  "Hiking & Trekking",
  "Beach",
  "Scenic Viewpoint",
  "Waterfall",
  "Cultural & Historic",
  "Yoga Studio",
  "Wellness & Spa",
  "Gym & Fitness",
  "Cooking Class",
  "Nightlife",
  "Coworking Space",
  "other",
] as const;

/**
 * Keyword → canonical activity. Checked against the raw Activity Type cell
 * first, then the name + description. Order matters — earlier, more specific
 * matches win (e.g. "freediving" → Diving Center before "tour" → Tour Operator).
 */
const ACTIVITY_KEYWORDS: [RegExp, string][] = [
  [/dive|diving|scuba|freediv/i, "Diving Center"],
  [/snorkel/i, "Snorkeling"],
  [/island hop|island-hop|boat tour|banca/i, "Island Hopping"],
  [/kayak|canoe|paddle|sup\b/i, "Kayaking"],
  [/surf/i, "Surfing"],
  [/zipline|via ferrata|climb|paintball|atv|buggy|adventure/i, "Adventure Sports"],
  [/hike|hiking|trek|trail|summit|mountain/i, "Hiking & Trekking"],
  [/waterfall|falls\b/i, "Waterfall"],
  [/viewpoint|view deck|scenic|lookout|peak/i, "Scenic Viewpoint"],
  [/beach|lagoon|cove|sandbar/i, "Beach"],
  [/museum|heritage|historic|temple|church|cultural|shrine/i, "Cultural & Historic"],
  [/yoga/i, "Yoga Studio"],
  [/spa|massage|wellness|therm|hot spring/i, "Wellness & Spa"],
  [/gym|fitness|crossfit|muay|boxing/i, "Gym & Fitness"],
  [/cooking class|culinary class|cooking school/i, "Cooking Class"],
  [/\bbar\b|club|nightlife|lounge|pub/i, "Nightlife"],
  [/cowork|co-work/i, "Coworking Space"],
  [/travel agency|travel agent/i, "Travel Agency"],
  [/tour|excursion|expedition|sightsee|guide/i, "Tour Operator"],
];

/** Map a free-text activity label onto the canonical set, or null. */
function normaliseActivity(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  const exact = ACTIVITY_CATEGORIES.find(
    (c) => c.toLowerCase() === v.toLowerCase(),
  );
  if (exact) return exact;
  for (const [re, cat] of ACTIVITY_KEYWORDS) if (re.test(v)) return cat;
  return null;
}

/**
 * Decide an experience's activity type: explicit Activity Type cell first,
 * then infer from name + description, then the admin-chosen fallback. When the
 * admin picks "auto", an unclassifiable row keeps its raw cell (or "other").
 */
export function classifyActivityType(
  rawType: string | null,
  name: string,
  description: string | null,
  fallback: string,
): string {
  const cell = rawType?.trim() ?? "";
  const fromCell = cell ? normaliseActivity(cell) : null;
  if (fromCell) return fromCell;
  const haystack = `${name} ${description ?? ""}`;
  for (const [re, cat] of ACTIVITY_KEYWORDS) if (re.test(haystack)) return cat;
  if (fallback && fallback !== "auto") return fallback;
  // Auto mode with no match: keep the row's own label if it had one.
  return cell || "other";
}

/**
 * Broad category vocabulary — the high-level theme the filter chips group by.
 * Each specific activity type maps onto exactly one of these.
 */
export const EXPERIENCE_CATEGORIES = [
  "Adventure",
  "Water & Beach",
  "Nature & Scenic",
  "Wellness",
  "Culture & History",
  "Nightlife",
  "Tours & Guides",
  "Fitness",
  "Coworking",
  "other",
] as const;

/** Specific activity type → broad category. */
const ACTIVITY_TO_CATEGORY: Record<string, string> = {
  "Diving Center": "Water & Beach",
  Snorkeling: "Water & Beach",
  "Island Hopping": "Water & Beach",
  Kayaking: "Water & Beach",
  Surfing: "Water & Beach",
  Beach: "Water & Beach",
  "Adventure Sports": "Adventure",
  "Hiking & Trekking": "Adventure",
  Waterfall: "Nature & Scenic",
  "Scenic Viewpoint": "Nature & Scenic",
  "Cultural & Historic": "Culture & History",
  "Yoga Studio": "Wellness",
  "Wellness & Spa": "Wellness",
  "Gym & Fitness": "Fitness",
  "Cooking Class": "Culture & History",
  Nightlife: "Nightlife",
  "Coworking Space": "Coworking",
  "Tour Operator": "Tours & Guides",
  "Travel Agency": "Tours & Guides",
};

/**
 * Derive the broad category from an already-resolved activity type (and, as a
 * backstop, the name/description keywords). Returns "other" when nothing fits.
 */
export function classifyCategory(
  activityType: string,
  name: string,
  description: string | null,
): string {
  const direct = ACTIVITY_TO_CATEGORY[activityType];
  if (direct) return direct;
  const haystack = `${activityType} ${name} ${description ?? ""}`;
  for (const [re, cat] of ACTIVITY_KEYWORDS) {
    if (re.test(haystack)) {
      const mapped = ACTIVITY_TO_CATEGORY[cat];
      if (mapped) return mapped;
    }
  }
  return "other";
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
  /** Raw value of the CSV's `City` column when present. The batch-city
   *  import action resolves this to a city_id via a `cityResolver`. */
  city: string | null;
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
    city: col("city", "town", "municipality"),
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
      city: text(idx.city),
    });
  }

  return { rows, errors };
}

/**
 * Restaurants CSV import — admin-uploaded CSV of places to eat. Same parser
 * shape as experiences/events. Headers matched case-insensitively.
 *
 * Recognised headers (all optional unless flagged required):
 *   Title* | Name                 — required
 *   Latitude* | Lat               — required
 *   Longitude* | Lng | Lon        — required
 *   Cuisine | Type | Category      — cuisine label (Thai, Italian, …)
 *   Price | Price Range            — e.g. ₱, ₱₱, $$
 *   Description | Pitch | About
 *   Rating, Reviews
 *   Phone, WhatsApp, Instagram, Facebook, Email
 *   Address
 *   Website
 *   Photo | Image
 *   Amenities
 *   Google Maps Link | Link | URL
 */

import { cleanPhone, parseAmenitiesCell } from "@/lib/stays/csv-import";

/**
 * Canonical cuisine vocabulary the app filters against. The importer
 * classifies every row into one of these (from its Cuisine column, or
 * inferred from the name/description when blank) so listings always land
 * in a sensible category instead of a single forced default.
 */
export const CUISINE_CATEGORIES = [
  "Filipino",
  "Seafood",
  "Italian",
  "Pizza",
  "BBQ & Grill",
  "Cafe",
  "Bakery",
  "Bar",
  "Vegan",
  "Asian",
  "Japanese",
  "Korean",
  "Thai",
  "Indian",
  "Mexican",
  "Mediterranean",
  "Fast Food",
  "Desserts",
  "International",
  "other",
] as const;

/**
 * Keyword → canonical cuisine. Checked against the raw Cuisine cell first,
 * then the name + description. Order matters — earlier, more specific
 * matches win (e.g. "pizzeria" → Pizza before "italian" → Italian).
 */
const CUISINE_KEYWORDS: [RegExp, string][] = [
  [/pizz/i, "Pizza"],
  [/sushi|ramen|izakaya|japanese|teppan/i, "Japanese"],
  [/korean|bibimbap|kimchi|bbq korean/i, "Korean"],
  [/thai|pad thai/i, "Thai"],
  [/indian|curry house|tandoor/i, "Indian"],
  [/mexican|taco|burrito|cantina/i, "Mexican"],
  [/mediterran|greek|kebab|shawarma|falafel/i, "Mediterranean"],
  [/seafood|fish|grill.*seafood|oyster|crab|prawn/i, "Seafood"],
  [/vegan|plant-based|plant based/i, "Vegan"],
  [/veg(etarian)?\b/i, "Vegan"],
  [/bakery|bake shop|patisserie|bread/i, "Bakery"],
  [/dessert|gelato|ice cream|cake shop|sweets/i, "Desserts"],
  [/coffee|cafe|café|espresso|brew/i, "Cafe"],
  [/\bbar\b|pub|cocktail|lounge|brewery|beer/i, "Bar"],
  [/bbq|barbe|grill|steak|smokehouse/i, "BBQ & Grill"],
  [/fast food|burger|fried chicken|takeaway/i, "Fast Food"],
  [/filipino|lutong|carinderia|sisig|adobo|inasal/i, "Filipino"],
  [/italian|trattoria|osteria|pasta/i, "Italian"],
  [/asian|noodle|dimsum|dim sum|chinese|vietnam|pho/i, "Asian"],
];

/** Map a free-text cuisine label onto the canonical set, or null. */
function normaliseCuisine(raw: string): string | null {
  const v = raw.trim();
  if (!v) return null;
  // Exact (case-insensitive) match to a canonical value.
  const exact = CUISINE_CATEGORIES.find(
    (c) => c.toLowerCase() === v.toLowerCase(),
  );
  if (exact) return exact;
  // Keyword scan.
  for (const [re, cat] of CUISINE_KEYWORDS) if (re.test(v)) return cat;
  return null;
}

/**
 * Decide a restaurant's cuisine: explicit Cuisine cell first, then infer
 * from name + description, then the admin-chosen fallback. When the admin
 * picks "auto", an unclassifiable row becomes "other".
 */
export function classifyCuisine(
  rawCuisine: string | null,
  name: string,
  description: string | null,
  fallback: string,
): string {
  const fromCell = rawCuisine ? normaliseCuisine(rawCuisine) : null;
  if (fromCell) return fromCell;
  const haystack = `${name} ${description ?? ""}`;
  for (const [re, cat] of CUISINE_KEYWORDS) if (re.test(haystack)) return cat;
  if (fallback && fallback !== "auto") return fallback;
  return "other";
}

export interface RestaurantCsvRow {
  name: string;
  cuisine: string | null;
  priceRange: string | null;
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
  /** Raw value of the CSV's `City` column when present. The batch-city
   *  import action resolves this to a city_id via a `cityResolver`. */
  city: string | null;
}

export interface RestaurantCsvParseResult {
  rows: RestaurantCsvRow[];
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

export function parseRestaurantsCsv(text: string): RestaurantCsvParseResult {
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
    cuisine: col("cuisine", "type", "category", "industry"),
    priceRange: col("price", "price range", "price_range"),
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
    photo: col("photo", "image", "photo url", "photo_url", "image url"),
    amenities: col("amenities", "amenity", "features", "perks"),
    lat: col("latitude", "lat"),
    lng: col("longitude", "lng", "lon"),
    link: col("google maps link", "google maps url", "link", "url"),
    city: col("city", "town", "municipality"),
  };

  if (idx.title === -1 || idx.lat === -1 || idx.lng === -1) {
    return {
      rows: [],
      errors: ["CSV must have at least Title, Latitude and Longitude columns."],
    };
  }

  const rows: RestaurantCsvRow[] = [];
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
      cuisine: text(idx.cuisine),
      priceRange: text(idx.priceRange),
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

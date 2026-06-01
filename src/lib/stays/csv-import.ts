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
 *   Description | Pitch           — short marketing copy shown on the
 *                                   listing's detail page
 *   Address
 *   Website
 *   Photo | Image | Photo URL
 *   Amenities                       — quoted comma-separated list, normalised
 *                                     to a canonical set (Free Wi-Fi, Outdoor
 *                                     pool, Air conditioning, …); unknown
 *                                     entries are kept verbatim.
 *   Google Maps Link | Google Maps URL | Link | URL
 */

import type { StayType } from "@/types/supabase";

export interface StayCsvRow {
  name: string;
  stayType: StayType | null;
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
  /** Up to 6 Instagram gallery photos from IG_Img_1..6 columns. Stored in
   *  the stays.photo_urls array and shown as a swipeable hero gallery. */
  photoUrls: string[];
  amenities: string[];
  latitude: number;
  longitude: number;
  /** Stable dedup ref from the Google Maps link, or a coord-based fallback. */
  placeRef: string;
  /** Raw value of the CSV's `City` column when present. The batch-city
   *  import action resolves this to a city_id via a `cityResolver` it
   *  passes to the engine; legacy per-region uploaders leave it null. */
  city: string | null;
}

/**
 * Canonical amenity vocabulary travelers will filter against. The CSV
 * importer normalises raw Google-Maps amenity strings into these values;
 * anything unmatched is kept verbatim so we don't silently drop data.
 */
export const CANONICAL_AMENITIES = [
  "Free Wi-Fi",
  "Paid Wi-Fi",
  "Free parking",
  "Paid parking",
  "Free breakfast",
  "Paid breakfast",
  "Indoor pool",
  "Outdoor pool",
  "Air conditioning",
  "Fitness center",
  "Spa",
  "Bar",
  "Restaurant",
  "Room service",
  "24-hour front desk",
  "Full-service laundry",
  "Pet-friendly",
  "Kid-friendly",
  "Airport shuttle",
  "EV charger",
  "Wheelchair accessible",
  "Business center",
  "Meeting rooms",
  "Smoke-free property",
  "Beach access",
  "Hot tub",
  "Kitchen/Kitchenette in room",
  "All-inclusive available",
] as const;

const AMENITY_ALIASES: Record<string, string> = {
  "wi-fi": "Free Wi-Fi",
  wifi: "Free Wi-Fi",
  "free wi-fi": "Free Wi-Fi",
  "free wifi": "Free Wi-Fi",
  "paid wi-fi": "Paid Wi-Fi",
  "paid wifi": "Paid Wi-Fi",
  parking: "Free parking",
  "free parking": "Free parking",
  "paid parking": "Paid parking",
  breakfast: "Paid breakfast",
  "free breakfast": "Free breakfast",
  "paid breakfast": "Paid breakfast",
  pool: "Outdoor pool",
  "outdoor pool": "Outdoor pool",
  "indoor pool": "Indoor pool",
  "air-conditioned": "Air conditioning",
  "air conditioning": "Air conditioning",
  ac: "Air conditioning",
  "a/c": "Air conditioning",
  "fitness center": "Fitness center",
  gym: "Fitness center",
  spa: "Spa",
  bar: "Bar",
  restaurant: "Restaurant",
  "room service": "Room service",
  "24-hour front desk": "24-hour front desk",
  "24/7 front desk": "24-hour front desk",
  laundry: "Full-service laundry",
  "laundry service": "Full-service laundry",
  "full-service laundry": "Full-service laundry",
  "pet-friendly": "Pet-friendly",
  "kid-friendly": "Kid-friendly",
  "airport shuttle": "Airport shuttle",
  "free airport shuttle": "Airport shuttle",
  "ev charger": "EV charger",
  "ev charging": "EV charger",
  "wheelchair accessible": "Wheelchair accessible",
  accessible: "Wheelchair accessible",
  "business center": "Business center",
  "meeting rooms": "Meeting rooms",
  "smoke-free property": "Smoke-free property",
  "smoke-free": "Smoke-free property",
  "beach access": "Beach access",
  beachfront: "Beach access",
  "hot tub": "Hot tub",
  jacuzzi: "Hot tub",
  kitchen: "Kitchen/Kitchenette in room",
  kitchenette: "Kitchen/Kitchenette in room",
  "kitchen/kitchenette in room": "Kitchen/Kitchenette in room",
  "all-inclusive available": "All-inclusive available",
  "all-inclusive": "All-inclusive available",
};

/** Normalise a single raw amenity label. Returns null for empty input. */
function normaliseAmenity(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const canonical = AMENITY_ALIASES[trimmed.toLowerCase()];
  return canonical ?? trimmed;
}

/**
 * Public-asset icon path for an amenity, or null if we don't ship art
 * for that label. Filenames match the canonical labels (Title Case).
 */
const AMENITY_ICON_FILENAMES: Record<string, string> = {
  "Free Wi-Fi": "Free Wi-Fi.png",
  "Paid Wi-Fi": "Paid Wi-Fi.png",
  "Free parking": "Free Parking.png",
  "Paid parking": "Paid Parking.png",
  "Free breakfast": "Free Breakfast.png",
  "Paid breakfast": "Paid Breakfast.png",
  "Indoor pool": "Indoor Pool.png",
  "Outdoor pool": "Outdoor Pool.png",
  "Air conditioning": "Air Conditioning.png",
  "Fitness center": "Fitness Center.png",
  Spa: "Spa.png",
  Bar: "Bar.png",
  Restaurant: "Restaurant.png",
  "Room service": "Room Service.png",
  "24-hour front desk": "24-hour Front Desk.png",
  "Full-service laundry": "Full-service Laundry.png",
  "Pet-friendly": "Pet-friendly.png",
  "Kid-friendly": "Kid-friendly.png",
  "Airport shuttle": "Airport Shuttle.png",
  "EV charger": "EV Charger.png",
  "Beach access": "Beach Access.png",
  "Wheelchair accessible": "Wheelchair Accessible.png",
  "Kitchen/Kitchenette in room": "Kitchen_Kitchenette.png",
  // Non-canonical labels that the CSV keeps verbatim — we still ship art.
  Balcony: "Balcony.png",
  Garden: "Garden.png",
};

export function amenityIconPath(amenity: string): string | null {
  const file = AMENITY_ICON_FILENAMES[amenity];
  return file ? `/icons/amenities/${file}` : null;
}

/** Parse the CSV Amenities cell into a deduped, normalised string array. */
export function parseAmenitiesCell(cell: string | undefined): string[] {
  if (!cell) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const piece of cell.split(/[,;|]/)) {
    const normalised = normaliseAmenity(piece);
    if (!normalised) continue;
    const key = normalised.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(normalised);
  }
  return out;
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
  if (v == null) return null;
  // Strip parens, commas, and whitespace so "(99)" and "1,234" parse.
  const cleaned = v.replace(/[(),\s]/g, "");
  if (cleaned === "") return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
};

/**
 * Spreadsheets often mangle phone numbers into floats ("9952294563.0")
 * and drop the leading zero. Strip a trailing ".0" and restore the
 * leading 0 for 10-digit PH mobiles (9XXXXXXXXX → 09XXXXXXXXX).
 */
export const cleanPhone = (v: string | null): string | null => {
  if (!v) return v;
  let s = v.trim().replace(/\.0$/, "");
  if (/^9\d{9}$/.test(s)) s = `0${s}`;
  return s || null;
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
    description: col("description", "pitch", "about"),
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
    igImg1: col("ig_img_1", "ig img 1", "instagram_img_1", "instagram img 1"),
    igImg2: col("ig_img_2", "ig img 2", "instagram_img_2", "instagram img 2"),
    igImg3: col("ig_img_3", "ig img 3", "instagram_img_3", "instagram img 3"),
    igImg4: col("ig_img_4", "ig img 4", "instagram_img_4", "instagram img 4"),
    igImg5: col("ig_img_5", "ig img 5", "instagram_img_5", "instagram img 5"),
    igImg6: col("ig_img_6", "ig img 6", "instagram_img_6", "instagram img 6"),
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

    // Up to 6 Instagram gallery photos. Skip blanks and anything that isn't
    // a proper http(s) URL — the Instagram CDN frequently returns very long
    // signed URLs which we keep verbatim. Dedupe so the same image doesn't
    // appear twice if a column was filled with the cover URL.
    const galleryCandidates = [
      idx.igImg1,
      idx.igImg2,
      idx.igImg3,
      idx.igImg4,
      idx.igImg5,
      idx.igImg6,
    ]
      .filter((i) => i !== -1)
      .map((i) => (f[i] ?? "").trim())
      .filter((u) => u && /^https?:\/\//i.test(u));
    const photoUrls = Array.from(new Set(galleryCandidates));

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
      photoUrls,
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

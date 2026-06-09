"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/toolbox/admin";
import type { StayType } from "@/types/supabase";

import { SUSPECT_FILTER } from "./shared";

/**
 * Export the rows currently shown on /admin/data-quality as a CSV in the
 * scraper / batch-importer wide format — the same shape that
 * /admin/batch-utility-import (and the Partner Collection extension)
 * already accepts. Pre-fills every field FROM the existing DB row
 * including `Image` (the current photo URL, even if it's a placeholder)
 * and `Google Maps Link`, so admins can correct values in-place and
 * round-trip back through the importer.
 *
 * Workflow:
 *   1. /admin/data-quality lists rows with bad photo_url.
 *   2. Admin clicks "Export CSV" → downloads wide-format file.
 *   3. Admin opens it, replaces bad Image URLs with real photo URLs
 *      and corrects mis-classified Industry labels if any.
 *   4. Admin uploads the edited CSV to the matching importer
 *      (/admin/partner-import for places, /admin/batch-utility-import
 *      for utilities), which name-matches and updates the existing
 *      rows.
 *
 * 2026-06-09 — schema realignment: dropped the IG_Img_1..6 trailing
 * columns (Partner-import-only) and added Source Query + City so the
 * export now matches the scraper output the user imports verbatim. The
 * Image column used to be intentionally blank ("fill in the real photo
 * here") — it now ships the existing photo_url so admins can see what's
 * stored before deciding whether to replace it. Google Maps Link, which
 * was getting dropped in some round-trips, is preserved verbatim.
 */

/** Stay-type code → human Industry label seen in Partner exports. */
const STAY_TYPE_TO_INDUSTRY: Record<StayType, string> = {
  hostel: "Hostel",
  hotel: "Hotel",
  guesthouse: "Guesthouse",
  resort: "Resort",
  apartment: "Apartment",
  bnb: "Bed & breakfast",
  camping: "Camping",
  other: "Other",
};

/** CSV column order — exact match for the scraper output the user
 *  imports through /admin/batch-utility-import. Header names drive the
 *  parser on both sides, so swapping order is safe; adding columns
 *  isn't (the importer would silently ignore them). */
const HEADER = [
  "Title",
  "Rating",
  "Reviews",
  "Phone",
  "WhatsApp",
  "Instagram",
  "Facebook",
  "Industry",
  "Address",
  "Website",
  "Image",
  "Amenities",
  "Pitch",
  "Latitude",
  "Longitude",
  "Google Maps Link",
  "Source Query",
  "City",
];

/** RFC-4180 cell escape: wrap any field with comma / quote / newline in
 *  double quotes, doubling any internal quote. Empty / null → "". */
function csvCell(v: string | number | null | undefined): string {
  if (v == null) return "";
  const s = String(v);
  if (s.length === 0) return "";
  if (/[,"\r\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

/** Type of a single row in the scraper-format export. */
type ExportRow = {
  title: string;
  rating: number | null;
  reviews: number;
  phone: string | null;
  whatsapp: string | null;
  instagram: string | null;
  facebook: string | null;
  industry: string;
  address: string | null;
  website: string | null;
  /** Existing photo_url — even when placeholder/empty. Shown so the
   *  admin can see what's stored before deciding whether to replace. */
  image: string | null;
  amenities: string[];
  pitch: string | null;
  latitude: number;
  longitude: number;
  googleMapsLink: string;
  /** Always blank on export — the scraper sets this; we don't store
   *  it on the row. Kept in the header so importers that key on it
   *  don't reject the file. */
  sourceQuery: string;
  /** Resolved from city_id → cities.name in the export action below.
   *  Null when the row was never bucketed to a city. */
  city: string | null;
};

function rowToCsvLine(r: ExportRow): string {
  return [
    csvCell(r.title),
    csvCell(r.rating),
    csvCell(r.reviews),
    csvCell(r.phone),
    csvCell(r.whatsapp),
    csvCell(r.instagram),
    csvCell(r.facebook),
    csvCell(r.industry),
    csvCell(r.address),
    csvCell(r.website),
    csvCell(r.image),
    csvCell(r.amenities.join(", ")),
    csvCell(r.pitch),
    csvCell(r.latitude),
    csvCell(r.longitude),
    csvCell(r.googleMapsLink),
    csvCell(r.sourceQuery),
    csvCell(r.city),
  ].join(",");
}

export type ExportResult =
  | { ok: true; csv: string; rowCount: number }
  | { ok: false; error: string };

/** Server action — returns the CSV text + row count. The client wraps it
 *  in a Blob and triggers a download. */
export async function exportDataQualityCsv(): Promise<ExportResult> {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return { ok: false, error: "Not authorised." };

  const supabase = createAdminClient();

  // photo_url (singular) — the audit's suspect signal AND what we now
  // ship in the Image column. city_id — joined to cities.name below
  // for the City column.
  const select =
    "name, rating, review_count, phone, whatsapp, instagram, facebook, address, website, amenities, description, latitude, longitude, google_maps_url, photo_url, city_id";

  // stay_type is stays-only — selected separately so we can reverse-map to
  // an Industry label. Restaurants and experiences both export with a
  // single generic Industry (matches the format the user's CSV uses).
  const [staysRes, restaurantsRes, experiencesRes, citiesRes] =
    await Promise.all([
      supabase
        .from("stays")
        .select(`${select}, stay_type`)
        .or(SUSPECT_FILTER)
        .order("name", { ascending: true }),
      supabase
        .from("restaurants")
        .select(select)
        .or(SUSPECT_FILTER)
        .order("name", { ascending: true }),
      supabase
        .from("experiences")
        .select(select)
        .or(SUSPECT_FILTER)
        .order("name", { ascending: true }),
      // One-shot fetch of every city's name keyed by id — fewer round-
      // trips than per-row joins, and the whole `cities` table is small.
      supabase.from("cities").select("id, name"),
    ]);

  const cityNameById = new Map<string, string>();
  for (const c of (citiesRes.data ?? []) as { id: string; name: string }[]) {
    cityNameById.set(c.id, c.name);
  }

  type CommonRow = {
    name: string;
    rating: number | null;
    review_count: number;
    phone: string | null;
    whatsapp: string | null;
    instagram: string | null;
    facebook: string | null;
    address: string | null;
    website: string | null;
    amenities: string[];
    description: string | null;
    latitude: number;
    longitude: number;
    google_maps_url: string;
    photo_url: string | null;
    city_id: string | null;
  };
  type StayRowExt = CommonRow & { stay_type: StayType };

  function commonExport(r: CommonRow, industry: string): ExportRow {
    return {
      title: r.name,
      rating: r.rating,
      reviews: r.review_count ?? 0,
      phone: r.phone,
      whatsapp: r.whatsapp,
      instagram: r.instagram,
      facebook: r.facebook,
      industry,
      address: r.address,
      website: r.website,
      image: r.photo_url,
      amenities: r.amenities ?? [],
      pitch: r.description,
      latitude: r.latitude,
      longitude: r.longitude,
      googleMapsLink: r.google_maps_url,
      sourceQuery: "",
      city: r.city_id ? cityNameById.get(r.city_id) ?? null : null,
    };
  }

  const allRows: ExportRow[] = [];
  for (const s of (staysRes.data ?? []) as StayRowExt[]) {
    const industry = STAY_TYPE_TO_INDUSTRY[s.stay_type] ?? "Other";
    allRows.push(commonExport(s, industry));
  }
  for (const r of (restaurantsRes.data ?? []) as CommonRow[]) {
    allRows.push(commonExport(r, "Restaurant"));
  }
  for (const e of (experiencesRes.data ?? []) as CommonRow[]) {
    allRows.push(commonExport(e, "Experience"));
  }

  const lines = [HEADER.join(","), ...allRows.map(rowToCsvLine)];
  return { ok: true, csv: lines.join("\n"), rowCount: allRows.length };
}

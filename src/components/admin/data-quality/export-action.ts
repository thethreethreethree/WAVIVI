"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/toolbox/admin";
import type { StayType } from "@/types/supabase";

import { SUSPECT_FILTER } from "./shared";

/**
 * Export the rows currently shown on /admin/data-quality as a CSV in the
 * Partner Collection format — same shape the Partner import on
 * /admin/partner-import accepts. Pre-fills every field FROM the
 * existing DB row except the `Image` column, which is left blank so
 * the admin can paste a real photo URL and re-upload to fix the row.
 *
 * Workflow:
 *   1. /admin/data-quality lists rows with bad photo_url.
 *   2. Admin clicks "Export CSV" → downloads partner-collection-format file.
 *   3. Admin opens it, drops a real Image URL into the blank Image column
 *      for each row (and optionally tweaks IG_Img_1..6).
 *   4. Admin uploads the edited CSV to /admin/partner-import, which
 *      name-matches and updates the existing rows.
 *
 * The IG_Img_1..6 columns are pre-filled from the row's existing
 * `photo_urls` array so any working gallery photos aren't lost during
 * the round-trip.
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

/** CSV column order — must match the Partner Collection extension export
 *  so the round-trip through /admin/partner-import works without column
 *  remapping. Extending the order is safe (parser keys off header names). */
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
  "IG_Img_1",
  "IG_Img_2",
  "IG_Img_3",
  "IG_Img_4",
  "IG_Img_5",
  "IG_Img_6",
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

/** Type of a single row in the partner-format export. */
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
  // image deliberately empty
  amenities: string[];
  pitch: string | null;
  latitude: number;
  longitude: number;
  googleMapsLink: string;
  igImgs: string[]; // up to 6, padded with "" later
};

function rowToCsvLine(r: ExportRow): string {
  const ig: (string | null)[] = [...r.igImgs];
  while (ig.length < 6) ig.push("");
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
    // Image column intentionally blank — the whole point of the export.
    "",
    csvCell(r.amenities.join(", ")),
    csvCell(r.pitch),
    csvCell(r.latitude),
    csvCell(r.longitude),
    csvCell(r.googleMapsLink),
    csvCell(ig[0]),
    csvCell(ig[1]),
    csvCell(ig[2]),
    csvCell(ig[3]),
    csvCell(ig[4]),
    csvCell(ig[5]),
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

  const select =
    "name, rating, review_count, phone, whatsapp, instagram, facebook, address, website, amenities, description, latitude, longitude, google_maps_url, photo_urls";

  // stay_type is stays-only — selected separately so we can reverse-map to
  // an Industry label. Restaurants and experiences both export with a
  // single generic Industry (matches the format the user's CSV uses).
  const [staysRes, restaurantsRes, experiencesRes] = await Promise.all([
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
  ]);

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
    photo_urls: string[] | null;
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
      amenities: r.amenities ?? [],
      pitch: r.description,
      latitude: r.latitude,
      longitude: r.longitude,
      googleMapsLink: r.google_maps_url,
      igImgs: (r.photo_urls ?? []).slice(0, 6),
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

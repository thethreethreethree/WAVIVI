"use server";

import { revalidatePath } from "next/cache";

import { parseExperiencesCsv } from "@/lib/experiences/csv-import";
import { importExperiencesCsv } from "@/lib/experiences/csv-import-engine";
import { parseRestaurantsCsv } from "@/lib/restaurants/csv-import";
import { importRestaurantsCsv } from "@/lib/restaurants/csv-import-engine";
import { parseStaysCsv } from "@/lib/stays/csv-import";
import { importStaysCsv } from "@/lib/stays/csv-import-engine";
import { requireAdmin } from "@/lib/toolbox/admin";

import { splitCityCsv } from "./csv-router";

export interface BatchBucketResult {
  parsed: number;
  added: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export interface BatchCityImportResult {
  ok: boolean;
  /** Top-level error (auth, bad input). Per-bucket errors live in
   *  `<bucket>.errors`. */
  error: string | null;
  counts: {
    stays: number;
    restaurants: number;
    experiences: number;
    unrouted: number;
  };
  /** Per-row routing decisions (for the preview pane only — also returned
   *  on apply so the result panel can recap). Capped at 200 entries. */
  decisions: {
    lineNumber: number;
    title: string;
    bucket: "stays" | "restaurants" | "experiences" | "unrouted";
    reason: string;
  }[];
  stays: BatchBucketResult | null;
  restaurants: BatchBucketResult | null;
  experiences: BatchBucketResult | null;
}

/**
 * Server entrypoint for the Batch City Import tool. Takes ONE CSV
 * covering a city's stays + eats + things-to-do, splits it by the
 * Source Query column, and fans out to the existing per-region import
 * engines so the proven match-and-upsert + dedup behaviour is preserved
 * exactly.
 *
 * Old per-region uploaders (Stays / Eat / Experiences per region) are
 * untouched — this is an additive code path.
 */
/** Strip the Photo / Image columns out of a sub-CSV so the per-row
 *  photo mirror has nothing to fetch. Mirroring otherwise dominates the
 *  wall-clock on big imports (fetch + sharp + upload per row at
 *  ~500–700 ms each), which exceeds the serverless time budget long
 *  before the 600 rows finish. With photos cleared, rows still land
 *  with their google_maps_url and can be backfilled later from
 *  /admin/photo-mirror. */
function stripPhotoColumns(csv: string): string {
  const lines = csv.split(/\r?\n/);
  if (lines.length === 0) return csv;
  const header = lines[0];
  const cols = header.split(",");
  const PHOTO_ALIASES = new Set([
    "photo",
    "photos",
    "image",
    "images",
    "photo url",
    "photo_url",
    "photourl",
    "image url",
    "image_url",
    "imageurl",
    "photo urls",
    "photo_urls",
    "ig_img_1",
    "ig_img_2",
    "ig_img_3",
    "ig_img_4",
    "ig_img_5",
    "ig_img_6",
  ]);
  const toBlank: number[] = [];
  for (let i = 0; i < cols.length; i++) {
    const h = cols[i].trim().toLowerCase().replace(/^"|"$/g, "");
    if (PHOTO_ALIASES.has(h)) toBlank.push(i);
  }
  if (toBlank.length === 0) return csv;
  // Rebuild every row with the target columns blanked. We don't use a
  // full CSV parser here — the router already emitted RFC-4180-quoted
  // cells, and we only touch indices, not the cell content.
  const blankIndex = new Set(toBlank);
  const out: string[] = [header];
  for (let li = 1; li < lines.length; li++) {
    const line = lines[li];
    if (line === "") {
      out.push(line);
      continue;
    }
    const cells = splitCsvLine(line);
    for (const idx of blankIndex) {
      if (idx < cells.length) cells[idx] = "";
    }
    out.push(cells.join(","));
  }
  return out.join("\n");
}

/** RFC-4180 line splitter — handles quoted cells containing commas /
 *  doubled-quotes. Used only for the skip-photo path; the rest of the
 *  pipeline goes through the canonical parseCsv. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuote = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuote) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuote = false;
          cur += ch;
        }
      } else {
        cur += ch;
      }
    } else {
      if (ch === ",") {
        out.push(cur);
        cur = "";
      } else if (ch === '"' && cur === "") {
        inQuote = true;
        cur += ch;
      } else {
        cur += ch;
      }
    }
  }
  out.push(cur);
  return out;
}

export async function applyBatchCityImport(
  regionId: string,
  csvText: string,
  options: { skipPhotoMirror?: boolean } = {},
): Promise<BatchCityImportResult> {
  const empty = {
    counts: { stays: 0, restaurants: 0, experiences: 0, unrouted: 0 },
    decisions: [],
    stays: null,
    restaurants: null,
    experiences: null,
  };

  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return { ok: false, error: "Not authorised.", ...empty };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Auth check failed: ${msg}`, ...empty };
  }
  if (!regionId) {
    return { ok: false, error: "Pick a region first.", ...empty };
  }
  if (!csvText || !csvText.trim()) {
    return { ok: false, error: "CSV is empty.", ...empty };
  }

  let split: ReturnType<typeof splitCityCsv>;
  try {
    split = splitCityCsv(csvText);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `CSV split failed: ${msg}`, ...empty };
  }
  if (split.headerError) {
    return {
      ok: false,
      error: split.headerError,
      ...empty,
      counts: split.counts,
    };
  }

  // Cap the returned decisions list — admins only need to spot-check.
  const decisions = split.decisions.slice(0, 200);

  let staysResult: BatchBucketResult | null = null;
  let restaurantsResult: BatchBucketResult | null = null;
  let experiencesResult: BatchBucketResult | null = null;

  const staysCsv = split.stays
    ? options.skipPhotoMirror
      ? stripPhotoColumns(split.stays)
      : split.stays
    : null;
  const restaurantsCsv = split.restaurants
    ? options.skipPhotoMirror
      ? stripPhotoColumns(split.restaurants)
      : split.restaurants
    : null;
  const experiencesCsv = split.experiences
    ? options.skipPhotoMirror
      ? stripPhotoColumns(split.experiences)
      : split.experiences
    : null;

  // Per-bucket try/catch. Without this, a throw inside any engine call
  // (a Supabase RLS hit, a bad-row blow-up, a Storage timeout) crashes
  // the entire server action and the page renders the global error
  // boundary — admins see "Something went off-course" with no clue what
  // failed. Caught errors surface in the result panel as a parse warning
  // on the bucket that threw, and the other buckets still report.
  const recordThrow = (
    bucket: "stays" | "restaurants" | "experiences",
    err: unknown,
    rowCount: number,
  ): BatchBucketResult => {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[batch-city-import] ${bucket} threw:`, err);
    return {
      parsed: rowCount,
      added: 0,
      updated: 0,
      skipped: rowCount,
      errors: [`Engine threw before finishing: ${msg}`],
    };
  };

  if (staysCsv) {
    try {
      const { rows, errors } = parseStaysCsv(staysCsv);
      if (rows.length === 0) {
        staysResult = { parsed: 0, added: 0, updated: 0, skipped: 0, errors };
      } else {
        // `defaultStayType` is the fallback when a row has no per-row
        // Industry. The router already injected an Industry per row from
        // the Source Query, so "hotel" is just a belt-and-braces default.
        const res = await importStaysCsv(regionId, "hotel", rows);
        staysResult = { parsed: rows.length, ...res, errors };
      }
    } catch (err) {
      staysResult = recordThrow("stays", err, split.counts.stays);
    }
  }

  if (restaurantsCsv) {
    try {
      const { rows, errors } = parseRestaurantsCsv(restaurantsCsv);
      if (rows.length === 0) {
        restaurantsResult = { parsed: 0, added: 0, updated: 0, skipped: 0, errors };
      } else {
        // "auto" tells the restaurants engine to keyword-classify cuisine
        // from the name when the Cuisine cell is blank, matching how the
        // per-region restaurant uploader behaves.
        const res = await importRestaurantsCsv(regionId, "auto", rows);
        restaurantsResult = { parsed: rows.length, ...res, errors };
      }
    } catch (err) {
      restaurantsResult = recordThrow(
        "restaurants",
        err,
        split.counts.restaurants,
      );
    }
  }

  if (experiencesCsv) {
    try {
      const { rows, errors } = parseExperiencesCsv(experiencesCsv);
      if (rows.length === 0) {
        experiencesResult = { parsed: 0, added: 0, updated: 0, skipped: 0, errors };
      } else {
        const res = await importExperiencesCsv(regionId, "auto", rows);
        experiencesResult = { parsed: rows.length, ...res, errors };
      }
    } catch (err) {
      experiencesResult = recordThrow(
        "experiences",
        err,
        split.counts.experiences,
      );
    }
  }

  // Bust caches the per-region pages rely on — same paths the legacy
  // uploaders revalidate via their API routes.
  revalidatePath("/", "layout");
  revalidatePath(`/admin/stays/${regionId}`);
  revalidatePath(`/admin/eat/${regionId}`);
  revalidatePath(`/admin/experiences/${regionId}`);
  revalidatePath("/admin/data-quality");

  return {
    ok: true,
    error: null,
    counts: split.counts,
    decisions,
    stays: staysResult,
    restaurants: restaurantsResult,
    experiences: experiencesResult,
  };
}

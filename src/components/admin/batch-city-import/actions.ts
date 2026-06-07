"use server";

import { revalidatePath } from "next/cache";

import { parseExperiencesCsv } from "@/lib/experiences/csv-import";
import { importExperiencesCsv } from "@/lib/experiences/csv-import-engine";
import { parseRestaurantsCsv } from "@/lib/restaurants/csv-import";
import { importRestaurantsCsv } from "@/lib/restaurants/csv-import-engine";
import { parseStaysCsv } from "@/lib/stays/csv-import";
import { importStaysCsv } from "@/lib/stays/csv-import-engine";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/toolbox/admin";

import { splitCityCsv } from "./csv-router";
import { citySlug } from "./slug";
import type { CityIdMap } from "./slug";

// Don't re-export CityIdMap from this "use server" module — Turbopack's
// server-actions transform doesn't fully erase the type re-export and
// leaves a `CityIdMap` ReferenceError at module evaluation in the
// production build. Client/server callers import the type from
// "./slug" directly.

export interface BatchBucketResult {
  parsed: number;
  added: number;
  updated: number;
  skipped: number;
  errors: string[];
}

export type ImportBucket = "stays" | "restaurants" | "experiences";

export interface ApplyChunkResult {
  ok: boolean;
  error: string | null;
  result: BatchBucketResult | null;
}

/** Result of pre-warming the cities table from a fresh CSV. */
export interface EnsureCitiesResult {
  ok: boolean;
  error: string | null;
  /** Verbatim City-cell → city_id, ready to hand to applyBucketImport
   *  on every subsequent chunk call. */
  cityIdMap: CityIdMap;
  /** How many cities the action newly inserted vs. matched to existing
   *  rows. Surfaced in the result panel so admins can see the region
   *  growing over time. */
  created: number;
  matched: number;
}

/** Upsert one city per unique CSV `City` value for the given region.
 *  Returns the full name→city_id map for the client to thread through
 *  every chunked applyBucketImport call.
 *
 *  Idempotent: calling twice with the same names is a no-op the second
 *  time (unique constraint on (region_id, slug) collapses dupes). */
export async function ensureCitiesForRegion(
  regionId: string,
  cityNames: string[],
): Promise<EnsureCitiesResult> {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return {
        ok: false,
        error: "Not authorised.",
        cityIdMap: {},
        created: 0,
        matched: 0,
      };
    }
    if (!regionId) {
      return {
        ok: false,
        error: "Pick a region first.",
        cityIdMap: {},
        created: 0,
        matched: 0,
      };
    }

    // Dedupe by slug — two CSV cells like "Cebu City" and "cebu city"
    // collapse to one row. We keep the first-seen casing as the canonical
    // display name; admins can rename later.
    const bySlug = new Map<string, string>();
    for (const raw of cityNames) {
      const name = raw?.trim();
      if (!name) continue;
      const slug = citySlug(name);
      if (!slug) continue;
      if (!bySlug.has(slug)) bySlug.set(slug, name);
    }

    if (bySlug.size === 0) {
      return {
        ok: true,
        error: null,
        cityIdMap: {},
        created: 0,
        matched: 0,
      };
    }

    const supabase = createAdminClient();

    // 0) Verify the region still exists. A picker that's gone stale (e.g.
    //    the region was deleted in another tab using /admin/regions) would
    //    otherwise crash the insert below with a misleading
    //    "cities_region_id_fkey violation" message — admins read the FK
    //    error as a CSV/format problem when it's really a missing-region
    //    problem. Catch it here with a clear message instead.
    {
      const { data: regionRow, error: regionErr } = await supabase
        .from("regions")
        .select("id, display_name")
        .eq("id", regionId)
        .maybeSingle();
      if (regionErr) {
        return {
          ok: false,
          error: `Region lookup failed: ${regionErr.message}`,
          cityIdMap: {},
          created: 0,
          matched: 0,
        };
      }
      if (!regionRow) {
        return {
          ok: false,
          error:
            `Region "${regionId}" no longer exists. Refresh this page and pick a valid region, or recreate the region from /admin/regions first.`,
          cityIdMap: {},
          created: 0,
          matched: 0,
        };
      }
    }

    const slugs = Array.from(bySlug.keys());

    // 1) Look up rows already in this region by slug.
    const { data: existing, error: existErr } = await supabase
      .from("cities")
      .select("id, slug, name")
      .eq("region_id", regionId)
      .in("slug", slugs);
    if (existErr) {
      return {
        ok: false,
        error: `City lookup failed: ${existErr.message}`,
        cityIdMap: {},
        created: 0,
        matched: 0,
      };
    }
    const existingBySlug = new Map<string, { id: string; name: string }>();
    for (const row of existing ?? []) {
      existingBySlug.set(row.slug, { id: row.id, name: row.name });
    }

    // 2) Insert only the slugs that don't exist yet.
    const toInsert = slugs
      .filter((s) => !existingBySlug.has(s))
      .map((s) => ({
        region_id: regionId,
        slug: s,
        name: bySlug.get(s)!,
      }));

    let inserted: { id: string; slug: string; name: string }[] = [];
    if (toInsert.length > 0) {
      const { data, error } = await supabase
        .from("cities")
        .insert(toInsert)
        .select("id, slug, name");
      if (error) {
        return {
          ok: false,
          error: `City insert failed: ${error.message}`,
          cityIdMap: {},
          created: 0,
          matched: 0,
        };
      }
      inserted = data ?? [];
    }

    // 3) Build the verbatim-name → id map for every CSV value (not just
    //    the unique slugs) so the engine can look up by the raw cell.
    const slugToId = new Map<string, string>();
    for (const [slug, info] of existingBySlug) slugToId.set(slug, info.id);
    for (const row of inserted) slugToId.set(row.slug, row.id);

    const cityIdMap: CityIdMap = {};
    for (const raw of cityNames) {
      const name = raw?.trim();
      if (!name) continue;
      const slug = citySlug(name);
      const id = slugToId.get(slug);
      if (id) cityIdMap[name] = id;
    }

    return {
      ok: true,
      error: null,
      cityIdMap,
      created: inserted.length,
      matched: existingBySlug.size,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[batch-city-import] ensureCitiesForRegion threw:", err);
    return {
      ok: false,
      error: msg,
      cityIdMap: {},
      created: 0,
      matched: 0,
    };
  }
}

/**
 * Process ONE mini-CSV (one bucket, one chunk of rows). The client
 * splits each bucket CSV into row-chunks and calls this once per chunk
 * — keeps every server call comfortably inside Vercel's serverless
 * time budget so a 600-row import doesn't 504 mid-flight like it does
 * when applyBatchCityImport tries to do all three buckets in one shot.
 *
 * `chunkCsv` is a self-contained CSV: the original split's header row
 * plus only the rows the client wants this call to handle. Re-uses the
 * canonical parseStaysCsv / parseRestaurantsCsv / parseExperiencesCsv +
 * import engines — same dedup / upsert semantics as the per-region
 * uploaders, just over a slice.
 *
 * `cityIdMap` is the name→city_id map returned by `ensureCitiesForRegion`
 * at the start of the run. The action wraps it in a `cityResolver` and
 * hands it to the engine so each row writes the right city_id. When the
 * map is empty/omitted (legacy callers), rows land with city_id null.
 */
export async function applyBucketImport(
  regionId: string,
  chunkCsv: string,
  bucket: ImportBucket,
  skipPhotoMirror: boolean,
  cityIdMap: CityIdMap = {},
): Promise<ApplyChunkResult> {
  try {
    try {
      const { isAdmin } = await requireAdmin();
      if (!isAdmin) return { ok: false, error: "Not authorised.", result: null };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      return { ok: false, error: `Auth check failed: ${msg}`, result: null };
    }
    if (!regionId) return { ok: false, error: "Pick a region first.", result: null };
    if (!chunkCsv || !chunkCsv.trim()) {
      return { ok: false, error: "Chunk is empty.", result: null };
    }

    const csv = skipPhotoMirror ? stripPhotoColumns(chunkCsv) : chunkCsv;

    // Wrap the name→id map in the engine-shaped resolver. Sync return
    // is fine — no DB lookup per row, just a map hit. Unknown / blank
    // city cells return null and the engine leaves city_id unset.
    const cityResolver = (cityName: string | null): string | null => {
      if (!cityName) return null;
      const trimmed = cityName.trim();
      if (!trimmed) return null;
      return cityIdMap[trimmed] ?? null;
    };

    if (bucket === "stays") {
      const { rows, errors } = parseStaysCsv(csv);
      if (rows.length === 0) {
        return {
          ok: true,
          error: null,
          result: { parsed: 0, added: 0, updated: 0, skipped: 0, errors },
        };
      }
      const res = await importStaysCsv(regionId, "hotel", rows, cityResolver);
      return {
        ok: true,
        error: null,
        result: { parsed: rows.length, ...res, errors },
      };
    }
    if (bucket === "restaurants") {
      const { rows, errors } = parseRestaurantsCsv(csv);
      if (rows.length === 0) {
        return {
          ok: true,
          error: null,
          result: { parsed: 0, added: 0, updated: 0, skipped: 0, errors },
        };
      }
      const res = await importRestaurantsCsv(
        regionId,
        "auto",
        rows,
        cityResolver,
      );
      return {
        ok: true,
        error: null,
        result: { parsed: rows.length, ...res, errors },
      };
    }
    // experiences
    const { rows, errors } = parseExperiencesCsv(csv);
    if (rows.length === 0) {
      return {
        ok: true,
        error: null,
        result: { parsed: 0, added: 0, updated: 0, skipped: 0, errors },
      };
    }
    const res = await importExperiencesCsv(
      regionId,
      "auto",
      rows,
      cityResolver,
    );
    return {
      ok: true,
      error: null,
      result: { parsed: rows.length, ...res, errors },
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[batch-city-import] applyBucketImport(${bucket}) threw:`, err);
    return { ok: false, error: msg, result: null };
  }
}

/** Revalidate the per-region admin pages after the client has finished
 *  all chunks. Cheap, fire-and-forget — the client calls this once at the
 *  end so we're not busting caches between every chunk. */
export async function finishBatchCityImport(regionId: string): Promise<void> {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) return;
    revalidatePath("/", "layout");
    revalidatePath(`/admin/stays/${regionId}`);
    revalidatePath(`/admin/eat/${regionId}`);
    revalidatePath(`/admin/experiences/${regionId}`);
    revalidatePath("/admin/data-quality");
  } catch (err) {
    console.warn("[batch-city-import] finish revalidate failed:", err);
  }
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

  // Outer safety net — anything that escapes the per-step try/catches
  // (a thrown revalidatePath, an OOM, an unhandled rejection from an
  // engine that doesn't itself await) lands here instead of bubbling
  // into the page-level error boundary. The client renders the result
  // panel either way, and the admin can read the actual cause.
  try {
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
  try {
    revalidatePath("/", "layout");
    revalidatePath(`/admin/stays/${regionId}`);
    revalidatePath(`/admin/eat/${regionId}`);
    revalidatePath(`/admin/experiences/${regionId}`);
    revalidatePath("/admin/data-quality");
  } catch (err) {
    console.warn("[batch-city-import] revalidatePath failed", err);
  }

  return {
    ok: true,
    error: null,
    counts: split.counts,
    decisions,
    stays: staysResult,
    restaurants: restaurantsResult,
    experiences: experiencesResult,
  };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[batch-city-import] unhandled action error:", err);
    return {
      ok: false,
      error: `Unhandled error in batch import: ${msg}`,
      ...empty,
    };
  }
}

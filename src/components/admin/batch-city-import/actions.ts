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
export async function applyBatchCityImport(
  regionId: string,
  csvText: string,
): Promise<BatchCityImportResult> {
  const empty = {
    counts: { stays: 0, restaurants: 0, experiences: 0, unrouted: 0 },
    decisions: [],
    stays: null,
    restaurants: null,
    experiences: null,
  };

  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    return { ok: false, error: "Not authorised.", ...empty };
  }
  if (!regionId) {
    return { ok: false, error: "Pick a region first.", ...empty };
  }
  if (!csvText || !csvText.trim()) {
    return { ok: false, error: "CSV is empty.", ...empty };
  }

  const split = splitCityCsv(csvText);
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

  if (split.stays) {
    const { rows, errors } = parseStaysCsv(split.stays);
    if (rows.length === 0) {
      staysResult = { parsed: 0, added: 0, updated: 0, skipped: 0, errors };
    } else {
      // `defaultStayType` is the fallback when a row has no per-row
      // Industry. The router already injected an Industry per row from
      // the Source Query, so "hotel" is just a belt-and-braces default.
      const res = await importStaysCsv(regionId, "hotel", rows);
      staysResult = { parsed: rows.length, ...res, errors };
    }
  }

  if (split.restaurants) {
    const { rows, errors } = parseRestaurantsCsv(split.restaurants);
    if (rows.length === 0) {
      restaurantsResult = { parsed: 0, added: 0, updated: 0, skipped: 0, errors };
    } else {
      // "auto" tells the restaurants engine to keyword-classify cuisine
      // from the name when the Cuisine cell is blank, matching how the
      // per-region restaurant uploader behaves.
      const res = await importRestaurantsCsv(regionId, "auto", rows);
      restaurantsResult = { parsed: rows.length, ...res, errors };
    }
  }

  if (split.experiences) {
    const { rows, errors } = parseExperiencesCsv(split.experiences);
    if (rows.length === 0) {
      experiencesResult = { parsed: 0, added: 0, updated: 0, skipped: 0, errors };
    } else {
      const res = await importExperiencesCsv(regionId, "auto", rows);
      experiencesResult = { parsed: rows.length, ...res, errors };
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

"use server";

import { revalidatePath } from "next/cache";

import { parseBatchUtilityCsv } from "@/lib/toolbox/batch-csv-import";
import { importBatchUtilityRows } from "@/lib/toolbox/batch-csv-import-engine";
import { requireAdmin } from "@/lib/toolbox/admin";

import { ensureCitiesForRegion } from "../batch-city-import/actions";
import type { CityIdMap } from "../batch-city-import/slug";

/**
 * Server actions for the batch utility CSV import flow.
 *
 * Mirrors the place batch-city-import shape — chunked applies so a
 * 2000-row CSV doesn't trip Vercel's serverless timeout, and the same
 * `ensureCitiesForRegion` city-seeding action is reused so utilities
 * benefit from auto-created cities the same way places do.
 */

export interface BatchUtilityChunkResult {
  ok: boolean;
  error: string | null;
  added: number;
  updated: number;
  skipped: number;
  perCategory: Record<string, number>;
  rowErrors: string[];
}

/** Apply one chunk of utility rows from a parsed CSV. The client splits
 *  the file into ~75-row chunks and calls this once per chunk. */
export async function applyBatchUtilityImport(
  regionId: string,
  chunkCsv: string,
  cityIdMap: CityIdMap = {},
): Promise<BatchUtilityChunkResult> {
  const empty: BatchUtilityChunkResult = {
    ok: false,
    error: null,
    added: 0,
    updated: 0,
    skipped: 0,
    perCategory: {},
    rowErrors: [],
  };

  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) {
      return { ...empty, error: "Not authorised." };
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ...empty, error: `Auth check failed: ${msg}` };
  }

  if (!regionId) return { ...empty, error: "Pick a region first." };
  if (!chunkCsv || !chunkCsv.trim()) {
    return { ...empty, error: "Chunk is empty." };
  }

  const parsed = parseBatchUtilityCsv(chunkCsv);
  if (parsed.headerError) {
    return { ...empty, error: parsed.headerError };
  }
  if (parsed.rows.length === 0) {
    return {
      ...empty,
      ok: true,
      error: null,
      rowErrors: parsed.rowErrors,
    };
  }

  const cityResolver = (cityName: string | null): string | null => {
    if (!cityName) return null;
    return cityIdMap[cityName.trim()] ?? null;
  };

  try {
    const result = await importBatchUtilityRows(
      regionId,
      parsed.rows,
      cityResolver,
    );
    return {
      ok: true,
      error: null,
      added: result.added,
      updated: result.updated,
      skipped: result.skipped,
      perCategory: result.perCategory,
      rowErrors: parsed.rowErrors,
    };
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[batch-utility-import] engine threw:", err);
    return { ...empty, error: `Engine threw: ${msg}` };
  }
}

/** Bust the admin caches after the client finishes all chunks. Cheap,
 *  fire-and-forget. Same pattern as the place batch importer. */
export async function finishBatchUtilityImport(
  regionId: string,
): Promise<void> {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) return;
    revalidatePath("/", "layout");
    revalidatePath(`/admin/toolbox/${regionId}`);
    revalidatePath(`/admin/cities/${regionId}`);
  } catch (err) {
    console.warn("[batch-utility-import] finish revalidate failed:", err);
  }
}

// Re-export the city-seeding action so the client can use it without
// reaching into a sibling /admin import path.
export { ensureCitiesForRegion };

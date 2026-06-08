import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { CATEGORY_IDS, type CategoryId } from "@/lib/toolbox/categories";
import { dedupeUtilities } from "@/lib/toolbox/dedup";
import { enrichUtility } from "@/lib/toolbox/enrich";
import { normalizePlace } from "@/lib/toolbox/normalize";
import { overpassProvider } from "@/lib/toolbox/overpass";
import type { DataSourceProvider } from "@/lib/toolbox/types";
import type { UtilityInsert } from "@/types/supabase";

/**
 * Scan engine — orchestrates region × category scans.
 *
 * For each run it: fetches places via the data-source provider, normalizes,
 * deduplicates, enriches, and upserts into `traveler_utilities`, recording a
 * `scan_jobs` row + `scan_logs` lines. Runs with the service-role client.
 */

/** The active data source. Swap here to plug in a different provider. */
const provider: DataSourceProvider = overpassProvider;

/** Politeness delay between category scans (ms). */
const SCAN_THROTTLE_MS = 1200;

export interface ScanResult {
  category: CategoryId;
  found: number;
  saved: number;
  error?: string;
}

type AdminClient = ReturnType<typeof createAdminClient>;

async function logLine(
  supabase: AdminClient,
  jobId: string,
  level: "info" | "warn" | "error",
  message: string,
): Promise<void> {
  await supabase.from("scan_logs").insert({ scan_job_id: jobId, level, message });
}

/** Scan one category within one region. */
export async function scanRegionCategory(
  regionId: string,
  category: CategoryId,
): Promise<ScanResult> {
  const supabase = createAdminClient();

  const { data: region } = await supabase
    .from("regions")
    .select("*")
    .eq("id", regionId)
    .single();

  if (!region) {
    return { category, found: 0, saved: 0, error: "Region not found" };
  }

  const { data: job, error: jobError } = await supabase
    .from("scan_jobs")
    .insert({
      region_id: regionId,
      category,
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (jobError || !job) {
    return {
      category,
      found: 0,
      saved: 0,
      error: jobError?.message ?? "Could not create scan job",
    };
  }
  const jobId = job.id;

  try {
    // Per-city scan when cities have their own geo. The region.radius_km
    // is capped at 200 km in migration 0003, and a single circle from the
    // region centre can't cover a long region like Palawan (~400 km
    // N–S). Iterating each city's centre+radius means the union covers
    // the whole region accurately. Cities without geo set are ignored;
    // if NO city has geo we fall back to the original region-centre
    // scan so legacy regions still work.
    const { data: cityRows } = await supabase
      .from("cities")
      .select("id, name, latitude, longitude, radius_km")
      .eq("region_id", regionId)
      .not("latitude", "is", null)
      .not("longitude", "is", null)
      .not("radius_km", "is", null);
    const scanCircles =
      (cityRows ?? [])
        .filter(
          (c) => c.latitude != null && c.longitude != null && c.radius_km != null,
        )
        .map((c) => ({
          name: c.name,
          latitude: c.latitude as number,
          longitude: c.longitude as number,
          radiusKm: c.radius_km as number,
        }));

    const placesPool: Awaited<ReturnType<typeof provider.fetchPlaces>> = [];
    if (scanCircles.length === 0) {
      // Legacy path — one circle from region centre.
      const places = await provider.fetchPlaces({
        category,
        latitude: region.latitude,
        longitude: region.longitude,
        radiusKm: region.radius_km,
      });
      placesPool.push(...places);
      await logLine(
        supabase,
        jobId,
        "info",
        `Fetched ${places.length} ${category} place(s) via ${provider.name} (region-circle fallback — no cities with geo set)`,
      );
    } else {
      for (let i = 0; i < scanCircles.length; i++) {
        const c = scanCircles[i];
        const places = await provider.fetchPlaces({
          category,
          latitude: c.latitude,
          longitude: c.longitude,
          radiusKm: c.radiusKm,
        });
        placesPool.push(...places);
        await logLine(
          supabase,
          jobId,
          "info",
          `Fetched ${places.length} ${category} place(s) around ${c.name} (${c.radiusKm} km) via ${provider.name}`,
        );
        // Be polite to OSM between city scans, same as the inter-category
        // throttle in scanRegion. Skipped after the final city.
        if (i < scanCircles.length - 1) {
          await new Promise((r) => setTimeout(r, SCAN_THROTTLE_MS));
        }
      }
      await logLine(
        supabase,
        jobId,
        "info",
        `Pooled ${placesPool.length} ${category} place(s) across ${scanCircles.length} city circle(s) — deduping next.`,
      );
    }

    const normalized = dedupeUtilities(
      placesPool.map((p) => normalizePlace(p, category)),
    );

    const rows: UtilityInsert[] = normalized.map((n) => {
      const e = enrichUtility(n);
      return {
        region_id: regionId,
        category: n.category,
        name: n.name,
        latitude: n.latitude,
        longitude: n.longitude,
        google_maps_url: n.google_maps_url,
        address: n.address,
        phone: n.phone,
        website: n.website,
        open_24_hours: n.open_24_hours,
        reliability_score: e.reliability_score,
        crowd_level: e.crowd_level,
        description: e.description,
        traveler_notes: e.traveler_notes,
        source: n.source,
        source_ref: n.source_ref,
        metadata_json: n.metadata_json,
      };
    });

    let saved = 0;
    if (rows.length > 0) {
      // Upsert on the dedup key — keeps community thumbs / votes intact.
      const { error, count } = await supabase
        .from("traveler_utilities")
        .upsert(rows, {
          onConflict: "source,source_ref",
          count: "exact",
        });
      if (error) throw new Error(error.message);
      saved = count ?? rows.length;
    }

    await supabase
      .from("scan_jobs")
      .update({
        status: "completed",
        completed_at: new Date().toISOString(),
        total_found: placesPool.length,
        total_saved: saved,
      })
      .eq("id", jobId);
    await logLine(
      supabase,
      jobId,
      "info",
      `Saved ${saved} ${category} utility record(s)`,
    );

    return { category, found: placesPool.length, saved };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("scan_jobs")
      .update({
        status: "failed",
        completed_at: new Date().toISOString(),
        errors: message,
      })
      .eq("id", jobId);
    await logLine(supabase, jobId, "error", message);
    return { category, found: 0, saved: 0, error: message };
  }
}

/** Scan every toolbox category for a region (used on add + full rescan). */
export async function scanRegion(regionId: string): Promise<ScanResult[]> {
  const results: ScanResult[] = [];

  for (const category of CATEGORY_IDS) {
    results.push(await scanRegionCategory(regionId, category));
    await new Promise((r) => setTimeout(r, SCAN_THROTTLE_MS));
  }

  const supabase = createAdminClient();
  await supabase
    .from("regions")
    .update({ last_scan_at: new Date().toISOString() })
    .eq("id", regionId);

  return results;
}

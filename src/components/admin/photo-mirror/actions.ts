"use server";

import { revalidatePath } from "next/cache";

import { mirrorRowPhotos } from "@/lib/storage/place-photos";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/toolbox/admin";

/**
 * Photo Mirror — one-shot backfill action.
 *
 * Sweeps a table for rows whose `photo_url` (or, for stays, any entry in
 * `photo_urls[]`) still points at an external CDN (Instagram /
 * googleusercontent / Facebook). For each unmirrored row, fetches each
 * photo, downscales it to 600 px WebP via sharp, uploads it to the
 * `stays-photos` Supabase Storage bucket under a per-table prefix, and
 * rewrites the row's columns to the public Storage URLs.
 *
 * Designed for resumable use from an admin button — processes one chunk
 * per call and returns counts the UI can use to drive a progress loop.
 */

export type PhotoMirrorTable = "stays" | "restaurants" | "experiences";

export interface PhotoMirrorBatchResult {
  ok: boolean;
  error: string | null;
  table: PhotoMirrorTable;
  /** Rows attempted in this batch. */
  attempted: number;
  /** Rows where every URL ended up on our bucket after the call. */
  fullyMirrored: number;
  /** Rows where at least one URL stayed external (likely an expired
   *  token or a broken source). The next sweep will re-attempt them
   *  because the row still doesn't match the "fully mirrored" filter. */
  partial: number;
  /** Approximate count of rows still needing mirroring after this batch.
   *  Useful for the UI to know when to stop calling. */
  remainingEstimate: number;
}

const MIRROR_FRAGMENT = `/storage/v1/object/public/stays-photos/`;
const PER_BATCH_DEFAULT = 25;

/** A row only counts as "fully mirrored" when ITS primary photo_url is
 *  on our bucket AND (for stays) every gallery URL is too. */
function isFullyMirrored(
  photoUrl: string | null,
  photoUrls: string[] | null,
): boolean {
  if (photoUrl && !photoUrl.includes(MIRROR_FRAGMENT)) return false;
  if (photoUrls) {
    for (const u of photoUrls) {
      if (u && !u.includes(MIRROR_FRAGMENT)) return false;
    }
  }
  return true;
}

export async function mirrorPhotosBatch(
  table: PhotoMirrorTable,
  batchSize: number = PER_BATCH_DEFAULT,
): Promise<PhotoMirrorBatchResult> {
  const empty = {
    table,
    attempted: 0,
    fullyMirrored: 0,
    partial: 0,
    remainingEstimate: 0,
  };

  const { isAdmin } = await requireAdmin();
  if (!isAdmin) {
    return { ok: false, error: "Not authorised.", ...empty };
  }
  if (!["stays", "restaurants", "experiences"].includes(table)) {
    return { ok: false, error: `Unknown table: ${table}`, ...empty };
  }
  const limit = Math.min(Math.max(1, Math.floor(batchSize)), 100);

  const supabase = createAdminClient();

  // Pull a candidate chunk. We over-fetch (limit*4) and filter in JS
  // because Postgres can't easily express "any element of photo_urls
  // doesn't contain X" without a function — and the table sizes are
  // hundreds-to-low-thousands, not millions. Cheap.
  const includeGallery = table === "stays";
  const selectCols = includeGallery
    ? "id, source_ref, photo_url, photo_urls"
    : "id, source_ref, photo_url";

  const { data: rows, error: pickErr } = await supabase
    .from(table)
    .select(selectCols)
    .not("source_ref", "is", null)
    .limit(limit * 4);
  if (pickErr) {
    return { ok: false, error: pickErr.message, ...empty };
  }

  type Candidate = {
    id: string;
    source_ref: string | null;
    photo_url: string | null;
    photo_urls?: string[] | null;
  };
  const candidates = ((rows ?? []) as unknown as Candidate[]).filter(
    (r) => !isFullyMirrored(r.photo_url, r.photo_urls ?? null),
  );

  const todo = candidates.slice(0, limit);

  let fullyMirrored = 0;
  let partial = 0;

  for (const row of todo) {
    if (!row.source_ref) continue;

    const result = await mirrorRowPhotos(
      supabase,
      table,
      row.source_ref,
      row.photo_url,
      includeGallery ? (row.photo_urls ?? []) : [],
    );

    // Persist the rewritten URLs. Branch on `table` so the
    // discriminated supabase.from(...) types stay precise — log on
    // failure and continue so the rest of the batch still makes
    // progress.
    const primaryChanged = result.photoUrl !== row.photo_url;
    const prevGallery = row.photo_urls ?? [];
    const galleryChanged =
      includeGallery &&
      (result.photoUrls.length !== prevGallery.length ||
        result.photoUrls.some((v, i) => v !== prevGallery[i]));

    if (primaryChanged || galleryChanged) {
      let upErr: { message: string } | null = null;
      if (table === "stays") {
        const res = await supabase
          .from("stays")
          .update({
            ...(primaryChanged ? { photo_url: result.photoUrl } : {}),
            ...(galleryChanged ? { photo_urls: result.photoUrls } : {}),
          })
          .eq("id", row.id);
        upErr = res.error;
      } else if (table === "restaurants") {
        if (primaryChanged) {
          const res = await supabase
            .from("restaurants")
            .update({ photo_url: result.photoUrl })
            .eq("id", row.id);
          upErr = res.error;
        }
      } else {
        if (primaryChanged) {
          const res = await supabase
            .from("experiences")
            .update({ photo_url: result.photoUrl })
            .eq("id", row.id);
          upErr = res.error;
        }
      }
      if (upErr) {
        console.error("[photo-mirror] row update failed", upErr.message);
      }
    }

    if (
      isFullyMirrored(
        result.photoUrl,
        includeGallery ? result.photoUrls : null,
      )
    ) {
      fullyMirrored++;
    } else {
      partial++;
    }
  }

  // Cheap estimate of how many rows still need work — based on the
  // candidates we pulled this round. Not exact (the count would need a
  // full second scan) but good enough to drive the "Run next batch"
  // loop on the UI side.
  const remainingEstimate = Math.max(0, candidates.length - todo.length);

  revalidatePath("/", "layout");

  return {
    ok: true,
    error: null,
    table,
    attempted: todo.length,
    fullyMirrored,
    partial,
    remainingEstimate,
  };
}

/** Quick "how many rows of each table still need mirroring" check, for
 *  the dashboard. Uses the same candidate over-fetch + JS filter so the
 *  number stays consistent with what the batch action sees. */
export async function getPhotoMirrorStatus(): Promise<{
  ok: boolean;
  error: string | null;
  counts: Record<PhotoMirrorTable, { sampled: number; unmirrored: number }>;
}> {
  const empty = {
    counts: {
      stays: { sampled: 0, unmirrored: 0 },
      restaurants: { sampled: 0, unmirrored: 0 },
      experiences: { sampled: 0, unmirrored: 0 },
    },
  };
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) return { ok: false, error: "Not authorised.", ...empty };

  const supabase = createAdminClient();
  const counts = { ...empty.counts };

  for (const table of ["stays", "restaurants", "experiences"] as const) {
    const includeGallery = table === "stays";
    const selectCols = includeGallery
      ? "id, photo_url, photo_urls"
      : "id, photo_url";
    const { data, error } = await supabase
      .from(table)
      .select(selectCols, { count: "estimated" })
      .limit(500);
    if (error) {
      return { ok: false, error: error.message, ...empty };
    }
    type Row = {
      photo_url: string | null;
      photo_urls?: string[] | null;
    };
    const rows = (data ?? []) as unknown as Row[];
    counts[table] = {
      sampled: rows.length,
      unmirrored: rows.filter(
        (r) => !isFullyMirrored(r.photo_url, r.photo_urls ?? null),
      ).length,
    };
  }

  return { ok: true, error: null, counts };
}

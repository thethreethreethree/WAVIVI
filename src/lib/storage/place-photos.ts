import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

import type { Database } from "@/types/supabase";

import { mapConcurrent } from "@/lib/toolbox/mirror-photo";

/**
 * Place-photo mirror — fetches an external image (Instagram / Google
 * Maps / Facebook CDN), downscales it to 600px-wide WebP with sharp,
 * uploads to the `stays-photos` Supabase Storage bucket under a
 * per-table prefix, and returns the public URL.
 *
 * Why this exists:
 *   - Instagram & Facebook CDN URLs carry an expiry token (`&oe=…`) and
 *     die within a few weeks. Mirroring is the only way to keep the
 *     image content alive long-term.
 *   - 600px WebP is the sweet spot for mobile-first display — drops the
 *     average image from ~200 KB raw IG JPEG to ~30–50 KB, a 4–6×
 *     storage / egress saving.
 *
 * Why it's safe to call on every ingest:
 *   - Object paths are deterministic (`{table}/{source_ref}/{idx}.webp`),
 *     so re-uploading the same row hits the same path with `upsert:true`
 *     — no orphaned objects, idempotent.
 *   - Every fetch / sharp step is wrapped in try/catch — a broken source
 *     URL falls back to the original (the row still works), it doesn't
 *     abort the import.
 *   - Inside a single row, photo fetches run in parallel (concurrency 6),
 *     so a typical 1-primary + 6-gallery row finishes in ~500–700 ms
 *     instead of serial seconds.
 */

const BUCKET = "stays-photos";
const TARGET_WIDTH = 600;
const WEBP_QUALITY = 82;
const FETCH_TIMEOUT_MS = 12_000;
const ROW_PHOTO_CONCURRENCY = 6;
const PUBLIC_PATH_FRAGMENT = `/storage/v1/object/public/${BUCKET}/`;

export type PlaceTable = "stays" | "restaurants" | "experiences";

/** Sanitize a source_ref into a path-safe segment (no slashes, no
 *  spaces). Cap length to keep object keys reasonable. */
function safeSegment(s: string): string {
  return s.replace(/[^a-z0-9_-]+/gi, "_").slice(0, 120) || "x";
}

function bucketPath(
  table: PlaceTable,
  sourceRef: string,
  index: number,
): string {
  return `${table}/${safeSegment(sourceRef)}/${index}.webp`;
}

/** True when the URL already lives in our mirror bucket. */
export function isMirroredUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes(PUBLIC_PATH_FRAGMENT);
}

async function fetchBytes(url: string): Promise<ArrayBuffer | null> {
  const ac = new AbortController();
  const timer = setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      redirect: "follow",
      signal: ac.signal,
      // Some IG / FB CDN edges 403 a default Node fetch UA. Spoof a normal
      // browser UA — these are public images either way.
      headers: {
        "user-agent":
          "Mozilla/5.0 (compatible; WAVIVI-PhotoMirror/1.0; +https://wondavu.com)",
        accept: "image/avif,image/webp,image/apng,image/*,*/*;q=0.8",
      },
    });
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Mirror a single external image. On any failure (fetch error, decode
 * error, upload error) returns the original URL so the row stays usable
 * — broken IG tokens degrade gracefully instead of nulling the photo.
 */
export async function mirrorOnePlacePhoto(
  supabase: SupabaseClient<Database>,
  table: PlaceTable,
  sourceRef: string,
  url: string,
  index: number,
): Promise<string> {
  if (!url) return url;
  if (isMirroredUrl(url)) return url;
  if (!/^https?:\/\//i.test(url)) return url;
  if (!sourceRef) return url; // can't pick a stable path

  const bytes = await fetchBytes(url);
  if (!bytes || bytes.byteLength === 0) return url;

  let webp: Buffer;
  try {
    webp = await sharp(Buffer.from(bytes))
      .rotate() // honour EXIF orientation before resize
      .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY, effort: 4 })
      .toBuffer();
  } catch (e) {
    // HEIC / AVIF / weird containers can throw without libheif. Keep
    // the original URL rather than silently dropping the photo.
    console.warn(
      "[place-photos] sharp transform failed",
      (e as Error).message,
    );
    return url;
  }

  const path = bucketPath(table, sourceRef, index);
  const { error } = await supabase.storage.from(BUCKET).upload(path, webp, {
    contentType: "image/webp",
    upsert: true,
    cacheControl: "31536000", // 1 yr — bucket paths are content-addressable per source_ref+index
  });
  if (error) {
    console.error("[place-photos] upload failed", error.message, path);
    return url;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl ?? url;
}

/**
 * Mirror a row's primary photo + optional IG gallery in parallel.
 * Returns rewritten URLs in the same shape the engine writes back to the
 * DB — so callers swap `{ photoUrl, photoUrls }` straight into the
 * upsert payload.
 *
 * Index scheme: primary → 0, gallery[0..N] → 1..N+1. Stable across
 * re-runs so re-importing the same row overwrites the same objects.
 */
export async function mirrorRowPhotos(
  supabase: SupabaseClient<Database>,
  table: PlaceTable,
  sourceRef: string,
  primary: string | null,
  gallery: string[],
): Promise<{ photoUrl: string | null; photoUrls: string[] }> {
  type Job = {
    url: string;
    index: number;
    isPrimary: boolean;
  };
  const jobs: Job[] = [];
  if (primary) jobs.push({ url: primary, index: 0, isPrimary: true });
  gallery.forEach((u, i) =>
    jobs.push({ url: u, index: i + 1, isPrimary: false }),
  );

  if (jobs.length === 0) {
    return { photoUrl: primary, photoUrls: gallery };
  }

  const done = await mapConcurrent(jobs, ROW_PHOTO_CONCURRENCY, async (j) => ({
    ...j,
    mirrored: await mirrorOnePlacePhoto(supabase, table, sourceRef, j.url, j.index),
  }));

  const primaryDone = done.find((d) => d.isPrimary);
  const galleryDone = done.filter((d) => !d.isPrimary).map((d) => d.mirrored);

  return {
    photoUrl: primaryDone?.mirrored ?? primary,
    photoUrls: galleryDone,
  };
}

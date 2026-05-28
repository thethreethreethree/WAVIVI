import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/types/supabase";

const BUCKET = "stays-photos";

/** Sanitize an arbitrary string (typically source_ref) into a filename. */
function objectName(sourceRef: string, ext = "jpg"): string {
  return sourceRef.replace(/[^a-z0-9_-]+/gi, "_").slice(0, 200) + "." + ext;
}

function extFromContentType(ct: string | null): string {
  if (!ct) return "jpg";
  if (/png/i.test(ct)) return "png";
  if (/webp/i.test(ct)) return "webp";
  return "jpg";
}

/**
 * Mirror a remote photo into the `stays-photos` Supabase Storage bucket
 * and return its public URL. Returns the original URL if mirroring fails
 * (the caller decides whether to fall back to that or to null).
 *
 * Idempotent: object name is derived from `sourceRef`, so re-pushing the
 * same stay reuses the existing object instead of re-downloading.
 *
 * `bucketHost` is the Supabase project's storage origin (e.g.
 * "https://xxx.supabase.co/storage/v1/object/public/stays-photos/") used
 * to detect URLs we've already mirrored — those are returned as-is.
 */
export async function mirrorPhoto(
  supabase: SupabaseClient<Database>,
  sourceRef: string,
  url: string | null,
): Promise<string | null> {
  if (!url) return null;
  // Already mirrored — return as-is.
  if (url.includes(`/storage/v1/object/public/${BUCKET}/`)) return url;
  // Only mirror http(s) URLs.
  if (!/^https?:\/\//i.test(url)) return url;

  try {
    const res = await fetch(url, { redirect: "follow" });
    if (!res.ok) return url;
    const bytes = new Uint8Array(await res.arrayBuffer());
    if (bytes.byteLength === 0) return url;

    const contentType = res.headers.get("content-type") ?? "image/jpeg";
    const ext = extFromContentType(contentType);
    const name = objectName(sourceRef, ext);

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(name, bytes, { contentType, upsert: true });
    if (error) {
      console.error("[mirrorPhoto] upload failed", error.message);
      return url;
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(name);
    return data.publicUrl ?? url;
  } catch (e) {
    console.error("[mirrorPhoto] fetch failed", (e as Error).message);
    return url;
  }
}

/** Run `fn` across `items` with at most `concurrency` in flight at once. */
export async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      out[i] = await fn(items[i], i);
    }
  }
  const workers = Array.from(
    { length: Math.min(concurrency, items.length) },
    () => worker(),
  );
  await Promise.all(workers);
  return out;
}

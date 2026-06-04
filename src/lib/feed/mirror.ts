import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

import type { Database } from "@/types/supabase";

/**
 * Feed-photo mirror — fetches the external image (IG CDN, sometimes a
 * direct user upload URL), downscales to a portrait-friendly WebP, and
 * uploads to the shared `stays-photos` Supabase bucket under a
 * dedicated `feed/` prefix.
 *
 * Why a separate helper (not a reuse of place-photos.mirrorOnePlacePhoto):
 *   - Place photos are keyed on (table, source_ref, index) — a 3-axis
 *     content-addressable scheme that assumes places have a Google
 *     place ref. Feed posts have a row UUID and that's it; forcing
 *     them through PlaceTable would muddy the model.
 *   - Place photos resize to 600px wide (landscape-friendly card
 *     thumbnails). The feed uses a 900×1600 portrait crop — different
 *     sizing target so existing cards stay sharp.
 *   - Both share the same bucket so there's only one storage policy
 *     to maintain.
 *
 * The transform is wrapped in try/catch: a broken / HEIC source URL
 * doesn't kill the admin's paste flow, it just leaves the row with
 * the source URL and lets the user re-pick a different image.
 */

const BUCKET = "stays-photos";
const PREFIX = "feed";
// Portrait crops read better than landscape on the existing 4:5
// card aspect. 900px wide is sharp on retina without being huge.
const TARGET_WIDTH = 900;
const WEBP_QUALITY = 82;
const FETCH_TIMEOUT_MS = 12_000;
const PUBLIC_PATH_FRAGMENT = `/storage/v1/object/public/${BUCKET}/`;

/** True iff `url` is already a public URL on our `stays-photos`
 *  bucket. Lets the admin re-paste a previously mirrored URL without
 *  triggering a redundant fetch. */
export function isMirroredFeedUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  return url.includes(PUBLIC_PATH_FRAGMENT);
}

async function fetchBytes(url: string): Promise<ArrayBuffer | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      // Tell the IG CDN a real-browser user agent so it doesn't 403 us.
      headers: { "user-agent": "Mozilla/5.0 (compatible; Wondavu/1.0)" },
    });
    if (!res.ok) {
      console.warn(
        "[feed-mirror] source fetch non-ok",
        res.status,
        url.slice(0, 120),
      );
      return null;
    }
    return await res.arrayBuffer();
  } catch (err) {
    console.warn(
      "[feed-mirror] source fetch threw",
      (err as Error).message,
      url.slice(0, 120),
    );
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Mirror one feed image to the Storage bucket. Returns the public
 *  URL on success, or the original URL on failure (so the row still
 *  works — the admin can re-mirror later). Idempotent on (postId):
 *  re-calling with the same id overwrites the same object key. */
export async function mirrorFeedImage(
  supabase: SupabaseClient<Database>,
  postId: string,
  url: string,
): Promise<string> {
  if (!url) return url;
  if (isMirroredFeedUrl(url)) return url;
  if (!/^https?:\/\//i.test(url)) return url;

  const bytes = await fetchBytes(url);
  if (!bytes || bytes.byteLength === 0) return url;

  let webp: Buffer;
  try {
    webp = await sharp(Buffer.from(bytes))
      .rotate()
      .resize({ width: TARGET_WIDTH, withoutEnlargement: true })
      .webp({ quality: WEBP_QUALITY, effort: 4 })
      .toBuffer();
  } catch (err) {
    console.warn(
      "[feed-mirror] sharp transform failed",
      (err as Error).message,
    );
    return url;
  }

  const path = `${PREFIX}/${postId}.webp`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, webp, {
    contentType: "image/webp",
    upsert: true,
    cacheControl: "31536000",
  });
  if (error) {
    console.error("[feed-mirror] upload failed", error.message, path);
    return url;
  }
  const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
  return data.publicUrl ?? url;
}

/**
 * Mirror one feed VIDEO to Storage.
 *
 * Pass-through: we don't transcode (Sharp is for images), just fetch
 * the bytes and upload to the bucket with the original content-type.
 * IG CDN serves MP4, sometimes WebM; both render in <video> natively.
 *
 * Why mirror at all instead of pointing <video src> at the IG CDN:
 *   - IG signs every video URL with a short-lived token. Six hours
 *     later the URL 403s and our feed silently breaks.
 *   - Cache-Control headers on our bucket let us bill the bandwidth
 *     once and have CloudFront / Vercel edge cache the rest.
 *
 * Hard cap at MAX_VIDEO_BYTES so a paste of a 500MB file can't fill
 * the Storage tier on accident. Above the cap we return the source
 * URL — the post still works (browser hits IG CDN until token rots),
 * but ops know to re-upload from a smaller source.
 */

const VIDEO_PREFIX = "feed-videos";
const VIDEO_FETCH_TIMEOUT_MS = 60_000;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024;

function videoExtFor(contentType: string): string {
  // IG ships mp4 99% of the time; cover the next-likely formats so a
  // WebM source lands with the right extension and the browser still
  // negotiates correctly on playback.
  if (contentType.includes("webm")) return "webm";
  if (contentType.includes("quicktime")) return "mov";
  return "mp4";
}

export async function mirrorFeedVideo(
  supabase: SupabaseClient<Database>,
  postId: string,
  url: string,
): Promise<string> {
  if (!url) return url;
  if (isMirroredFeedUrl(url)) return url;
  if (!/^https?:\/\//i.test(url)) return url;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), VIDEO_FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "user-agent": "Mozilla/5.0 (compatible; Wondavu/1.0)" },
    });
    if (!res.ok) {
      console.warn(
        "[feed-mirror] video source non-ok",
        res.status,
        url.slice(0, 120),
      );
      return url;
    }
    const declared = Number(res.headers.get("content-length") ?? "0");
    if (declared && declared > MAX_VIDEO_BYTES) {
      console.warn(
        "[feed-mirror] video exceeds size cap",
        declared,
        url.slice(0, 120),
      );
      return url;
    }
    const buf = await res.arrayBuffer();
    if (buf.byteLength === 0) return url;
    if (buf.byteLength > MAX_VIDEO_BYTES) {
      console.warn(
        "[feed-mirror] video exceeds size cap post-fetch",
        buf.byteLength,
      );
      return url;
    }

    const contentType = res.headers.get("content-type") ?? "video/mp4";
    const ext = videoExtFor(contentType.toLowerCase());
    const path = `${VIDEO_PREFIX}/${postId}.${ext}`;
    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(path, Buffer.from(buf), {
        contentType,
        upsert: true,
        cacheControl: "31536000",
      });
    if (error) {
      console.error("[feed-mirror] video upload failed", error.message, path);
      return url;
    }
    const { data } = supabase.storage.from(BUCKET).getPublicUrl(path);
    return data.publicUrl ?? url;
  } catch (err) {
    console.warn(
      "[feed-mirror] video fetch threw",
      (err as Error).message,
      url.slice(0, 120),
    );
    return url;
  } finally {
    clearTimeout(timer);
  }
}

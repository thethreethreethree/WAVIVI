import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";

import type { Database } from "@/types/supabase";

/**
 * Chat-photo pipeline — accepts a user-uploaded image, downscales it
 * server-side, uploads to the public `chat-photos` bucket, and returns
 * { url, width, height } for the message row.
 *
 * Storage-cost decisions baked in (mindful of long-term spend):
 *   - Raw upload cap: 5 MB. A larger blob is rejected before sharp runs
 *     so we don't burn memory decoding a 60-MP RAW.
 *   - Output: WebP, max 1280 px on the longest edge, quality 78. A
 *     typical phone shot lands at 80–180 KB — 30–60× smaller than the
 *     raw HEIC/JPEG. Same shape choice as place-photos but at higher
 *     resolution because chat images are viewed full-screen on tap.
 *   - One image per message. Deterministic object key
 *     (`<scope>/<msg-id>.webp`) so a retry hits the same path with
 *     upsert:true — no orphaned objects.
 */

const BUCKET = "chat-photos";
const MAX_RAW_BYTES = 5 * 1024 * 1024;
const TARGET_LONGEST_EDGE = 1280;
const WEBP_QUALITY = 78;

export interface ChatPhotoUpload {
  url: string;
  width: number;
  height: number;
}

/** Pipe `file` through sharp and upload to `<scope>/<messageId>.webp`.
 *  Throws when the file is too large, can't be decoded, or upload fails —
 *  the caller (a server action) catches and surfaces a user error. */
export async function uploadChatPhoto(
  supabase: SupabaseClient<Database>,
  scope: string,
  messageId: string,
  file: File,
): Promise<ChatPhotoUpload> {
  if (file.size > MAX_RAW_BYTES) {
    throw new Error("Image is too large (5 MB max).");
  }
  const buf = Buffer.from(await file.arrayBuffer());
  const pipeline = sharp(buf, { failOn: "none" })
    .rotate() // honour EXIF orientation so portrait shots don't render sideways
    .resize({
      width: TARGET_LONGEST_EDGE,
      height: TARGET_LONGEST_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .webp({ quality: WEBP_QUALITY });
  const { data, info } = await pipeline.toBuffer({ resolveWithObject: true });
  const key = `${safeSegment(scope)}/${safeSegment(messageId)}.webp`;
  const { error: upErr } = await supabase.storage
    .from(BUCKET)
    .upload(key, data, {
      contentType: "image/webp",
      upsert: true,
      cacheControl: "public, max-age=31536000, immutable",
    });
  if (upErr) throw new Error(`Upload failed: ${upErr.message}`);
  const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(key);
  return {
    url: pub.publicUrl,
    width: info.width,
    height: info.height,
  };
}

/** Remove a chat photo from the bucket. Best-effort — failures are
 *  swallowed (the row is gone either way and the object becomes orphan
 *  storage we can sweep later). */
export async function deleteChatPhoto(
  supabase: SupabaseClient<Database>,
  url: string,
): Promise<void> {
  const idx = url.indexOf(`/object/public/${BUCKET}/`);
  if (idx < 0) return;
  const key = url.slice(idx + `/object/public/${BUCKET}/`.length);
  if (!key) return;
  await supabase.storage.from(BUCKET).remove([key]);
}

function safeSegment(s: string): string {
  return s.replace(/[^a-z0-9_-]+/gi, "_").slice(0, 120) || "x";
}

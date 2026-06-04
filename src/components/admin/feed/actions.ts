"use server";

import { revalidatePath } from "next/cache";

import { mirrorFeedImage, mirrorFeedVideo } from "@/lib/feed/mirror";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdmin } from "@/lib/toolbox/admin";

import { parseFeedCsv } from "./csv";

export interface CreateFeedPostInput {
  regionId: string | null;
  cityId?: string | null;
  handle: string;
  caption: string;
  locationLabel?: string | null;
  imageUrl: string;
  /** Optional video URL. When set, the feed renders an inline
   *  tap-to-play <video> with imageUrl as the poster. We mirror the
   *  video to Storage on insert so the IG CDN's token rotation can't
   *  break it. */
  videoUrl?: string | null;
  igPostUrl?: string | null;
  verified?: boolean;
  likesLabel?: string;
}

export interface FeedActionResult {
  ok: boolean;
  error: string | null;
}

async function assertAdmin(): Promise<FeedActionResult | null> {
  try {
    const { isAdmin } = await requireAdmin();
    if (!isAdmin) return { ok: false, error: "Not authorised." };
    return null;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return { ok: false, error: `Auth check failed: ${msg}` };
  }
}

/** Sanitize a free-form handle: strip leading @ and trim. The DB
 *  column has no uniqueness constraint (the same traveler can have
 *  several posts), but we still want consistent display. */
function normaliseHandle(h: string): string {
  return h.trim().replace(/^@+/, "");
}

/** Create one feed post. Inserts the row with the original
 *  image URL FIRST so we have an id to key the mirror against, then
 *  mirrors the photo to storage and updates the row with the
 *  permanent Storage URL. If the mirror fails the row still works
 *  pointing at the source URL — the admin can re-mirror later. */
export async function createFeedPost(
  input: CreateFeedPostInput,
): Promise<FeedActionResult & { id?: string }> {
  const auth = await assertAdmin();
  if (auth) return auth;

  const handle = normaliseHandle(input.handle);
  const caption = input.caption.trim();
  const imageUrl = input.imageUrl.trim();
  const videoUrl = input.videoUrl?.trim() || null;
  if (!handle) return { ok: false, error: "Handle is required." };
  if (!imageUrl) return { ok: false, error: "Image URL is required." };

  const supabase = createAdminClient();

  // Step 1 — insert with the source URLs so we have an id.
  const { data: inserted, error: insertErr } = await supabase
    .from("feed_posts")
    .insert({
      region_id: input.regionId,
      city_id: input.cityId ?? null,
      handle,
      verified: input.verified ?? false,
      caption,
      location_label: input.locationLabel?.trim() || null,
      source: "admin_curated",
      ig_post_url: input.igPostUrl?.trim() || null,
      image_url: imageUrl,
      video_url: videoUrl,
      likes_label: input.likesLabel?.trim() || "0",
    })
    .select("id")
    .single();
  if (insertErr || !inserted) {
    return { ok: false, error: insertErr?.message ?? "Insert failed." };
  }

  // Step 2 — mirror the photo (poster) and optional video to Storage
  // using the row id as the stable object key. Run in parallel since
  // they don't depend on each other; either failure leaves that field
  // pointing at the source URL so the post still works.
  const [mirroredImage, mirroredVideo] = await Promise.all([
    mirrorFeedImage(supabase, inserted.id as string, imageUrl),
    videoUrl
      ? mirrorFeedVideo(supabase, inserted.id as string, videoUrl)
      : Promise.resolve<string | null>(null),
  ]);

  const updates: { image_url?: string; video_url?: string } = {};
  if (mirroredImage !== imageUrl) updates.image_url = mirroredImage;
  if (mirroredVideo && mirroredVideo !== videoUrl) {
    updates.video_url = mirroredVideo;
  }
  if (Object.keys(updates).length > 0) {
    const { error: updateErr } = await supabase
      .from("feed_posts")
      .update(updates)
      .eq("id", inserted.id);
    if (updateErr) {
      console.warn("[feed] mirror update failed:", updateErr.message);
    }
  }

  revalidatePath("/feed");
  revalidatePath(`/admin/feed${input.regionId ? `/${input.regionId}` : ""}`);
  return { ok: true, error: null, id: inserted.id as string };
}

export async function deleteFeedPost(
  postId: string,
): Promise<FeedActionResult> {
  const auth = await assertAdmin();
  if (auth) return auth;
  const supabase = createAdminClient();
  // Look up region first so we know which admin page to revalidate.
  const { data: row } = await supabase
    .from("feed_posts")
    .select("region_id")
    .eq("id", postId)
    .maybeSingle();
  const { error } = await supabase
    .from("feed_posts")
    .delete()
    .eq("id", postId);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/feed");
  if (row?.region_id) revalidatePath(`/admin/feed/${row.region_id}`);
  return { ok: true, error: null };
}

export interface BulkDeleteResult extends FeedActionResult {
  /** How many rows actually got removed by the DELETE. May be < ids.length
   *  if some ids were already gone (concurrent delete) or didn't exist. */
  deleted: number;
}

/** Delete many feed posts in one DB round-trip. Returns the actual count
 *  of rows removed plus the same ok/error shape as the single-delete
 *  path so the UI can render a uniform result line. */
export async function bulkDeleteFeedPosts(
  postIds: string[],
): Promise<BulkDeleteResult> {
  const auth = await assertAdmin();
  if (auth) return { ...auth, deleted: 0 };
  if (postIds.length === 0) {
    return { ok: true, error: null, deleted: 0 };
  }

  const supabase = createAdminClient();
  // Snag region ids first so we know which admin pages to revalidate.
  // One round-trip read; the delete is one round-trip write — cheaper
  // than a per-row revalidate loop.
  const { data: rows } = await supabase
    .from("feed_posts")
    .select("region_id")
    .in("id", postIds);
  const regionIds = new Set<string>();
  for (const r of (rows ?? []) as { region_id: string | null }[]) {
    if (r.region_id) regionIds.add(r.region_id);
  }

  const { error, count } = await supabase
    .from("feed_posts")
    .delete({ count: "exact" })
    .in("id", postIds);
  if (error) {
    return { ok: false, error: error.message, deleted: 0 };
  }

  revalidatePath("/feed");
  for (const regionId of regionIds) {
    revalidatePath(`/admin/feed/${regionId}`);
  }
  return { ok: true, error: null, deleted: count ?? 0 };
}

export interface CsvImportRowError {
  lineNumber: number;
  reason: string;
}

export interface CsvImportResult {
  ok: boolean;
  /** Set when the CSV itself is malformed (missing header column, unknown
   *  column, file empty, etc.) and no row processing happens. */
  headerError: string | null;
  /** Per-row failures during PARSE (validation) or INSERT (DB / mirror). */
  errors: CsvImportRowError[];
  /** Rows where createFeedPost succeeded. */
  inserted: number;
  /** Total non-empty rows considered (excludes the header). */
  considered: number;
}

/** Bulk-import feed posts from a CSV. Routes through createFeedPost
 *  per row so dedup, validation, mirror, and revalidation behave
 *  identically to the manual form. Failures are per-row, not
 *  all-or-nothing — a bad image URL on row 4 doesn't stop rows 5-100
 *  from landing. */
export async function importFeedPostsCsv(
  regionId: string,
  csvText: string,
): Promise<CsvImportResult> {
  const auth = await assertAdmin();
  if (auth) {
    return {
      ok: false,
      headerError: auth.error,
      errors: [],
      inserted: 0,
      considered: 0,
    };
  }

  const parsed = parseFeedCsv(csvText);
  if (parsed.headerError) {
    return {
      ok: false,
      headerError: parsed.headerError,
      errors: [],
      inserted: 0,
      considered: 0,
    };
  }

  const considered = parsed.rows.length;
  const errors: CsvImportRowError[] = [];
  let inserted = 0;

  // Sequential per-row — image-mirror calls Sharp + a remote fetch each,
  // running these in parallel could fan out 50+ concurrent fetches
  // against the same IG CDN and trip rate limits. The volume is small
  // enough (admin-batched) that the wall-clock cost is acceptable.
  for (const r of parsed.rows) {
    if (!r.ok) {
      errors.push({ lineNumber: r.lineNumber, reason: r.reason });
      continue;
    }
    const res = await createFeedPost({
      regionId,
      handle: r.row.handle,
      caption: r.row.caption,
      imageUrl: r.row.imageUrl,
      videoUrl: r.row.videoUrl,
      locationLabel: r.row.locationLabel,
      igPostUrl: r.row.igPostUrl,
      verified: r.row.verified,
      likesLabel: r.row.likesLabel ?? undefined,
    });
    if (!res.ok) {
      errors.push({
        lineNumber: r.lineNumber,
        reason: res.error ?? "Insert failed.",
      });
      continue;
    }
    inserted++;
  }

  // One layout-level revalidation at the end so we don't trigger N of
  // them from createFeedPost. (It revalidates internally per row too,
  // but at the route level so the cost is bounded.)
  revalidatePath(`/admin/feed/${regionId}`);
  revalidatePath("/feed");

  return {
    ok: errors.length === 0,
    headerError: null,
    errors,
    inserted,
    considered,
  };
}

export async function setFeedPostDisplayOrder(
  postId: string,
  displayOrder: number | null,
): Promise<FeedActionResult> {
  const auth = await assertAdmin();
  if (auth) return auth;
  const supabase = createAdminClient();
  const { error } = await supabase
    .from("feed_posts")
    .update({ display_order: displayOrder })
    .eq("id", postId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/feed");
  return { ok: true, error: null };
}

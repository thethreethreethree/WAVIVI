"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { DvsShareInsert } from "@/types/supabase";

/** Result envelope used by every DVS server action.
 *  `id` is the newly-created share id on success. */
export type DvsActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export type DvsPhotoUploadResult =
  | { ok: true; url: string }
  | { ok: false; error: string };

const MAX_PHOTO_BYTES = 5 * 1024 * 1024; // 5 MB — matches the bucket cap.

/**
 * Upload a single DVS photo to the dvs-photos bucket and return its
 * public URL. The caller (the compose form) stores the URL on the
 * DVS row when it submits. Path layout matches the avatars pattern:
 * `<user_id>/<timestamp>.<ext>`, so the storage RLS policies in
 * migration 0062 can enforce self-only writes via the
 * `(storage.foldername)[1]` segment.
 *
 * Why upload-before-insert: the photo is optional, and forcing the
 * client to upload first means a slow upload doesn't block the form
 * from validating + persisting the rest of the answers. Trade-off:
 * an orphaned photo is possible if the user abandons the form after
 * upload. A nightly cleanup job (Phase 2) handles those.
 */
export async function uploadDvsPhoto(
  formData: FormData,
): Promise<DvsPhotoUploadResult> {
  const file = formData.get("photo");
  if (!(file instanceof File) || file.size === 0) {
    return { ok: false, error: "Choose an image first." };
  }
  if (file.size > MAX_PHOTO_BYTES) {
    return { ok: false, error: "Image must be under 5 MB." };
  }
  if (!file.type.startsWith("image/")) {
    return { ok: false, error: "That doesn't look like an image." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to share." };

  const rawExt = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const ext = rawExt.replace(/[^a-z0-9]/g, "").slice(0, 4) || "jpg";
  const path = `${user.id}/${Date.now()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from("dvs-photos")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadErr) return { ok: false, error: uploadErr.message };

  const {
    data: { publicUrl },
  } = supabase.storage.from("dvs-photos").getPublicUrl(path);
  return { ok: true, url: publicUrl };
}

/** Server-side validation that mirrors the column checks in migration
 *  0061. Returns null when the payload is clean, or an error message
 *  to surface in the UI. The DB constraints would catch these too, but
 *  raising before the round-trip gives the user a friendly inline
 *  error instead of an opaque Supabase error string. */
function validatePayload(p: DvsShareInsert): string | null {
  if (!Number.isInteger(p.vibe_rating) || p.vibe_rating < 1 || p.vibe_rating > 5) {
    return "Pick a vibe rating from 1 to 5.";
  }
  if (!p.caption || p.caption.trim().length === 0) {
    return "Add a one-line caption.";
  }
  if (p.caption.length > 200) {
    return "Caption must be 200 characters or fewer.";
  }
  if (p.tip != null && p.tip.length > 300) {
    return "Tip must be 300 characters or fewer.";
  }
  if (p.location_label != null && p.location_label.length > 120) {
    return "Location must be 120 characters or fewer.";
  }
  if (p.qa_question != null && p.qa_question.length > 160) {
    return "Question must be 160 characters or fewer.";
  }
  if (p.qa_answer != null && p.qa_answer.length > 280) {
    return "Answer must be 280 characters or fewer.";
  }
  for (const [key, value] of [
    ["cost_meal", p.cost_meal],
    ["cost_hotel", p.cost_hotel],
    ["cost_activity", p.cost_activity],
  ] as const) {
    if (value != null && (!Number.isInteger(value) || value < 0)) {
      return `${key.replace("cost_", "Cost: ")} must be a whole number ≥ 0.`;
    }
  }
  if (p.cost_currency != null && !/^[A-Z]{3}$/.test(p.cost_currency)) {
    return "Currency must be a 3-letter ISO code (e.g. USD, PHP).";
  }
  return null;
}

/** Create a new Daily Vibe Share for the signed-in user.
 *
 *  Reads each field off the FormData (the compose component packs
 *  them) and inserts. The DB's one-per-day partial unique index will
 *  reject a second share for the same UTC day; we translate the
 *  Postgres error code 23505 into a friendly message so the user
 *  knows what's happening.
 */
export async function createDvsShare(
  formData: FormData,
): Promise<DvsActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to share." };

  function str(key: string): string | null {
    const v = formData.get(key);
    if (typeof v !== "string") return null;
    const trimmed = v.trim();
    return trimmed.length === 0 ? null : trimmed;
  }
  function int(key: string): number | null {
    const v = formData.get(key);
    if (typeof v !== "string" || v.trim().length === 0) return null;
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }

  const caption = str("caption") ?? "";
  const payload: DvsShareInsert = {
    author_id: user.id,
    vibe_rating: int("vibe_rating") ?? 0,
    caption,
    region_id: str("region_id"),
    city_id: str("city_id"),
    location_label: str("location_label"),
    photo_url: str("photo_url"),
    tip: str("tip"),
    cost_meal: int("cost_meal"),
    cost_hotel: int("cost_hotel"),
    cost_activity: int("cost_activity"),
    cost_currency: str("cost_currency"),
    qa_question: str("qa_question"),
    qa_answer: str("qa_answer"),
  };

  const validationError = validatePayload(payload);
  if (validationError) return { ok: false, error: validationError };

  const { data, error } = await supabase
    .from("daily_vibe_shares")
    .insert(payload)
    .select("id")
    .single();

  if (error) {
    // 23505 — unique_violation. Our partial unique index on
    // (author_id, created_at::date) where active=true catches a second
    // share on the same UTC day.
    if (error.code === "23505") {
      return {
        ok: false,
        error:
          "You've already shared a vibe today. Edit your existing share or come back tomorrow.",
      };
    }
    return { ok: false, error: error.message };
  }

  revalidatePath("/profile");
  revalidatePath("/feed");
  revalidatePath(`/u/${user.id}`);
  return { ok: true, id: data.id };
}

/* ── Phase 3 — reactions + comments ────────────────────────────────── */

export type DvsToggleLikeResult =
  | { ok: true; liked: boolean }
  | { ok: false; error: string };

/** Toggle the current user's like on a share. Two-step: try to insert,
 *  swallow a 23505 unique_violation as "already liked" and fall back
 *  to a delete. Keeps the call idempotent end-to-end so a double-tap
 *  doesn't desync the optimistic UI. */
export async function toggleDvsLike(
  shareId: string,
): Promise<DvsToggleLikeResult> {
  if (!shareId) return { ok: false, error: "Missing share id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to react." };

  // Try the insert first. If it fails with 23505 the user already
  // liked — treat the tap as an un-like.
  const insertRes = await supabase
    .from("dvs_reactions")
    .insert({ share_id: shareId, user_id: user.id });

  if (insertRes.error) {
    if (insertRes.error.code === "23505") {
      const { error: delErr } = await supabase
        .from("dvs_reactions")
        .delete()
        .eq("share_id", shareId)
        .eq("user_id", user.id);
      if (delErr) return { ok: false, error: delErr.message };
      revalidatePath("/feed");
      revalidatePath("/profile");
      return { ok: true, liked: false };
    }
    return { ok: false, error: insertRes.error.message };
  }

  revalidatePath("/feed");
  revalidatePath("/profile");
  return { ok: true, liked: true };
}

export type DvsCommentActionResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

/** Add a comment under a share. Validates body length here so the
 *  client can show an inline error before the DB constraint fires. */
export async function addDvsComment(
  shareId: string,
  body: string,
): Promise<DvsCommentActionResult> {
  if (!shareId) return { ok: false, error: "Missing share id." };
  const trimmed = body.trim();
  if (trimmed.length === 0) return { ok: false, error: "Write something first." };
  if (trimmed.length > 500) {
    return { ok: false, error: "Comment must be 500 characters or fewer." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to comment." };

  const { data, error } = await supabase
    .from("dvs_comments")
    .insert({
      share_id: shareId,
      author_id: user.id,
      body: trimmed,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };

  revalidatePath("/feed");
  revalidatePath("/profile");
  return { ok: true, id: data.id };
}

/** Soft-delete a comment. Author OR admin only; the DB RLS policy
 *  enforces it, this just returns a friendly error when the update
 *  affects no rows. */
export async function deleteDvsComment(
  commentId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  if (!commentId) return { ok: false, error: "Missing comment id." };

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to manage your comments." };

  const { error } = await supabase
    .from("dvs_comments")
    .update({ active: false })
    .eq("id", commentId)
    .eq("author_id", user.id);
  if (error) return { ok: false, error: error.message };

  revalidatePath("/feed");
  revalidatePath("/profile");
  return { ok: true };
}

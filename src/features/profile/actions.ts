"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { updateProfile } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";
import type { TravelerStatus } from "@/types/supabase";

export type ProfileFormState = { error: string | null };
export type AvatarUploadResult = { error: string | null; url: string | null };

/**
 * Upload a new profile picture and persist the public URL on the user's
 * profile row. Storage bucket + RLS policies live in migration 0032; the
 * path layout is `avatars/<user_id>/<timestamp>.<ext>` which lets the
 * bucket policies enforce self-only writes via (storage.foldername)[1].
 */
export async function uploadAvatar(
  formData: FormData,
): Promise<AvatarUploadResult> {
  const file = formData.get("avatar");
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose an image first.", url: null };
  }
  // Mirror the server-side bucket limits — better error UX than waiting
  // for storage to reject. 5 MB hard ceiling matches migration 0032.
  if (file.size > 5 * 1024 * 1024) {
    return { error: "Image must be under 5 MB.", url: null };
  }
  if (!file.type.startsWith("image/")) {
    return { error: "That doesn't look like an image.", url: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Sign in to upload.", url: null };

  // Extension comes from the original filename when possible, with a safe
  // jpg fallback. We strip anything weird so the storage path stays sane.
  const rawExt = (file.name.split(".").pop() ?? "jpg").toLowerCase();
  const ext = rawExt.replace(/[^a-z0-9]/g, "").slice(0, 4) || "jpg";
  const path = `${user.id}/${Date.now()}.${ext}`;

  const { error: uploadErr } = await supabase.storage
    .from("avatars")
    .upload(path, file, { contentType: file.type, upsert: false });
  if (uploadErr) return { error: uploadErr.message, url: null };

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(path);

  const { error: updateErr } = await supabase
    .from("profiles")
    .update({ avatar_url: publicUrl })
    .eq("id", user.id);
  if (updateErr) return { error: updateErr.message, url: null };

  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  return { error: null, url: publicUrl };
}

const STATUSES: TravelerStatus[] = [
  "exploring",
  "local",
  "transit",
  "offline",
];

function readString(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

/** Save the signed-in user's profile, then return to the profile screen. */
export async function saveProfile(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const displayName = readString(formData, "display_name");
  const username = readString(formData, "username").toLowerCase();
  const bio = readString(formData, "bio");
  const homeCountry = readString(formData, "home_country");
  const countriesRaw = readString(formData, "countries");
  const countries = countriesRaw
    .split(",")
    .map((c) => c.trim())
    .filter(Boolean)
    .slice(0, 50);
  const statusRaw = readString(formData, "traveler_status");
  const travelerStatus: TravelerStatus = STATUSES.includes(
    statusRaw as TravelerStatus,
  )
    ? (statusRaw as TravelerStatus)
    : "exploring";

  if (!displayName || displayName.length > 48) {
    return { error: "Display name must be 1–48 characters." };
  }
  if (!/^[a-z0-9_]{3,24}$/.test(username)) {
    return {
      error:
        "Username must be 3–24 chars: lowercase letters, numbers, underscores.",
    };
  }
  if (bio.length > 280) {
    return { error: "Bio must be 280 characters or fewer." };
  }

  const { error } = await updateProfile({
    display_name: displayName,
    username,
    bio: bio || null,
    home_country: homeCountry || null,
    countries,
    traveler_status: travelerStatus,
  });

  if (error) {
    // Surface a friendlier message for the most common failure.
    if (error.includes("duplicate") || error.includes("unique")) {
      return { error: "That username is already taken." };
    }
    return { error };
  }

  revalidatePath("/profile");
  revalidatePath("/profile/edit");
  redirect("/profile");
}

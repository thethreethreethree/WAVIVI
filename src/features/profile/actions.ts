"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { updateProfile } from "@/lib/profiles";
import type { TravelerStatus } from "@/types/supabase";

export type ProfileFormState = { error: string | null };

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

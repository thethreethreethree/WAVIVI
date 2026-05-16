"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { ProfileFormState } from "@/features/profile/types";
import type { ProfileUpdate, TravelerStatus } from "@/types/supabase";

const TRAVELER_STATUSES: TravelerStatus[] = [
  "exploring",
  "local",
  "transit",
  "offline",
];

function readString(form: FormData, key: string): string {
  return String(form.get(key) ?? "").trim();
}

export async function updateProfile(
  _prev: ProfileFormState,
  formData: FormData,
): Promise<ProfileFormState> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: "You must be signed in to update your profile." };
  }

  const displayName = readString(formData, "display_name");
  const bio = readString(formData, "bio");
  const homeCountry = readString(formData, "home_country");
  const status = readString(formData, "traveler_status");

  if (displayName.length < 1 || displayName.length > 48) {
    return { error: "Display name must be 1-48 characters." };
  }
  if (bio.length > 280) {
    return { error: "Bio must be 280 characters or fewer." };
  }
  if (!TRAVELER_STATUSES.includes(status as TravelerStatus)) {
    return { error: "Invalid traveler status." };
  }

  const update: ProfileUpdate = {
    display_name: displayName,
    bio: bio || null,
    home_country: homeCountry || null,
    traveler_status: status as TravelerStatus,
  };

  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id);

  if (error) {
    return { error: error.message };
  }

  revalidatePath("/profile");
  redirect("/profile");
}

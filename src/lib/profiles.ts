import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ProfileRow, ProfileUpdate } from "@/types/supabase";

/**
 * Profiles data layer — server-side reads/writes against the `profiles`
 * table. Shared by the profile screens; features consume it via `lib/`.
 */

/** The signed-in user's profile, or `null` if not authenticated. */
export async function getCurrentProfile(): Promise<ProfileRow | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .single();

  return data ?? null;
}

/** A public profile looked up by username, or `null` if none exists. */
export async function getProfileByUsername(
  username: string,
): Promise<ProfileRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username.toLowerCase())
    .single();

  return data ?? null;
}

/** Update the signed-in user's profile. RLS restricts this to `auth.uid()`. */
export async function updateProfile(
  updates: ProfileUpdate,
): Promise<{ data: ProfileRow | null; error: string | null }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { data: null, error: "You need to be signed in." };

  const { data, error } = await supabase
    .from("profiles")
    .update(updates)
    .eq("id", user.id)
    .select("*")
    .single();

  return { data: data ?? null, error: error?.message ?? null };
}

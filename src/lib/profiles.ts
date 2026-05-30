import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { ProfileRow, ProfileUpdate } from "@/types/supabase";

/**
 * Profiles data layer — server-side reads/writes against the `profiles`
 * table. Shared by the profile screens; features consume it via `lib/`.
 */

/** The signed-in user's profile, or `null` if not authenticated.
 *
 *  Self-heals if the user is authenticated but the profile row is missing
 *  (which can happen with OAuth signups where the handle_new_user trigger
 *  ran against raw_user_meta_data that didn't carry username/display_name,
 *  or in any state-drift scenario). Without this, every protected page
 *  would treat the user as signed-out and bounce them back to /login —
 *  triggering an infinite Google → callback → /profile → /login loop. */
export async function getCurrentProfile(): Promise<ProfileRow | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: existing } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  if (existing) return existing;

  // No profile row yet — backfill one. RLS permits this for auth.uid() = id.
  // Username falls back to user_<short-uuid>; display_name pulls from
  // Google's `name`/`full_name` metadata when present, else "Traveler".
  const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
  const rawDisplay =
    typeof meta.name === "string"
      ? meta.name
      : typeof meta.full_name === "string"
        ? meta.full_name
        : "Traveler";
  const display_name = rawDisplay.slice(0, 48) || "Traveler";
  const username = `user_${user.id.replace(/-/g, "").slice(0, 18)}`;

  const { data: created } = await supabase
    .from("profiles")
    .insert({ id: user.id, username, display_name })
    .select("*")
    .single();

  return created ?? null;
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

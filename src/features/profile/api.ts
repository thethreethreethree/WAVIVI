import "server-only";

import { isConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";
import type { ProfileRow } from "@/types/supabase";

/** Returns the signed-in user's profile, or null if not authenticated. */
export async function getCurrentProfile(): Promise<ProfileRow | null> {
  if (!isConfigured) return null;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", user.id)
    .maybeSingle();

  return data;
}

/** Returns a public profile by username, or null if not found. */
export async function getProfileByUsername(
  username: string,
): Promise<ProfileRow | null> {
  if (!isConfigured) return null;

  const supabase = await createClient();
  const { data } = await supabase
    .from("profiles")
    .select("*")
    .eq("username", username.toLowerCase())
    .maybeSingle();

  return data;
}

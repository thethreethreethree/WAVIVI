"use server";

import { revalidatePath } from "next/cache";

import { cleanUsername, isValidUsername } from "@/features/instagram/validation";
import {
  fetchInstagramBio,
  generateVerifyToken,
  htmlContainsToken,
} from "@/features/instagram/verify";
import { updateProfile } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";

export type InstagramActionResult = {
  error: string | null;
  username: string | null;
};

export type StartVerifyResult = {
  error: string | null;
  token: string | null;
  handle: string | null;
  expiresAt: string | null;
};

export type ConfirmVerifyResult = {
  error: string | null;
  verified: boolean;
  username: string | null;
};

/** Verification windows expire after this long. */
const VERIFY_TTL_MS = 30 * 60 * 1000;

/**
 * Link an Instagram handle to the signed-in profile.
 *
 * Pass an empty string to unlink. We only persist the public username —
 * no password, no tokens, no media. (Real OAuth via the IG Basic Display
 * API can populate the same `instagram_username` column later.)
 */
export async function saveInstagramUsername(
  raw: string,
): Promise<InstagramActionResult> {
  const trimmed = raw.trim();

  if (!trimmed) {
    const { error } = await updateProfile({ instagram_username: null });
    if (error) return { error, username: null };
    revalidatePath("/profile");
    return { error: null, username: null };
  }

  if (!isValidUsername(trimmed)) {
    return {
      error: "Use only letters, numbers, periods, and underscores.",
      username: null,
    };
  }

  const username = cleanUsername(trimmed);
  const { error } = await updateProfile({ instagram_username: username });
  if (error) {
    if (/duplicate|unique/i.test(error)) {
      return { error: "That Instagram handle is already linked.", username: null };
    }
    return { error, username: null };
  }
  revalidatePath("/profile");
  return { error: null, username };
}

/**
 * Start bio-token verification for `rawHandle`. Generates a short token,
 * stashes it on the profile with a 30-minute expiry, and returns the token
 * for the user to paste into their IG bio.
 */
export async function startInstagramVerification(
  rawHandle: string,
): Promise<StartVerifyResult> {
  const trimmed = rawHandle.trim();
  if (!isValidUsername(trimmed)) {
    return {
      error: "Use only letters, numbers, periods, and underscores.",
      token: null,
      handle: null,
      expiresAt: null,
    };
  }
  const handle = cleanUsername(trimmed);
  const token = generateVerifyToken();
  const expiresAt = new Date(Date.now() + VERIFY_TTL_MS).toISOString();
  const { error } = await updateProfile({
    instagram_verify_token: token,
    instagram_verify_handle: handle,
    instagram_verify_expires_at: expiresAt,
  });
  if (error) {
    return { error, token: null, handle: null, expiresAt: null };
  }
  return { error: null, token, handle, expiresAt };
}

/**
 * Complete verification: fetch the public IG profile, check that the
 * previously-issued token is present in the page body. On success we
 * persist instagram_username + instagram_verified=true and clear the
 * verify_* state.
 */
export async function confirmInstagramVerification(): Promise<ConfirmVerifyResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { error: "You need to be signed in.", verified: false, username: null };
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select(
      "instagram_verify_token, instagram_verify_handle, instagram_verify_expires_at",
    )
    .eq("id", user.id)
    .maybeSingle();

  const token = profile?.instagram_verify_token;
  const handle = profile?.instagram_verify_handle;
  const expiresAt = profile?.instagram_verify_expires_at;

  if (!token || !handle) {
    return {
      error: "Start a new verification — no token on file.",
      verified: false,
      username: null,
    };
  }
  if (expiresAt && new Date(expiresAt).getTime() < Date.now()) {
    return {
      error: "Verification expired — start again.",
      verified: false,
      username: null,
    };
  }

  const bio = await fetchInstagramBio(handle);
  if (bio === null) {
    return {
      error:
        "Couldn't reach Instagram right now. Make sure your profile is public, then try again in a few seconds.",
      verified: false,
      username: null,
    };
  }
  if (!htmlContainsToken(bio, token)) {
    return {
      error:
        "Token wasn't found in your bio yet. Open Instagram, paste " +
        `"${token}" anywhere in your bio, hit Done, then come back.`,
      verified: false,
      username: null,
    };
  }

  const { error } = await updateProfile({
    instagram_username: handle,
    instagram_verified: true,
    instagram_verify_token: null,
    instagram_verify_handle: null,
    instagram_verify_expires_at: null,
  });
  if (error) {
    return { error, verified: false, username: null };
  }
  revalidatePath("/profile");
  return { error: null, verified: true, username: handle };
}

/** Abandon an in-progress verification, clearing the stored token. */
export async function cancelInstagramVerification(): Promise<InstagramActionResult> {
  const { error } = await updateProfile({
    instagram_verify_token: null,
    instagram_verify_handle: null,
    instagram_verify_expires_at: null,
  });
  if (error) return { error, username: null };
  return { error: null, username: null };
}

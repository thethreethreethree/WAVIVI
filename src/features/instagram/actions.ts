"use server";

import { revalidatePath } from "next/cache";

import { cleanUsername, isValidUsername } from "@/features/instagram/validation";
import {
  generateVerifyToken,
  htmlContainsToken,
  probeInstagramBio,
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
      "instagram_verify_token, instagram_verify_handle, instagram_verify_expires_at, instagram_post_urls",
    )
    .eq("id", user.id)
    .maybeSingle();

  const token = profile?.instagram_verify_token;
  const handle = profile?.instagram_verify_handle;
  const expiresAt = profile?.instagram_verify_expires_at;
  const existingPosts = profile?.instagram_post_urls ?? [];

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

  const probe = await probeInstagramBio(handle);
  console.warn("[ig-verify] probe", {
    handle,
    source: probe.source,
    status: probe.status,
    snippet: probe.snippet,
    posts: probe.postUrls.length,
  });

  if (probe.bio === null) {
    const detail =
      probe.status === 401 || probe.status === 403
        ? " Instagram blocked the request — your profile may be private or rate-limited."
        : probe.status === 404
          ? " Instagram says that handle doesn't exist."
          : probe.status === 0
            ? " The request timed out."
            : "";
    return {
      error: `Couldn't read your Instagram bio.${detail} Try again in a minute.`,
      verified: false,
      username: null,
    };
  }
  if (!htmlContainsToken(probe.bio, token)) {
    const peek = probe.snippet ? ` We saw: "${probe.snippet}…"` : "";
    return {
      error:
        `Token "${token}" wasn't in your bio yet. Paste it anywhere in your IG bio, hit Done, then try again.${peek}`,
      verified: false,
      username: null,
    };
  }

  // Auto-seed featured posts the very first time: if the user hasn't
  // curated any yet, drop in the most recent 12 from their public IG.
  // First 6 render as "Featured Travel Moments"; the rest power the
  // "Travel Feed" section so the two grids never duplicate.
  const seededPosts =
    existingPosts.length === 0 ? probe.postUrls.slice(0, 12) : existingPosts;

  const { error } = await updateProfile({
    instagram_username: handle,
    instagram_verified: true,
    instagram_post_urls: seededPosts,
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

/**
 * Persist the user's featured Instagram post URLs. Validates each URL and
 * caps at 6 entries.
 */
export async function saveInstagramPosts(
  urls: string[],
): Promise<{ error: string | null; urls: string[] }> {
  const cleaned = (urls ?? [])
    .map((u) => (typeof u === "string" ? u.trim() : ""))
    .filter(Boolean)
    .slice(0, 12);

  // Light URL sanity check — reject anything that isn't a real IG post link.
  for (const u of cleaned) {
    if (!/^https?:\/\/(www\.)?instagram\.com\/(p|reel)\//i.test(u)) {
      return { error: `Not an Instagram post URL: ${u}`, urls: [] };
    }
  }

  const { error } = await updateProfile({ instagram_post_urls: cleaned });
  if (error) return { error, urls: [] };
  revalidatePath("/profile");
  return { error: null, urls: cleaned };
}

/**
 * Re-fetch the most recent ~12 posts from the signed-in user's linked
 * Instagram handle and overwrite `instagram_post_urls`. Useful for users
 * who linked their handle before auto-seed existed, or who want their
 * showcase refreshed without manually pasting URLs.
 */
export async function refreshInstagramPosts(): Promise<{
  error: string | null;
  urls: string[];
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in.", urls: [] };

  const { data: profile } = await supabase
    .from("profiles")
    .select("instagram_username")
    .eq("id", user.id)
    .maybeSingle();
  const handle = profile?.instagram_username;
  if (!handle) {
    return {
      error: "Link your Instagram first, then pull your posts.",
      urls: [],
    };
  }

  const probe = await probeInstagramBio(handle);
  if (probe.postUrls.length === 0) {
    return {
      error:
        "Couldn't read any public posts from your profile. Make sure it's public, then try again.",
      urls: [],
    };
  }

  const urls = probe.postUrls.slice(0, 12);
  const { error } = await updateProfile({ instagram_post_urls: urls });
  if (error) return { error, urls: [] };
  revalidatePath("/profile");
  return { error: null, urls };
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

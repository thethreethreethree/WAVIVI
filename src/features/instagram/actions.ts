"use server";

import { revalidatePath } from "next/cache";

import { cleanUsername, isValidUsername } from "@/features/instagram/validation";
import { updateProfile } from "@/lib/profiles";

export type InstagramActionResult = {
  error: string | null;
  username: string | null;
};

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

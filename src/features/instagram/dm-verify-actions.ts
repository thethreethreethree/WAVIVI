"use server";

import { revalidatePath } from "next/cache";

import { generateVerifyToken } from "@/features/instagram/verify";
import { serverEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/**
 * Server actions for the Instagram-DM verification flow.
 *
 *   startInstagramDmVerification  — generate a token + persist the
 *                                   pending row, return the token +
 *                                   brand handle for the UI to display.
 *   pollInstagramDmVerification   — check whether the webhook has
 *                                   claimed the user's outstanding
 *                                   token. Drives the UI's polling
 *                                   loop while the user is composing
 *                                   their DM.
 *
 * Bio-based verification (`confirmInstagramVerification` in actions.ts)
 * still exists in parallel — the DM flow is offered alongside, not as
 * a hard replacement, while Meta App Review is pending.
 */

export type StartDmVerificationResult =
  | {
      ok: true;
      token: string;
      brandHandle: string;
      expiresAt: string;
    }
  | { ok: false; error: string };

export async function startInstagramDmVerification(): Promise<StartDmVerificationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to verify." };
  if (!serverEnv.instagramBrandHandle) {
    return {
      ok: false,
      error:
        "DM verification isn't configured yet. Use the bio method for now.",
    };
  }

  // Clear any prior pending tokens for this user — only one outstanding
  // at a time keeps the polling logic simple and the table tiny.
  await supabase
    .from("ig_dm_verify_pending")
    .delete()
    .eq("user_id", user.id);

  const token = generateVerifyToken().toLowerCase();
  const expiresIso = new Date(Date.now() + 15 * 60 * 1000).toISOString();

  const { error } = await supabase.from("ig_dm_verify_pending").insert({
    token,
    user_id: user.id,
    expires_at: expiresIso,
  });
  if (error) return { ok: false, error: error.message };

  return {
    ok: true,
    token,
    brandHandle: serverEnv.instagramBrandHandle,
    expiresAt: expiresIso,
  };
}

export type PollDmVerificationResult =
  | { ok: true; status: "verified"; username: string | null }
  | { ok: true; status: "waiting"; expiresAt: string }
  | { ok: true; status: "expired" }
  | { ok: true; status: "none" }
  | { ok: false; error: string };

export async function pollInstagramDmVerification(): Promise<PollDmVerificationResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sign in to verify." };

  const { data, error } = await supabase
    .from("ig_dm_verify_pending")
    .select("token, used_at, used_by_ig_username, expires_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: true, status: "none" };

  if (data.used_at) {
    // Webhook claimed it. The webhook also wrote the linked
    // username + verified=true on the profile, so refresh those
    // pages and surface "done" to the client.
    revalidatePath("/profile");
    revalidatePath("/profile/edit");
    return {
      ok: true,
      status: "verified",
      username: data.used_by_ig_username,
    };
  }
  if (new Date(data.expires_at).getTime() < Date.now()) {
    return { ok: true, status: "expired" };
  }
  return { ok: true, status: "waiting", expiresAt: data.expires_at };
}

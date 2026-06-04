import { type NextRequest, NextResponse } from "next/server";

import type { EmailOtpType } from "@supabase/supabase-js";

import { isFirstTimer, postAuthRedirect } from "@/lib/auth/onboarding";
import { createClient } from "@/lib/supabase/server";

/**
 * Handles the email-confirmation link from Supabase sign-up / magic links.
 * Verifies the OTP token and redirects on success.
 *
 * First-time accounts (profiles.onboarded_at is null) get rewritten to
 * the post-signup walkthrough at /welcome/region; returning users honor
 * the caller-supplied `next`. See lib/auth/onboarding.ts for the rule.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const nextRaw = searchParams.get("next") ?? "/profile";
  // Only honor same-origin paths.
  const next =
    nextRaw.startsWith("/") && !nextRaw.startsWith("//") ? nextRaw : "/profile";

  if (tokenHash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash: tokenHash,
    });
    if (!error) {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const firstTimer = user ? await isFirstTimer(supabase, user.id) : false;
      return NextResponse.redirect(
        new URL(postAuthRedirect(next, firstTimer), request.url),
      );
    }
  }

  return NextResponse.redirect(
    new URL("/login?error=confirmation_failed", request.url),
  );
}

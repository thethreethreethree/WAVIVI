import { createClient } from "@/lib/supabase/server";

import { DeletionPendingBannerClient } from "./deletion-pending-banner-client";

/**
 * Server wrapper for the "your account is scheduled for deletion" banner.
 *
 * Reads the signed-in user's profile.deletion_requested_at on every
 * (app) layout render. Shows the client banner when the value is set
 * AND we're still inside the 30-day grace. Outside the window the
 * row is queued for purge by the deletion job and the banner has no
 * useful action — we let those sessions through silently.
 *
 * Reads are cheap (single PK lookup) but happen on every navigation
 * inside the app shell. If this ever shows up in p95 latency, cache
 * via revalidate or hoist to middleware — for now the cost is well
 * below the existing getUser() call right above it.
 */

const GRACE_DAYS = 30;

export async function DeletionPendingBanner() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: profile } = await supabase
    .from("profiles")
    .select("deletion_requested_at")
    .eq("id", user.id)
    .maybeSingle();

  const stamp = profile?.deletion_requested_at;
  if (!stamp) return null;

  const requestedAtMs = new Date(stamp).getTime();
  const elapsedDays = (Date.now() - requestedAtMs) / (1000 * 60 * 60 * 24);
  if (!Number.isFinite(elapsedDays) || elapsedDays < 0) return null;

  const daysRemaining = Math.max(0, Math.ceil(GRACE_DAYS - elapsedDays));
  return <DeletionPendingBannerClient daysRemaining={daysRemaining} />;
}

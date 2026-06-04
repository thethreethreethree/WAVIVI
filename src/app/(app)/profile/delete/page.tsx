import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ScreenHeader } from "@/components/ui/screen-header";
import { createClient } from "@/lib/supabase/server";

import { DeleteAccountForm } from "./delete-account-form";

export const metadata: Metadata = { title: "Delete account" };

/** Account-deletion request page. Last stop before requestAccountDeletion
 *  flips the soft-delete flag. The page itself is server-rendered so an
 *  unauthenticated visitor never sees the form — they're sent to /login
 *  with next set back, mirroring every other auth-gated surface. */
export default async function DeleteAccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=%2Fprofile%2Fdelete");
  }

  // If the user is already mid-grace, send them to the cancellation
  // surface instead of the request form — no point asking a user who
  // already requested deletion to request it again.
  const { data: profile } = await supabase
    .from("profiles")
    .select("deletion_requested_at, display_name")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.deletion_requested_at) {
    redirect("/account/scheduled-for-deletion?status=pending");
  }

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Delete account" back="/settings" />
      <div className="flex flex-col gap-5 px-5 pb-8 pt-2">
        <div className="rounded-2xl bg-heat/10 p-4 ring-1 ring-heat/30">
          <h2 className="text-base font-bold text-heat">
            This will end your Wondavu account
          </h2>
          <p className="mt-2 text-sm text-foreground/85">
            Once you confirm, your profile, messages, group memberships,
            saved itineraries, feed posts, and tracker history will be
            scheduled for deletion. We hold the data for 30 days so you
            can reverse the request by signing back in — after that, it
            is permanently deleted from our systems.
          </p>
        </div>

        <section>
          <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
            What happens
          </h3>
          <ul className="flex flex-col gap-2.5 text-sm text-foreground/85">
            <li className="flex gap-2.5">
              <span className="font-bold text-glow">·</span>
              <span>
                Your profile, posts, and messages stop being visible to
                other travelers immediately.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="font-bold text-glow">·</span>
              <span>
                You&rsquo;re signed out. The account is held in a
                30-day grace state.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="font-bold text-glow">·</span>
              <span>
                Signing back in within 30 days lets you cancel and
                restore everything.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="font-bold text-glow">·</span>
              <span>
                After day 30, your data is permanently deleted.
              </span>
            </li>
          </ul>
        </section>

        <DeleteAccountForm displayName={profile?.display_name ?? "your account"} />
      </div>
    </div>
  );
}

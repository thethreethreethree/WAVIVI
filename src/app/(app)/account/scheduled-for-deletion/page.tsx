import type { Metadata } from "next";
import Link from "next/link";

import { ScreenHeader } from "@/components/ui/screen-header";

export const metadata: Metadata = {
  title: "Account scheduled for deletion",
};

/** Post-request confirmation. The user has been signed out — this page
 *  is reachable as a stop-over either right after the request (status
 *  query absent) or when the deletion-pending banner redirects them
 *  here for cancellation guidance (?status=pending). Same copy works
 *  for both because the user-facing message is "your account is in
 *  the 30-day grace window — sign in to undo."
 */
export default function ScheduledForDeletionPage() {
  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Account scheduled" back="/" />
      <div className="flex flex-col gap-5 px-5 pb-8 pt-2">
        <div className="rounded-2xl bg-cool/10 p-5 ring-1 ring-cool/30">
          <h1 className="text-2xl font-bold tracking-tight">
            We&rsquo;re sorry to see you go
          </h1>
          <p className="mt-3 text-base text-foreground/85">
            Your account is in a <strong>30-day grace window</strong> before
            permanent deletion. During this window your profile and posts
            stay hidden, you stay signed out, and no one can see your
            content.
          </p>
          <p className="mt-3 text-base text-foreground/85">
            If you change your mind, just sign back in and tap{" "}
            <strong>Cancel deletion</strong> in the banner at the top of
            the app. After day 30, everything is permanently removed
            from our systems and can&rsquo;t be recovered.
          </p>
        </div>

        <section>
          <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
            What we do during the 30 days
          </h2>
          <ul className="flex flex-col gap-2.5 text-sm text-foreground/85">
            <li className="flex gap-2.5">
              <span className="font-bold text-glow">·</span>
              <span>
                Hide your profile, posts, and messages from other
                travelers.
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="font-bold text-glow">·</span>
              <span>Stop sending you any notifications or emails.</span>
            </li>
            <li className="flex gap-2.5">
              <span className="font-bold text-glow">·</span>
              <span>
                Honor any data-export or access requests at the email
                tied to the account.
              </span>
            </li>
          </ul>
        </section>

        <p className="text-sm text-muted">
          Questions? Email{" "}
          <a
            href="mailto:privacy@wondavu.com"
            className="text-glow underline"
          >
            privacy@wondavu.com
          </a>
          .
        </p>

        <div className="flex gap-2">
          <Link
            href="/login"
            className="flex-1 rounded-xl bg-glow py-3 text-center text-base font-bold text-white"
          >
            Sign back in to cancel
          </Link>
          <Link
            href="/"
            className="flex-1 rounded-xl py-3 text-center text-base font-semibold ring-1 ring-border hover:bg-surface-elevated"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}

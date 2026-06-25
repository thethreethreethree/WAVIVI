import type { Metadata } from "next";

import { ScreenHeader } from "@/components/ui/screen-header";
import { t } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Blocked travelers" };

export default async function BlockedPage() {
  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title={await t("profile.blocked")} back="/settings" />
      <div className="flex flex-col gap-5 px-5 pb-8 pt-2">
        <p className="text-base text-muted">
          Travelers you block can&rsquo;t see your profile, message you, or
          appear in your event suggestions. They won&rsquo;t be told they were
          blocked.
        </p>

        <div className="wc-frame rounded-2xl p-8 text-center">
          <p className="text-5xl" aria-hidden>
            🤍
          </p>
          <p className="mt-3 text-lg font-bold text-foreground">
            You haven&rsquo;t blocked anyone
          </p>
          <p className="mt-1 text-sm text-muted">
            Nothing to manage here right now. If someone makes you
            uncomfortable, tap the ⋯ menu on their profile or in chat to
            block them.
          </p>
        </div>

        <div className="wc-frame rounded-2xl p-4">
          <p className="text-base font-bold text-foreground">
            Reporting is different
          </p>
          <p className="mt-1 text-sm text-muted">
            Blocking is private. If a traveler violates community rules
            (harassment, scams, fake profiles), use{" "}
            <span className="font-semibold text-glow">Report a problem</span> so
            our team can investigate.
          </p>
        </div>
      </div>
    </div>
  );
}

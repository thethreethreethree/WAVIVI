import type { Metadata } from "next";

import { NotificationsForm } from "./notifications-form";
import { ScreenHeader } from "@/components/ui/screen-header";
import { t } from "@/lib/i18n/server";

export const metadata: Metadata = { title: "Notifications" };

export default async function NotificationsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title={await t("profile.notifications")} back="/settings" />
      <div className="flex flex-col gap-5 px-5 pb-8 pt-2">
        <p className="text-base text-muted">
          Choose what Wondavu pings you about. Preferences are saved on this
          device.
        </p>
        <NotificationsForm />
      </div>
    </div>
  );
}

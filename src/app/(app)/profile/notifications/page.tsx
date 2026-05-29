import type { Metadata } from "next";

import { NotificationsForm } from "./notifications-form";
import { ScreenHeader } from "@/components/ui/screen-header";

export const metadata: Metadata = { title: "Notifications" };

export default function NotificationsPage() {
  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Notifications" back="/settings" />
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

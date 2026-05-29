import type { Metadata } from "next";

import { PrivacyForm } from "./privacy-form";
import { ScreenHeader } from "@/components/ui/screen-header";

export const metadata: Metadata = { title: "Privacy" };

export default function PrivacyPage() {
  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Privacy" back="/settings" />
      <div className="flex flex-col gap-5 px-5 pb-8 pt-2">
        <p className="text-base text-muted">
          Control who can see your profile and how they can reach you.
          Preferences are saved on this device.
        </p>
        <PrivacyForm />
      </div>
    </div>
  );
}

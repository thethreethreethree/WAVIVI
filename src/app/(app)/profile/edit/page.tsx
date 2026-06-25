import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ScreenHeader } from "@/components/ui/screen-header";
import { EditProfileForm } from "@/features/profile/edit-profile-form";
import { t } from "@/lib/i18n/server";
import { getCurrentProfile } from "@/lib/profiles";

export const metadata: Metadata = { title: "Edit Profile" };

export default async function EditProfilePage() {
  const profile = await getCurrentProfile();
  if (!profile) redirect("/login");

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title={await t("profile.editProfile")} back="/profile" />
      <div className="px-5 pb-8 pt-2">
        <EditProfileForm profile={profile} />
      </div>
    </div>
  );
}

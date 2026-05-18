import type { Metadata } from "next";

import { ScreenHeader } from "@/components/ui/screen-header";
import { EditProfileForm } from "@/features/profile/edit-profile-form";

export const metadata: Metadata = { title: "Edit Profile" };

export default function EditProfilePage() {
  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Edit Profile" back="/profile" />
      <div className="px-5 pb-8 pt-2">
        <EditProfileForm />
      </div>
    </div>
  );
}

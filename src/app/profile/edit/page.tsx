import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ProfileForm, getCurrentProfile } from "@/features/profile";

export const metadata: Metadata = { title: "Edit profile" };

export default async function EditProfilePage() {
  const profile = await getCurrentProfile();

  if (!profile) redirect("/login");

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16">
      <div className="w-full max-w-md">
        <h1 className="mb-1 text-xl font-semibold">Edit profile</h1>
        <p className="mb-6 text-sm text-muted">
          This is how other travelers will see you.
        </p>
        <ProfileForm profile={profile} />
      </div>
    </main>
  );
}

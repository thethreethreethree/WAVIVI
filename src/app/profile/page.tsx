import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { signOut } from "@/features/auth";
import { ProfileCard, getCurrentProfile } from "@/features/profile";

export const metadata: Metadata = { title: "Your profile" };

export default async function ProfilePage() {
  const profile = await getCurrentProfile();

  // The proxy guards this route, but guard again in case of a race.
  if (!profile) redirect("/login");

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16">
      <div className="w-full max-w-md">
        <ProfileCard profile={profile} />

        <div className="mt-4 flex gap-2">
          <Link
            href="/profile/edit"
            className="flex-1 rounded-lg bg-glow px-4 py-2.5 text-center text-sm
                       font-medium text-white transition-opacity hover:opacity-90"
          >
            Edit profile
          </Link>
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-lg border border-border px-4 py-2.5 text-sm
                         font-medium text-muted transition-colors hover:text-heat"
            >
              Sign out
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}

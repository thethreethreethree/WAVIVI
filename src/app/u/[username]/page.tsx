import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ProfileCard, getProfileByUsername } from "@/features/profile";

type Params = Promise<{ username: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfileByUsername(username);
  return {
    title: profile ? `${profile.display_name} (@${profile.username})` : "Profile",
  };
}

export default async function PublicProfilePage({
  params,
}: {
  params: Params;
}) {
  const { username } = await params;
  const profile = await getProfileByUsername(username);

  if (!profile) notFound();

  return (
    <main className="flex flex-1 flex-col items-center px-6 py-16">
      <div className="w-full max-w-md">
        <ProfileCard profile={profile} />
      </div>
    </main>
  );
}

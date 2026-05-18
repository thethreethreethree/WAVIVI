import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AddFriendButton } from "@/components/ui/add-friend-button";
import { CountryFlags } from "@/components/ui/country-flags";
import { getProfileByUsername } from "@/lib/profiles";

type Params = Promise<{ username: string }>;

/** Human label for each traveler status. */
const STATUS_LABEL: Record<string, string> = {
  exploring: "Exploring",
  local: "Local",
  transit: "In transit",
  offline: "Offline",
};

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { username } = await params;
  const profile = await getProfileByUsername(username);
  return { title: profile ? profile.display_name : "User Profile" };
}

export default async function UserProfilePage({
  params,
}: {
  params: Params;
}) {
  const { username } = await params;
  const profile = await getProfileByUsername(username);
  if (!profile) notFound();

  const initial = profile.display_name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center gap-3 px-5 pb-2 pt-[max(3rem,calc(env(safe-area-inset-top)+2rem))]">
        <Link href="/meet" aria-label="Back" className="text-foreground">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="h-5 w-5"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <h1 className="flex-1 text-lg font-bold">User Profile</h1>
      </header>

      <div className="flex flex-col items-center px-5">
        <span className="wc-frame relative h-24 w-24 rounded-full p-1">
          <span className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-surface-elevated">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={profile.display_name}
                fill
                sizes="96px"
                className="object-cover"
              />
            ) : (
              <span className="text-3xl font-bold text-glow">{initial}</span>
            )}
          </span>
        </span>
        <h2 className="mt-3 text-xl font-bold">{profile.display_name}</h2>
        <p className="mt-0.5 text-sm text-muted">@{profile.username}</p>

        <span className="wc-frame wc-frame-ghost mt-2 rounded-full px-3 py-1 text-xs font-semibold text-glow">
          {STATUS_LABEL[profile.traveler_status] ?? "Exploring"}
        </span>

        {profile.bio && (
          <p className="mt-3 max-w-[18rem] text-center text-sm italic text-muted">
            &ldquo;{profile.bio}&rdquo;
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <AddFriendButton />
          <Link
            href="/meet"
            className="wc-frame wc-frame-ghost rounded-full px-5 py-2 text-sm font-semibold text-glow"
          >
            Invite to Chat
          </Link>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted">
          Travejor connects travelers through group chats — no private DMs.
        </p>
      </div>

      {/* Home country */}
      {profile.home_country && (
        <section className="mt-6 px-5 pb-8">
          <h3 className="text-sm font-bold">Home Country</h3>
          <div className="mt-3">
            <CountryFlags countries={[profile.home_country]} showLabels />
          </div>
        </section>
      )}
    </div>
  );
}

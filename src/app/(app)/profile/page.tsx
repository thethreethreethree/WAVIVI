import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CountryFlags } from "@/components/ui/country-flags";
import { Icon } from "@/components/ui/icon";
import { getCurrentProfile } from "@/lib/profiles";

export const metadata: Metadata = { title: "My Profile" };

/** Human label for each traveler status. */
const STATUS_LABEL: Record<string, string> = {
  exploring: "Exploring",
  local: "Local",
  transit: "In transit",
  offline: "Offline",
};

export default async function MyProfilePage() {
  const profile = await getCurrentProfile();

  // Not signed in (or no profile row) — send them to log in.
  if (!profile) redirect("/login");

  const initial = profile.display_name.trim().charAt(0).toUpperCase() || "?";

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center px-5 pb-2 pt-[max(3rem,calc(env(safe-area-inset-top)+2rem))]">
        <span className="w-10" />
        <h1 className="flex-1 text-center text-lg font-bold">My Profile</h1>
        <Link
          href="/settings"
          aria-label="Settings"
          className="text-glow transition-transform active:scale-90"
        >
          <Icon name="settings" className="h-10 w-10" />
        </Link>
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
          <p className="mt-3 max-w-sm text-center text-sm text-muted">
            {profile.bio}
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <Link
            href="/profile/edit"
            className="wc-frame wc-frame-ghost rounded-full px-5 py-2 text-sm font-semibold text-glow"
          >
            Edit Profile
          </Link>
          <Link
            href="/settings"
            className="wc-frame wc-frame-sunset rounded-full px-5 py-2 text-sm font-semibold text-white"
          >
            Settings
          </Link>
        </div>
      </div>

      {/* Home country */}
      {profile.home_country && (
        <section className="mt-6 px-5">
          <h3 className="text-sm font-bold">Home Country</h3>
          <div className="mt-3">
            <CountryFlags countries={[profile.home_country]} showLabels />
          </div>
        </section>
      )}
    </div>
  );
}

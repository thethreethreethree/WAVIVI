import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CountryFlags } from "@/components/ui/country-flags";
import { Icon } from "@/components/ui/icon";
import {
  InstagramConnectCard,
  InstagramProfileBadge,
} from "@/features/instagram";
import { getCurrentProfile } from "@/lib/profiles";
import { travelerNotes } from "@/lib/travejor/account";

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
  // Recent notes the community has left for / about this user.
  // (Real `traveler_notes` table is a separate P1 — for now this is a
  // friendly empty-state preview using the mock feed.)
  const noteCount = travelerNotes.length;

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
          <Icon
            name="settings"
            className="h-10 w-10 animate-[spin_8s_linear_infinite]"
          />
        </Link>
      </header>

      {/* Identity */}
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
          <p className="mt-3 max-w-sm text-center text-sm italic text-muted">
            &ldquo;{profile.bio}&rdquo;
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

      {/* Countries traveled (driven by home_country today; we'll add a
          `countries[]` profile column when the traveler-history feature lands). */}
      <section className="mt-6 px-5">
        <h3 className="text-sm font-bold">Countries Traveled</h3>
        <div className="mt-3">
          {profile.home_country ? (
            <CountryFlags countries={[profile.home_country]} showLabels />
          ) : (
            <p className="text-xs text-muted">
              Add your home country in{" "}
              <Link href="/profile/edit" className="text-glow underline">
                Edit Profile
              </Link>{" "}
              to start building your travel map.
            </p>
          )}
        </div>
      </section>

      {/* Travel Identity — Instagram. Shows the linked badge once connected,
          plus the connect card so the user can update / unlink. */}
      <section className="mt-6 px-5">
        <h3 className="text-sm font-bold">Travel Identity</h3>
        <div className="mt-3 flex flex-col gap-3">
          {profile.instagram_username && (
            <InstagramProfileBadge
              identity={{
                username: profile.instagram_username,
                verified: profile.instagram_verified,
                posts: [],
              }}
            />
          )}
          <InstagramConnectCard
            initialUsername={profile.instagram_username ?? ""}
            initialVerified={profile.instagram_verified}
          />
        </div>
      </section>

      {/* Traveler notes — preview pointing at the full feed. Becomes a
          real `notes about you` list when traveler_notes ships. */}
      <section className="mt-6 px-5 pb-8">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">Traveler Notes</h3>
          <Link href="/notes" className="text-xs font-medium text-glow">
            See all
          </Link>
        </div>
        <Link
          href="/notes"
          className="wc-frame mt-3 flex items-center gap-3 rounded-2xl p-4 active:scale-[0.99]"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-glow/15 text-lg">
            📓
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold">
              {noteCount} note{noteCount === 1 ? "" : "s"} from fellow travelers
            </span>
            <span className="block text-xs text-muted">
              Community-written notes build real, traveler-to-traveler trust.
            </span>
          </span>
          <span className="text-muted">›</span>
        </Link>
      </section>
    </div>
  );
}

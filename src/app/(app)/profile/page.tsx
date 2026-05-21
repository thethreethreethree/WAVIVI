import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { CountryFlags } from "@/components/ui/country-flags";
import { Icon } from "@/components/ui/icon";
import { flagImage } from "@/lib/travejor/account";
import {
  InstagramConnectCard,
  InstagramFeed,
  InstagramProfileBadge,
  InstagramShowcase,
} from "@/features/instagram";
import { postShortcode } from "@/features/instagram/validation";
import { getCurrentProfile } from "@/lib/profiles";
import { travelerNotes } from "@/lib/travejor/account";
import { photo } from "@/lib/travejor/photo";

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
  const myUsername = profile.username;

  // Two distinct Instagram lists — Featured Travel Moments and Travel
  // Feed live in their own DB columns and never share content. Each
  // URL carries a parallel signed CDN thumbnail (set when Pull-from-IG
  // last ran); we fall back to a placeholder when one isn't stored.
  function buildPosts(
    urls: string[] | null,
    thumbs: string[] | null,
    prefix: string,
  ) {
    return (urls ?? []).map((url, i) => ({
      id: `${myUsername}-${prefix}-${i}`,
      url,
      image:
        thumbs?.[i] || photo(postShortcode(url) ?? url, 300, 300),
    }));
  }
  const featuredPosts = buildPosts(
    profile.instagram_post_urls,
    profile.instagram_post_thumbnails,
    "feat",
  );
  const feedPosts = buildPosts(
    profile.instagram_feed_urls,
    profile.instagram_feed_thumbnails,
    "feed",
  );
  const hasAnyPosts = featuredPosts.length + feedPosts.length > 0;

  // Aggregate visited countries: explicit list, plus home_country fallback
  // so newcomers without a list still see at least one flag.
  const countries = (profile.countries ?? []).length
    ? (profile.countries ?? [])
    : profile.home_country
      ? [profile.home_country]
      : [];

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
        <span className="wc-frame wc-frame-orange relative h-28 w-28 rounded-full p-1.5">
          <span className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-surface-elevated">
            {profile.avatar_url ? (
              <Image
                src={profile.avatar_url}
                alt={profile.display_name}
                fill
                sizes="112px"
                className="object-cover"
              />
            ) : (
              <span className="text-4xl font-bold text-glow">{initial}</span>
            )}
          </span>
          {profile.home_country && (
            <span
              className="wc-frame wc-frame-orange absolute -bottom-2 right-0 z-10 block h-10 w-10 rounded-full p-1"
              title={profile.home_country}
            >
              <span className="relative block h-full w-full overflow-hidden rounded-full bg-white">
                <Image
                  src={flagImage(profile.home_country)}
                  alt={profile.home_country}
                  fill
                  sizes="40px"
                  className="object-cover object-center"
                />
              </span>
            </span>
          )}
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
            className="wc-frame wc-frame-orange-white rounded-full px-5 py-2 text-sm font-semibold text-glow"
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

      {/* Countries traveled — pulls from the explicit list, falling back to
          home_country until the user fills out their travel history. */}
      <section className="mt-6 px-5">
        <h3 className="text-sm font-bold">Countries Traveled</h3>
        <div className="mt-3">
          {countries.length > 0 ? (
            <CountryFlags countries={countries} showLabels />
          ) : (
            <p className="text-xs text-muted">
              Add your countries in{" "}
              <Link href="/profile/edit" className="text-glow underline">
                Edit Profile
              </Link>{" "}
              to start building your travel map.
            </p>
          )}
        </div>
      </section>

      {/* Travel Identity — Instagram. Badge first when connected, then the
          connect card so the user can update / verify / unlink. */}
      <section className="mt-6 px-5">
        <h3 className="text-base font-bold">Travel Identity</h3>
        <div className="mt-3 flex flex-col gap-3">
          {profile.instagram_username && (
            <InstagramProfileBadge
              identity={{
                username: profile.instagram_username,
                verified: profile.instagram_verified,
                posts: featuredPosts,
              }}
            />
          )}
          <InstagramConnectCard
            initialUsername={profile.instagram_username ?? ""}
            initialVerified={profile.instagram_verified}
          />
          {featuredPosts.length > 0 && (
            <div>
              <h3 className="mb-3 text-base font-bold">
                Featured Travel Moments
              </h3>
              <InstagramShowcase posts={featuredPosts} />
            </div>
          )}
          {profile.instagram_username && !hasAnyPosts && (
            <p className="text-xs text-muted">
              Add a few favourite posts in{" "}
              <Link
                href="/profile/edit#travel-posts"
                className="text-glow underline"
              >
                Edit Profile
              </Link>{" "}
              to fill out your showcase.
            </p>
          )}
        </div>
      </section>

      {/* Travel Feed — its own list in the DB (instagram_feed_urls). */}
      {profile.instagram_username && (
        <section className="mt-6 px-5 pb-2">
          <h3 className="mb-3 text-base font-bold">Travel Feed</h3>
          {feedPosts.length > 0 ? (
            <InstagramFeed
              posts={feedPosts}
              username={profile.instagram_username}
            />
          ) : (
            <p className="wc-frame rounded-2xl p-4 text-center text-sm text-muted">
              Add Travel Feed posts in{" "}
              <Link
                href="/profile/edit#travel-posts"
                className="text-glow underline"
              >
                Edit Profile
              </Link>
              .
            </p>
          )}
        </section>
      )}

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

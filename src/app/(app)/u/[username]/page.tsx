import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AddFriendButton } from "@/components/ui/add-friend-button";
import { CountryFlags } from "@/components/ui/country-flags";
import {
  InstagramFeed,
  InstagramProfileBadge,
  InstagramShowcase,
} from "@/features/instagram";
import type { InstagramIdentity } from "@/features/instagram";
import { flagImage, travelerNotes } from "@/lib/travejor/account";
import { getMember } from "@/lib/travejor/members";
import { photo } from "@/lib/travejor/photo";
import { getProfileByUsername } from "@/lib/profiles";

type Params = Promise<{ username: string }>;

/** Unified view of a traveler, sourced from the real profile or the mock roster. */
interface DisplayTraveler {
  username: string;
  name: string;
  avatar: string;
  bio: string;
  countries: string[];
  verified: boolean;
  instagram: InstagramIdentity | null;
  /** Travel Feed posts — separate column on real profiles. */
  feedPosts: InstagramIdentity["posts"];
}

/** Build IG post list from URL + parallel thumbnail arrays. */
function postsFromUrls(
  username: string,
  prefix: string,
  urls: string[],
  thumbs: string[] = [],
) {
  return urls.slice(0, 12).map((url, i) => ({
    id: `${username}-${prefix}-${i}`,
    url,
    image:
      thumbs[i] || photo(`ig-${username}-${prefix}-${i}`, 300, 300),
  }));
}

async function loadTraveler(username: string): Promise<DisplayTraveler | null> {
  // Prefer the real profile when one exists; fall back to the mock roster
  // so the page is always viewable while accounts are being seeded.
  const real = await getProfileByUsername(username);
  if (real) {
    const instagram: InstagramIdentity | null = real.instagram_username
      ? {
          username: real.instagram_username,
          verified: real.instagram_verified,
          posts: postsFromUrls(
            real.instagram_username,
            "feat",
            real.instagram_post_urls ?? [],
            real.instagram_post_thumbnails ?? [],
          ),
        }
      : null;
    const feedPosts = real.instagram_username
      ? postsFromUrls(
          real.instagram_username,
          "feed",
          real.instagram_feed_urls ?? [],
          real.instagram_feed_thumbnails ?? [],
        )
      : [];
    return {
      username: real.username,
      name: real.display_name,
      avatar: real.avatar_url ?? photo(real.username, 200, 200),
      bio: real.bio ?? "",
      home_country: real.home_country ?? null,
      countries:
        (real.countries ?? []).length > 0
          ? (real.countries ?? [])
          : real.home_country
            ? [real.home_country]
            : [],
      verified: real.instagram_verified,
      instagram,
      feedPosts,
    };
  }
  const m = getMember(username);
  if (!m) return null;
  // Mock members carry a single posts list; split half-half so Featured
  // and Feed don't duplicate on existing mock profiles.
  const allPosts = m.instagram?.posts ?? [];
  const splitAt =
    allPosts.length > 6 ? 6 : Math.ceil(allPosts.length / 2);
  return {
    username: m.username,
    name: m.name,
    avatar: m.avatar,
    bio: m.bio,
    home_country: m.countries?.[0] ?? null,
    countries: m.countries,
    verified: m.verified,
    instagram: m.instagram
      ? { ...m.instagram, posts: allPosts.slice(0, splitAt) }
      : null,
    feedPosts: allPosts.slice(splitAt),
  };
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { username } = await params;
  const t = await loadTraveler(username);
  return { title: t ? t.name : "User Profile" };
}

export default async function UserProfilePage({
  params,
}: {
  params: Params;
}) {
  const { username } = await params;
  const t = await loadTraveler(username);
  if (!t) notFound();

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
        <span className="text-muted">
          <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5">
            <circle cx="12" cy="5" r="1.6" />
            <circle cx="12" cy="12" r="1.6" />
            <circle cx="12" cy="19" r="1.6" />
          </svg>
        </span>
      </header>

      <div className="flex flex-col items-center px-5">
        <span className="wc-frame wc-frame-orange relative h-28 w-28 rounded-full p-1.5">
          <span className="relative block h-full w-full overflow-hidden rounded-full">
            <Image
              src={t.avatar}
              alt={t.name}
              fill
              sizes="112px"
              className="object-cover"
            />
          </span>
          {t.home_country && (
            <span
              className="wc-frame wc-frame-orange absolute -bottom-1 -right-1 block h-10 w-10 rounded-full p-1"
              title={t.home_country}
            >
              <span className="relative block h-full w-full overflow-hidden rounded-full bg-white">
                <Image
                  src={flagImage(t.home_country)}
                  alt={t.home_country}
                  fill
                  sizes="40px"
                  className="object-cover object-center"
                />
              </span>
            </span>
          )}
        </span>
        <h2 className="mt-3 flex items-center gap-1.5 text-xl font-bold">
          {t.name}
          {t.verified && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cool text-[10px] text-white">
              ✓
            </span>
          )}
        </h2>
        {t.bio && (
          <p className="mt-1 max-w-[18rem] text-center text-sm italic text-muted">
            &ldquo;{t.bio}&rdquo;
          </p>
        )}

        <div className="mt-4 flex gap-2">
          <AddFriendButton />
          <Link
            href="/meet"
            className="rounded-full border border-foreground/20 px-5 py-2 text-sm font-semibold"
          >
            Invite to Chat
          </Link>
        </div>
        <p className="mt-2 text-center text-[11px] text-muted">
          Travejor connects travelers through group chats — no private DMs.
        </p>
      </div>

      {/* Countries traveled */}
      {t.countries.length > 0 && (
        <section className="mt-6 px-5">
          <h3 className="text-sm font-bold">Countries Traveled</h3>
          <div className="mt-3">
            <CountryFlags countries={t.countries} showLabels />
          </div>
        </section>
      )}

      {/* Travel Identity — Instagram social layer.
          Split the post list so Featured Moments (first 6) and the Travel
          Feed (subsequent posts) never share the same artwork. */}
      {t.instagram && (
        <>
          <section className="mt-6 px-5">
            <h3 className="text-base font-bold">Travel Identity</h3>
            <div className="mt-3 flex flex-col gap-3">
              <InstagramProfileBadge identity={t.instagram} />
              {t.instagram.posts.length > 0 && (
                <div>
                  <h3 className="mb-3 text-base font-bold">
                    Featured Travel Moments
                  </h3>
                  <InstagramShowcase posts={t.instagram.posts} />
                </div>
              )}
            </div>
          </section>

          {t.feedPosts.length > 0 && (
            <section className="mt-6 px-5">
              <h3 className="mb-3 text-base font-bold">Travel Feed</h3>
              <InstagramFeed
                posts={t.feedPosts}
                username={t.instagram.username}
              />
            </section>
          )}
        </>
      )}

      {/* Traveler notes */}
      <section className="mt-6 px-5 pb-8">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">Traveler Notes</h3>
          <Link href="/notes" className="text-xs font-medium text-glow">
            See all
          </Link>
        </div>
        <div className="mt-3 flex flex-col gap-2">
          {travelerNotes.slice(0, 2).map((note) => (
            <div
              key={note.id}
              className="wc-frame flex items-start gap-2 rounded-2xl p-3"
            >
              <span className="wc-frame relative h-8 w-8 shrink-0 rounded-full p-1">
                <span className="relative block h-full w-full overflow-hidden rounded-full">
                  <Image
                    src={note.fromAvatar}
                    alt={note.from}
                    fill
                    sizes="28px"
                    className="object-cover"
                  />
                </span>
              </span>
              <p className="text-sm text-foreground/90">
                {note.text}{" "}
                <span className="text-xs text-muted">
                  — {note.from} · {note.time}
                </span>
              </p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

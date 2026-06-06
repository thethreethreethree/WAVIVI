import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AddFriendButton } from "@/components/ui/add-friend-button";
import { BackButton } from "@/components/ui/back-button";
import { CountryFlags } from "@/components/ui/country-flags";
import { LeaveNoteForm } from "@/features/notes/components/leave-note-form";
import {
  InstagramFeed,
  InstagramProfileBadge,
  InstagramShowcase,
} from "@/features/instagram";
import type { InstagramIdentity } from "@/features/instagram";
import { getNotesForRecipient, hasNotedRecipient } from "@/lib/notes";
import { getProfileByUsername } from "@/lib/profiles";
import { createClient } from "@/lib/supabase/server";
import { flagImage } from "@/lib/travejor/account";
import { getMember } from "@/lib/travejor/members";
import { photo } from "@/lib/travejor/photo";

type Params = Promise<{ username: string }>;

/** Unified view of a traveler, sourced from the real profile or the mock roster. */
interface DisplayTraveler {
  /** Auth user id when the profile is real — null for mock-only entries. */
  userId: string | null;
  username: string;
  name: string;
  /** null when the real account hasn't set one — render the initial fallback
   *  instead of a random nature stock photo. Mock members always carry a real
   *  avatar URL from the seed roster. */
  avatar: string | null;
  bio: string;
  home_country: string | null;
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
      userId: real.id,
      username: real.username,
      name: real.display_name,
      avatar: real.avatar_url ?? null,
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
    userId: null,
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

export const dynamic = "force-dynamic";

export default async function UserProfilePage({
  params,
}: {
  params: Params;
}) {
  const { username } = await params;
  const t = await loadTraveler(username);
  if (!t) notFound();

  // Notes are only meaningful for real profiles (need a recipient user id).
  // Mock-only entries (legacy seed data) show an empty notes section.
  const supabase = await createClient();
  const {
    data: { user: viewer },
  } = await supabase.auth.getUser();
  const isOwnProfile = !!(viewer && t.userId && viewer.id === t.userId);
  const notes = t.userId ? await getNotesForRecipient(t.userId, 20) : [];
  const alreadyLeftNote = t.userId ? await hasNotedRecipient(t.userId) : false;

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center gap-3 px-5 pb-2 pt-[max(3rem,calc(env(safe-area-inset-top)+2rem))]">
        <BackButton fallback="/meet" className="shrink-0" />
        <h1 className="flex-1 text-lg font-bold">User Profile</h1>
        <button
          type="button"
          aria-label="More"
          className="flex h-9 w-9 items-center justify-center rounded-full transition-transform active:scale-95 hover:bg-foreground/5"
        >
          <Image
            src="/icons/rustic/menu_kebab.png"
            alt=""
            width={24}
            height={24}
            className="h-6 w-6 object-contain"
          />
        </button>
      </header>

      <div className="flex flex-col items-center px-5">
        <div className="relative h-28 w-28">
          <span className="wc-frame wc-frame-orange block h-28 w-28 rounded-full p-1.5">
            <span className="relative block h-full w-full overflow-hidden rounded-full bg-surface">
              {t.avatar ? (
                <Image
                  src={t.avatar}
                  alt={t.name}
                  fill
                  sizes="112px"
                  className="object-cover"
                />
              ) : (
                <span className="flex h-full w-full items-center justify-center text-3xl font-bold text-glow">
                  {t.name.slice(0, 1).toUpperCase()}
                </span>
              )}
            </span>
          </span>
          {t.home_country && (
            <div
              className="pointer-events-none absolute bottom-0 right-0 z-10 h-10 w-10"
              title={t.home_country}
            >
              <span className="wc-frame wc-frame-orange block h-full w-full rounded-full p-1">
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
            </div>
          )}
        </div>
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

        {!isOwnProfile && (
          <>
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
              Wondavu connects travelers through group chats — no private DMs.
            </p>
          </>
        )}
      </div>

      {/* Countries traveled — always rendered, even when empty, so the
          profile page structure is consistent across travelers. Empty
          state nudges the owner to fill it in. */}
      <section className="mt-6 px-5">
        <h3 className="text-sm font-bold">Countries Traveled</h3>
        <div className="mt-3">
          {t.countries.length > 0 ? (
            <CountryFlags countries={t.countries} showLabels />
          ) : (
            <ProfileEmpty
              text={
                isOwnProfile
                  ? "No countries yet — add the places you've traveled."
                  : `${t.name.split(" ")[0]} hasn't listed any countries yet.`
              }
              cta={isOwnProfile ? { href: "/profile/edit", label: "Edit profile" } : null}
            />
          )}
        </div>
      </section>

      {/* Travel Identity — Instagram social layer. Always rendered; the
          badge handles its own "not linked" empty state and the post grids
          fall back to placeholders when the lists are empty. */}
      <section className="mt-6 px-5">
        <h3 className="text-base font-bold">Travel Identity</h3>
        <div className="mt-3 flex flex-col gap-3">
          {t.instagram ? (
            <InstagramProfileBadge identity={t.instagram} />
          ) : (
            <ProfileEmpty
              text={
                isOwnProfile
                  ? "Link your Instagram to verify your traveler identity."
                  : `${t.name.split(" ")[0]} hasn't linked an Instagram yet.`
              }
              cta={
                isOwnProfile
                  ? { href: "/profile/edit", label: "Link Instagram" }
                  : null
              }
            />
          )}
        </div>
      </section>

      <section className="mt-6 px-5">
        <h3 className="mb-3 text-base font-bold">Featured Travel Moments</h3>
        {t.instagram && t.instagram.posts.length > 0 ? (
          <InstagramShowcase posts={t.instagram.posts} />
        ) : (
          <ProfileEmpty
            text={
              isOwnProfile
                ? "Featured posts will appear once your Instagram is linked."
                : "No featured posts yet."
            }
            cta={null}
          />
        )}
      </section>

      <section className="mt-6 px-5">
        <h3 className="mb-3 text-base font-bold">Travel Feed</h3>
        {t.instagram && t.feedPosts.length > 0 ? (
          <InstagramFeed
            posts={t.feedPosts}
            username={t.instagram.username}
          />
        ) : (
          <ProfileEmpty
            text={
              isOwnProfile
                ? "Your latest Instagram posts will land here automatically."
                : "Travel feed is empty for now."
            }
            cta={null}
          />
        )}
      </section>

      {/* Traveler notes — real peer references, addressed to this profile. */}
      <section className="mt-6 px-5 pb-8">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold">Traveler Notes</h3>
          <span className="text-xs text-muted">
            {notes.length} {notes.length === 1 ? "note" : "notes"}
          </span>
        </div>

        {/* "Leave a note" form — only when signed in, not your own profile,
            and the profile is a real (not mock) user. Hidden after you've
            left one so the form doesn't double-post on refresh. */}
        {viewer && t.userId && !isOwnProfile && !alreadyLeftNote && (
          <div className="mt-3">
            <LeaveNoteForm
              recipientId={t.userId}
              recipientUsername={t.username}
              recipientName={t.name}
            />
          </div>
        )}
        {viewer && alreadyLeftNote && !isOwnProfile && (
          <p className="mt-3 rounded-2xl bg-cool/10 px-3 py-2 text-center text-[11px] font-semibold text-cool">
            🎒 You&apos;ve already left a note for {t.name.split(" ")[0]}.
          </p>
        )}

        <div className="mt-3 flex flex-col gap-2">
          {notes.length === 0 ? (
            <p className="rounded-2xl bg-surface/70 px-4 py-6 text-center text-sm text-muted ring-1 ring-border">
              No notes yet — be the first to leave one.
            </p>
          ) : (
            notes.map((n) => (
              <div
                key={n.id}
                className="wc-frame flex items-start gap-2 rounded-2xl p-3"
              >
                <Link
                  href={`/u/${n.author_username}`}
                  className="shrink-0"
                  aria-label={n.author_display_name}
                >
                  <span className="wc-frame relative block h-8 w-8 rounded-full p-1">
                    <span className="relative block h-full w-full overflow-hidden rounded-full bg-surface">
                      {n.author_avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={n.author_avatar_url}
                          alt={n.author_display_name}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[11px] font-bold text-glow">
                          {n.author_display_name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </span>
                  </span>
                </Link>
                <p className="text-sm text-foreground/90">
                  &ldquo;{n.body}&rdquo;{" "}
                  <span className="block text-xs text-muted">
                    —{" "}
                    <Link
                      href={`/u/${n.author_username}`}
                      className="font-semibold hover:underline"
                    >
                      {n.author_display_name}
                    </Link>{" "}
                    · {fmtRelative(n.created_at)}
                  </span>
                </p>
              </div>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

/** Empty-state pill used inside profile sections so the structure stays
 *  consistent for every traveler — even ones who haven't filled out yet. */
function ProfileEmpty({
  text,
  cta,
}: {
  text: string;
  cta: { href: string; label: string } | null;
}) {
  return (
    <div className="wc-frame flex flex-col items-center gap-2 rounded-2xl px-4 py-6 text-center">
      <p className="text-sm text-muted">{text}</p>
      {cta && (
        <Link
          href={cta.href}
          className="rounded-full bg-glow px-3.5 py-1.5 text-xs font-bold text-white"
        >
          {cta.label}
        </Link>
      )}
    </div>
  );
}

/** "3 days ago" / "just now" — same style as the rest of the app's feeds. */
function fmtRelative(iso: string): string {
  try {
    const ms = Date.now() - new Date(iso).getTime();
    const m = Math.floor(ms / 60_000);
    if (m < 1) return "just now";
    if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(iso).toLocaleDateString();
  } catch {
    return "";
  }
}

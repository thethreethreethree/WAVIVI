import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { AddFriendButton } from "@/components/ui/add-friend-button";
import {
  InstagramFeed,
  InstagramProfileBadge,
  InstagramShowcase,
} from "@/features/instagram";
import { flagFor, travelerNotes } from "@/lib/travejor/account";
import { getMember } from "@/lib/travejor/members";

type Params = Promise<{ username: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { username } = await params;
  const member = getMember(username);
  return { title: member ? member.name : "User Profile" };
}

export default async function UserProfilePage({
  params,
}: {
  params: Params;
}) {
  const { username } = await params;
  const member = getMember(username);
  if (!member) notFound();

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center gap-3 px-5 pb-2 pt-4">
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
        <span className="relative h-24 w-24">
          <Image
            src={member.avatar}
            alt={member.name}
            fill
            sizes="96px"
            className="rounded-full object-cover ring-2 ring-glow"
          />
        </span>
        <h2 className="mt-3 flex items-center gap-1.5 text-xl font-bold">
          {member.name}
          {member.verified && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-cool text-[10px] text-white">
              ✓
            </span>
          )}
        </h2>
        <p className="mt-1 max-w-[18rem] text-center text-sm italic text-muted">
          &ldquo;{member.bio}&rdquo;
        </p>

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
      <section className="mt-6 px-5">
        <h3 className="text-sm font-bold">Countries Traveled</h3>
        <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
          {member.countries.map((c) => (
            <div key={c} className="flex shrink-0 flex-col items-center gap-1">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-surface-elevated text-lg shadow-sm ring-1 ring-glow/40">
                {flagFor(c)}
              </span>
              <span className="text-[10px] text-muted">{c}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Travel Identity — Instagram social layer */}
      {member.instagram && (
        <section className="mt-6 px-5">
          <h3 className="text-sm font-bold">Travel Identity</h3>
          <div className="mt-3 flex flex-col gap-3">
            <InstagramProfileBadge identity={member.instagram} />
            <div>
              <p className="mb-2 text-xs font-semibold text-muted">
                Featured Travel Moments
              </p>
              <InstagramShowcase posts={member.instagram.posts} />
            </div>
          </div>
        </section>
      )}

      {/* Travel Feed — sourced from Instagram */}
      {member.instagram && (
        <section className="mt-6 px-5">
          <h3 className="mb-3 text-sm font-bold">Travel Feed</h3>
          <InstagramFeed
            posts={member.instagram.posts}
            username={member.instagram.username}
          />
        </section>
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
              className="flex items-start gap-2 rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-border"
            >
              <span className="relative h-7 w-7 shrink-0 overflow-hidden rounded-full">
                <Image
                  src={note.fromAvatar}
                  alt={note.from}
                  fill
                  sizes="28px"
                  className="object-cover"
                />
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

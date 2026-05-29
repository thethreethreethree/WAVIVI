import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BackButton } from "@/components/ui/back-button";
import { JoinGroupButton } from "@/features/chat/components/join-group-button";
import {
  getChatGroup,
  getChatGroupMemberCount,
  getChatGroupMembers,
  isMember,
} from "@/lib/chat";
import { createClient } from "@/lib/supabase/server";
import { categoryMeta } from "@/lib/travejor/group-meta";
import { getGroup } from "@/lib/travejor/groups";
import { flagImage } from "@/lib/travejor/account";

type Params = Promise<{ id: string }>;

export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  const [dbGroup, mockGroup] = await Promise.all([
    getChatGroup(id),
    Promise.resolve(getGroup(id)),
  ]);
  const name = dbGroup?.name ?? mockGroup?.name;
  return { title: name ? `${name} · Group Vibes` : "Group" };
}

export default async function GroupVibesPage({ params }: { params: Params }) {
  const { id } = await params;

  // Real chat_groups row is the source of truth; fall back to the mock
  // metadata for cover image / distance that wasn't seeded.
  const [dbGroup, mockGroup, members, memberCount, joined] = await Promise.all([
    getChatGroup(id),
    Promise.resolve(getGroup(id)),
    getChatGroupMembers(id, 6),
    getChatGroupMemberCount(id),
    isMember(id),
  ]);
  if (!dbGroup && !mockGroup) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const name = dbGroup?.name ?? mockGroup?.name ?? "Group";
  const category = dbGroup?.category ?? mockGroup?.category ?? "Travellers";
  const cover = dbGroup?.cover_image ?? mockGroup?.coverImage ?? "/icons/icon.svg";
  const meta = categoryMeta(category);
  const distance = mockGroup?.distance ?? null;

  return (
    <div className="flex flex-1 flex-col pb-8 pt-[max(2.5rem,calc(env(safe-area-inset-top)+1.5rem))]">
      {/* Hero banner — taller for now so the cover fills the headroom.
          Becomes a rolling autoplay thumbnail of participant photos later. */}
      <div className="relative h-80 w-full">
        <Image
          src={cover}
          alt={name}
          fill
          sizes="448px"
          priority
          className="object-cover"
        />
        {/* No image overlay — title relies on its own drop-shadow for
            contrast; the distance pill and category chip carry their
            own backgrounds. Cover photo shows uncovered. */}
        <BackButton
          fallback="/meet"
          className="absolute left-4 top-[max(1rem,calc(env(safe-area-inset-top)+0.5rem))]"
        />
        <span className="absolute right-4 top-[max(1rem,calc(env(safe-area-inset-top)+0.5rem))] inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-foreground">
          {meta.emoji} {category}
        </span>
        <div className="absolute bottom-3 left-5 right-5">
          {distance && (
            <span className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">
              📍 {distance}
            </span>
          )}
          <h1 className="mt-1.5 text-2xl font-bold leading-tight text-white drop-shadow">
            {name}
          </h1>
        </div>
      </div>

      <div className="px-5 pt-6">
        <p className="text-center text-sm text-muted">
          {memberCount > 0
            ? `${memberCount} traveler${memberCount === 1 ? "" : "s"} already vibing here.`
            : "Be the first to join this group."}
        </p>

        <h2 className="mt-5 text-sm font-bold uppercase tracking-wide text-muted">
          Featured Travelers
        </h2>

        {members.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-surface/70 px-4 py-6 text-center text-sm text-muted ring-1 ring-border">
            No one&apos;s joined yet — be the first.
          </p>
        ) : (
          <div className="-mx-5 mt-3 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {members.map((m) => (
              <Link
                key={m.user_id}
                href={`/u/${m.username}`}
                className="wc-frame w-36 shrink-0 rounded-2xl p-3 text-center"
              >
                <div className="relative mx-auto h-16 w-16">
                  <span className="wc-frame wc-frame-orange relative block h-full w-full rounded-full p-1">
                    <span className="relative block h-full w-full overflow-hidden rounded-full bg-surface">
                      {m.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={m.avatar_url}
                          alt={m.display_name}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-base font-bold text-glow">
                          {m.display_name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </span>
                  </span>
                  {m.home_country && (
                    <span
                      className="pointer-events-none absolute -bottom-0.5 -right-0.5 z-10 block h-5 w-5 overflow-hidden rounded-full bg-white ring-2 ring-background"
                      title={m.home_country}
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={flagImage(m.home_country)}
                        alt={m.home_country}
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    </span>
                  )}
                </div>
                <p className="mt-2 truncate font-bold">
                  {m.display_name.split(" ")[0]}
                </p>
                <p className="mt-0.5 line-clamp-2 text-xs text-muted">
                  {m.bio ?? "Traveler"}
                </p>
              </Link>
            ))}
          </div>
        )}

        {/* Primary CTA — three states: not signed in, signed in but not a
            member (real join action), or already joined (deep-link to chat). */}
        {!user ? (
          <Link
            href={`/login?next=${encodeURIComponent(`/meet/${id}`)}`}
            className="wc-frame wc-frame-sunset mt-10 block rounded-2xl py-3.5 text-center font-bold text-white active:scale-[0.98]"
          >
            Sign in to join the chat
          </Link>
        ) : joined ? (
          <Link
            href={`/meet/${id}/chat`}
            className="wc-frame wc-frame-sunset mt-10 block rounded-2xl py-3.5 text-center font-bold text-white active:scale-[0.98]"
          >
            ✈️ Open Group Chat
          </Link>
        ) : (
          <JoinGroupButton
            groupId={id}
            className="wc-frame wc-frame-sunset mt-10 block w-full rounded-2xl py-3.5 text-center font-bold text-white active:scale-[0.98]"
          >
            ✈️ Join the Group Chat
          </JoinGroupButton>
        )}

        <div className="mt-3 flex flex-col items-center gap-2">
          <Link
            href={`/meet/${id}/members`}
            className="wc-frame wc-frame-orange-white rounded-full px-5 py-2 text-sm font-bold text-glow"
          >
            See all group travelers
          </Link>
          <Link
            href="/notes"
            className="wc-frame wc-frame-orange-white rounded-full px-5 py-2 text-sm font-bold text-glow"
          >
            Read recent traveler notes
          </Link>
        </div>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getGroup } from "@/lib/travejor/groups";
import { members } from "@/lib/travejor/members";
import { photo } from "@/lib/travejor/photo";

type Params = Promise<{ id: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  const group = getGroup(id);
  return { title: group ? `${group.name} · Group Vibes` : "Group" };
}

export default async function GroupVibesPage({ params }: { params: Params }) {
  const { id } = await params;
  const group = getGroup(id);
  if (!group) notFound();

  const featured = members.slice(0, 5);

  return (
    <div className="flex flex-1 flex-col px-5">
      <header className="flex items-center pt-4">
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
        <span className="flex-1 text-center font-semibold text-glow">
          Travejor
        </span>
        <span className="w-5" />
      </header>

      <h1 className="mt-5 text-center text-3xl font-bold text-glow">
        Group Vibes
      </h1>
      <p className="mt-1 text-center text-sm text-muted">
        See who&apos;s already vibing in {group.name} before you jump in.
      </p>

      <h2 className="mt-6 text-sm font-bold">Featured Travelers</h2>
      <div className="-mx-5 mt-3 flex gap-3 overflow-x-auto px-5 pb-1">
        {featured.map((m) => (
          <Link
            key={m.id}
            href={`/u/${m.username}`}
            className="wc-frame w-36 shrink-0 rounded-2xl p-3 text-center"
          >
            <div className="relative mx-auto h-16 w-16">
              <Image
                src={m.avatar}
                alt={m.name}
                fill
                sizes="64px"
                className="rounded-full object-cover"
              />
              {m.verified && (
                <span className="absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-glow text-[10px] text-white ring-2 ring-surface-elevated">
                  ★
                </span>
              )}
            </div>
            <p className="mt-2 font-semibold">{m.name.split(" ")[0]}</p>
            <p className="mt-0.5 text-xs text-muted">{m.tagline}</p>
          </Link>
        ))}
      </div>

      <div className="wc-frame mt-5 rounded-2xl p-4 text-center">
        <p className="text-sm font-medium">
          {group.travelerCount} travelers are already here, sharing spots,
          laughs, and plans.
        </p>
        <div className="mt-3 flex justify-center gap-1.5 text-lg">
          <span>🌍</span>
          <span>✈️</span>
          <span>📸</span>
          <span>🎒</span>
          <span>🍜</span>
        </div>
        <div className="mt-3 flex justify-center">
          <div className="flex -space-x-2">
            {group.memberSeeds.concat(["mx1", "mx2"]).map((seed) => (
              <span
                key={seed}
                className="relative h-8 w-8 overflow-hidden rounded-full ring-2 ring-surface-elevated"
              >
                <Image
                  src={photo(seed, 64, 64)}
                  alt=""
                  fill
                  sizes="32px"
                  className="object-cover"
                />
              </span>
            ))}
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-glow text-xs font-semibold text-white ring-2 ring-surface-elevated">
              +{group.travelerCount}
            </span>
          </div>
        </div>
      </div>

      <Link
        href={`/meet/${group.id}/chat`}
        className="mt-5 rounded-2xl bg-sunset py-3.5 text-center font-bold text-white shadow-card active:scale-[0.98]"
      >
        ✈️ Join the Group Chat
      </Link>

      <div className="mt-3 flex flex-col gap-2 pb-8 text-center">
        <Link
          href={`/meet/${group.id}/members`}
          className="text-sm font-medium text-glow underline"
        >
          See all group travelers
        </Link>
        <Link
          href="/notes"
          className="text-sm font-medium text-glow underline"
        >
          Read recent traveler notes
        </Link>
      </div>
    </div>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BackButton } from "@/components/ui/back-button";
import { categoryMeta } from "@/lib/travejor/group-meta";
import { getGroup } from "@/lib/travejor/groups";
import { members } from "@/lib/travejor/members";

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

  const meta = categoryMeta(group.category);
  const featured = members.slice(0, 5);

  return (
    <div className="flex flex-1 flex-col pb-8">
      {/* Hero banner */}
      <div className="relative h-52 w-full">
        <Image
          src={group.coverImage}
          alt={group.name}
          fill
          sizes="448px"
          priority
          className="object-cover"
        />
        <span
          className={`absolute inset-0 bg-gradient-to-t ${meta.tint} via-black/30 to-black/10`}
          aria-hidden
        />
        <BackButton
          fallback="/meet"
          className="absolute left-4 top-[max(1rem,calc(env(safe-area-inset-top)+0.5rem))] flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition-transform active:scale-95"
        />
        <span className="absolute right-4 top-[max(1rem,calc(env(safe-area-inset-top)+0.5rem))] inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-foreground">
          {meta.emoji} {group.category}
        </span>
        <div className="absolute bottom-3 left-5 right-5">
          <span className="inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">
            📍 {group.distance}
          </span>
          <h1 className="mt-1.5 text-2xl font-bold leading-tight text-white drop-shadow">
            {group.name}
          </h1>
        </div>
      </div>

      <div className="px-5 pt-16">
        <p className="text-center text-sm text-muted">
          See who&apos;s already vibing here before you jump in.
        </p>

        <h2 className="mt-10 text-sm font-bold uppercase tracking-wide text-muted">
          Featured Travelers
        </h2>
        <div className="-mx-5 mt-3 flex gap-3 overflow-x-auto px-5 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {featured.map((m) => (
            <Link
              key={m.id}
              href={`/u/${m.username}`}
              className="wc-frame w-36 shrink-0 rounded-2xl p-3 text-center"
            >
              <div className="relative mx-auto h-16 w-16">
                <span className="wc-frame wc-frame-orange relative block h-full w-full rounded-full p-1">
                  <span className="relative block h-full w-full overflow-hidden rounded-full">
                    <Image
                      src={m.avatar}
                      alt={m.name}
                      fill
                      sizes="64px"
                      className="object-cover"
                    />
                  </span>
                </span>
                {m.verified && (
                  <span className="absolute -right-0.5 -top-0.5 z-10 flex h-5 w-5 items-center justify-center rounded-full bg-glow text-[10px] text-white ring-2 ring-background">
                    ★
                  </span>
                )}
              </div>
              <p className="mt-2 font-bold">{m.name.split(" ")[0]}</p>
              <p className="mt-0.5 text-xs text-muted">{m.tagline}</p>
            </Link>
          ))}
        </div>

        <Link
          href={`/meet/${group.id}/chat`}
          className="wc-frame wc-frame-sunset mt-10 block rounded-2xl py-3.5 text-center font-bold text-white active:scale-[0.98]"
        >
          ✈️ Join the Group Chat
        </Link>

        <div className="mt-3 flex flex-col items-center gap-2">
          <Link
            href={`/meet/${group.id}/members`}
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

"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { ScreenHeader } from "@/components/ui/screen-header";
import { categoryMeta as metaFor } from "@/lib/travejor/group-meta";
import { type TravelGroup, travelGroups } from "@/lib/travejor/groups";
import { photo } from "@/lib/travejor/photo";

export function MeetList() {
  const [active, setActive] = useState<string>("All");

  const categories = useMemo(() => {
    const set = new Set(travelGroups.map((g) => g.category));
    return ["All", ...Array.from(set)];
  }, []);

  const groups = useMemo(
    () =>
      active === "All"
        ? travelGroups
        : travelGroups.filter((g) => g.category === active),
    [active],
  );

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Meet Travelers" accent />

      {/* Category filter strip */}
      <div className="-mx-0 flex gap-2 overflow-x-auto px-5 pb-1 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {categories.map((c) => {
          const isActive = c === active;
          const emoji = c === "All" ? "🌍" : metaFor(c).emoji;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setActive(c)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-bold transition active:scale-[0.97] ${
                isActive
                  ? "wc-frame wc-frame-sunset text-white"
                  : "wc-frame wc-frame-orange-white text-foreground"
              }`}
            >
              <span aria-hidden>{emoji}</span>
              {c}
            </button>
          );
        })}
      </div>

      <ul className="flex flex-col gap-4 px-5 pb-28 pt-3">
        {groups.map((group) => (
          <GroupCard key={group.id} group={group} />
        ))}
        {groups.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">
            No groups in {active} near you yet.
          </p>
        )}
      </ul>

      <Link
        href="/meet"
        aria-label="Create a group"
        className="wc-frame wc-frame-sunset fixed bottom-28 left-1/2 z-30 ml-[8.5rem] flex h-14 w-14 items-center justify-center rounded-full text-3xl font-bold text-white shadow-card active:scale-95"
      >
        +
      </Link>
    </div>
  );
}

function GroupCard({ group }: { group: TravelGroup }) {
  const meta = metaFor(group.category);
  return (
    <li className="wc-frame overflow-hidden rounded-3xl p-0">
      {/* Cover banner with overlaid title */}
      <div className="relative h-36 w-full">
        <Image
          src={group.coverImage}
          alt={group.name}
          fill
          sizes="448px"
          className="object-cover"
        />
        <span
          className={`absolute inset-0 bg-gradient-to-t ${meta.tint} via-black/20 to-transparent`}
          aria-hidden
        />
        {/* Distance — frosted pill, top-left */}
        <span className="absolute left-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">
          📍 {group.distance}
        </span>
        {/* Category — top-right */}
        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-foreground">
          {meta.emoji} {group.category}
        </span>
        {/* Title — bottom-left over the gradient */}
        <h2 className="absolute bottom-3 left-4 right-4 text-xl font-bold leading-tight text-white drop-shadow">
          {group.name}
        </h2>
      </div>

      {/* Body */}
      <div className="p-4">
        <p className="text-sm text-foreground/90">{group.description}</p>

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="flex -space-x-2">
              {group.memberSeeds.map((seed) => (
                <span
                  key={seed}
                  className="relative h-8 w-8 overflow-hidden rounded-full ring-2 ring-background"
                >
                  <Image
                    src={photo(seed, 60, 60)}
                    alt=""
                    fill
                    sizes="32px"
                    className="object-cover"
                  />
                </span>
              ))}
            </div>
            <span className="flex items-center gap-1 text-xs font-semibold text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {group.travelerCount} travelers
            </span>
          </div>
          <Link
            href={`/meet/${group.id}`}
            className="wc-frame wc-frame-sunset shrink-0 rounded-full px-5 py-2.5 text-sm font-bold text-white active:scale-[0.98]"
          >
            Join Chat ›
          </Link>
        </div>
      </div>
    </li>
  );
}

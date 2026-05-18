import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { ScreenHeader } from "@/components/ui/screen-header";
import { travelGroups } from "@/lib/travejor/groups";
import { photo } from "@/lib/travejor/photo";

export const metadata: Metadata = { title: "Meet Travelers" };

const filterAction = (
  <button
    type="button"
    aria-label="Filter groups"
    className="flex h-8 w-8 items-center justify-center text-glow"
  >
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="h-5 w-5"
    >
      <path d="M4 6h16M7 12h10M10 18h4" />
    </svg>
  </button>
);

export default function MeetPage() {
  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Meet Travelers" accent action={filterAction} />

      <ul className="flex flex-col gap-4 px-5 pb-8">
        {travelGroups.map((group) => (
          <li
            key={group.id}
            className="rounded-2xl bg-surface-elevated p-4 shadow-sm ring-1 ring-border"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="font-bold text-glow">{group.name}</h2>
                <div className="mt-1.5 flex items-center gap-2">
                  <span className="rounded-full bg-glow/15 px-2.5 py-0.5 text-xs font-medium text-glow">
                    {group.distance}
                  </span>
                  <span className="text-xs font-medium text-glow">
                    {group.category}
                  </span>
                </div>
              </div>
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full">
                <Image
                  src={group.coverImage}
                  alt={group.name}
                  fill
                  sizes="48px"
                  className="object-cover"
                />
              </div>
            </div>

            <p className="mt-2.5 text-sm text-foreground/90">
              {group.description}
            </p>

            <div className="mt-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="flex -space-x-2">
                  {group.memberSeeds.map((seed) => (
                    <span
                      key={seed}
                      className="relative h-6 w-6 overflow-hidden rounded-full ring-2 ring-surface-elevated"
                    >
                      <Image
                        src={photo(seed, 60, 60)}
                        alt=""
                        fill
                        sizes="24px"
                        className="object-cover"
                      />
                    </span>
                  ))}
                </div>
                <span className="text-xs text-muted">
                  {group.travelerCount} travelers
                </span>
              </div>
              <Link
                href={`/meet/${group.id}`}
                className="rounded-lg bg-glow px-4 py-2 text-sm font-semibold text-white"
              >
                Join Chat
              </Link>
            </div>
          </li>
        ))}
      </ul>

      <Link
        href="/meet"
        aria-label="Create group"
        className="fixed bottom-24 left-1/2 ml-[8.5rem] flex h-12 w-12 items-center
                   justify-center rounded-full bg-glow text-2xl text-white shadow-lg"
      >
        +
      </Link>
    </div>
  );
}

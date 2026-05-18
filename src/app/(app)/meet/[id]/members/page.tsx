import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { getGroup } from "@/lib/travejor/groups";
import { members } from "@/lib/travejor/members";

export const metadata: Metadata = { title: "Group Travelers" };

type Params = Promise<{ id: string }>;

export default async function GroupMembersPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const group = getGroup(id);
  if (!group) notFound();

  return (
    <div className="flex flex-1 flex-col px-5 pt-[max(3rem,calc(env(safe-area-inset-top)+2rem))]">
      <header className="flex items-center gap-3">
        <Link href={`/meet/${id}`} aria-label="Back" className="text-foreground">
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
      </header>

      <h1 className="mt-2 text-2xl font-bold text-glow">Group Travelers</h1>
      <p className="text-sm text-muted">
        See who&apos;s in this adventure with you
      </p>

      <div className="mt-5 grid grid-cols-2 gap-4 pb-8">
        {members.map((m) => (
          <Link
            key={m.id}
            href={`/u/${m.username}`}
            className="wc-frame flex flex-col items-center rounded-2xl p-5 text-center"
          >
            <div className="relative h-20 w-20">
              <Image
                src={m.avatar}
                alt={m.name}
                fill
                sizes="80px"
                className="rounded-full object-cover"
              />
            </div>
            <p className="mt-3 font-bold">{m.name.split(" ")[0]}</p>
            <p className="mt-2 flex items-center gap-1.5 text-xs italic text-muted">
              <span aria-hidden>{m.taglineIcon}</span>
              {m.tagline}
            </p>
          </Link>
        ))}
      </div>
    </div>
  );
}

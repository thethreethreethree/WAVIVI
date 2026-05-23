import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BackButton } from "@/components/ui/back-button";
import { getChatGroup, getChatGroupMembers } from "@/lib/chat";
import { flagImage } from "@/lib/travejor/account";

export const metadata: Metadata = { title: "Group Travelers" };
export const dynamic = "force-dynamic";

type Params = Promise<{ id: string }>;

export default async function GroupMembersPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const [group, members] = await Promise.all([
    getChatGroup(id),
    getChatGroupMembers(id),
  ]);
  if (!group) notFound();

  return (
    <div className="flex flex-1 flex-col px-5 pt-[max(3rem,calc(env(safe-area-inset-top)+2rem))]">
      <header className="flex items-center gap-3">
        <BackButton
          fallback={`/meet/${id}`}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-foreground/5 active:scale-95"
        />
      </header>

      <h1 className="mt-2 text-2xl font-bold text-glow">Group Travelers</h1>
      <p className="text-sm text-muted">
        {members.length} traveler{members.length === 1 ? "" : "s"} in {group.name}
      </p>

      {members.length === 0 ? (
        <p className="mt-8 rounded-2xl bg-surface/70 px-4 py-8 text-center text-sm text-muted ring-1 ring-border">
          No one&apos;s joined yet — be the first.
        </p>
      ) : (
        <div className="mt-5 grid grid-cols-2 gap-4 pb-8">
          {members.map((m) => (
            <Link
              key={m.user_id}
              href={`/u/${m.username}`}
              className="wc-frame flex flex-col items-center rounded-2xl p-5 text-center"
            >
              <div className="relative h-20 w-20">
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
                      <span className="flex h-full w-full items-center justify-center text-lg font-bold text-glow">
                        {m.display_name.slice(0, 1).toUpperCase()}
                      </span>
                    )}
                  </span>
                </span>
                {m.home_country && (
                  <span
                    className="pointer-events-none absolute -bottom-0.5 -right-0.5 z-10 block h-6 w-6 overflow-hidden rounded-full bg-white ring-2 ring-background"
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
                {m.featured && (
                  <span className="absolute -top-1 -right-1 z-10 flex h-6 w-6 items-center justify-center rounded-full bg-glow text-[11px] text-white shadow-card ring-2 ring-background">
                    ⭐
                  </span>
                )}
              </div>
              <p className="mt-3 font-bold">{m.display_name.split(" ")[0]}</p>
              <p className="mt-2 line-clamp-2 text-xs italic text-muted">
                {m.bio ?? `@${m.username}`}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ScreenHeader } from "@/components/ui/screen-header";
import { listMyChatGroups } from "@/lib/chat";
import { createClient } from "@/lib/supabase/server";
import { categoryMeta as metaFor } from "@/lib/travejor/group-meta";

export const metadata: Metadata = { title: "My Groups" };
export const dynamic = "force-dynamic";

export default async function MyGroupsPage() {
  // Gate on auth — anonymous visitors get bounced to login then back here.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/my-groups");

  const groups = await listMyChatGroups();

  return (
    <div className="flex flex-1 flex-col px-5">
      <ScreenHeader title="My Groups" accent />

      {groups.length === 0 ? (
        <div className="mt-8 flex flex-col items-center gap-4 px-5 text-center">
          <p className="text-base font-medium text-foreground">
            You haven&apos;t joined any groups yet.
          </p>
          <p className="text-sm text-muted">
            Hop into a chat with travelers heading where you are — or pick a
            destination group.
          </p>
          <Link
            href="/meet"
            className="wc-frame wc-frame-sunset mt-2 inline-block rounded-full px-5 py-2 text-sm font-bold text-white active:scale-95"
          >
            Discover groups
          </Link>
        </div>
      ) : (
        <ul className="mt-3 flex flex-col gap-3 pb-8">
          {groups.map((g) => {
            const meta = g.category ? metaFor(g.category) : null;
            return (
              <li key={g.id}>
                <Link
                  href={`/meet/${g.id}/chat`}
                  className="wc-frame relative flex items-center gap-3 rounded-2xl p-3 active:scale-[0.99]"
                >
                  {/* Group cover / category emoji avatar */}
                  <span className="relative flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-full bg-surface ring-1 ring-border">
                    {g.cover_image ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={g.cover_image}
                        alt=""
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    ) : meta ? (
                      <Image
                        src={meta.icon}
                        alt=""
                        width={52}
                        height={52}
                        className="h-7 w-7"
                        aria-hidden
                      />
                    ) : (
                      <span className="text-xl" aria-hidden>
                        💬
                      </span>
                    )}
                  </span>

                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-bold text-foreground">
                      {g.name}
                    </span>
                    <span className="block truncate text-xs text-muted">
                      {[
                        g.category,
                        g.destination_city,
                        g.member_count
                          ? `${g.member_count} traveler${g.member_count === 1 ? "" : "s"}`
                          : null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  </span>

                  <span className="text-lg text-muted">›</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

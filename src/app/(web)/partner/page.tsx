import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import type { StayRow } from "@/types/supabase";

export const dynamic = "force-dynamic";

const STAY_TYPE_LABEL: Record<string, string> = {
  hostel: "Hostel",
  hotel: "Hotel",
  guesthouse: "Guesthouse",
  resort: "Resort",
  apartment: "Apartment",
  bnb: "B&B",
  camping: "Camping",
  other: "Other",
};

/**
 * Partner landing — lists every stay the signed-in user owns via
 * `stays.claimed_by`. RLS hides everything else.
 */
export default async function PartnerHomePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  // Layout guard already redirected anonymous users; this is just to
  // narrow the type for the query below.
  if (!user) return null;

  const { data: stays } = await supabase
    .from("stays")
    .select("*")
    .eq("claimed_by", user.id)
    .order("name", { ascending: true });

  const owned = (stays ?? []) as StayRow[];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <p className="text-xs font-bold uppercase tracking-wide text-muted">
          Partner Dashboard
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          Your listings
        </h1>
        <p className="mt-1 text-sm text-muted">
          Update photos, contact info, pricing, amenities, and your
          listing&apos;s story. Wondavu admins approve any changes that
          affect ratings.
        </p>
      </header>

      {owned.length === 0 ? (
        <section className="rounded-2xl bg-surface p-6 text-center shadow-card ring-1 ring-border">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/icons/rustic/home.png"
            alt=""
            aria-hidden
            className="mx-auto h-10 w-10 object-contain"
          />
          <h2 className="mt-3 text-lg font-bold">
            No listings linked to this account yet.
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted">
            Wondavu admins assign listings to your account so you can
            self-manage them. Send your account email to your Wondavu
            admin contact — they&apos;ll link your listing within a day.
          </p>
          <p className="mx-auto mt-4 max-w-md break-all text-xs text-muted">
            Your account ID:{" "}
            <code className="font-mono text-foreground">{user.id}</code>
          </p>
        </section>
      ) : (
        <ul className="grid gap-4 sm:grid-cols-2">
          {owned.map((s) => (
            <li
              key={s.id}
              className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-border"
            >
              {s.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={s.photo_url}
                  alt={s.name}
                  className="h-36 w-full object-cover"
                />
              ) : (
                <div className="flex h-36 w-full items-center justify-center bg-background">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src="/icons/rustic/home.png"
                    alt=""
                    aria-hidden
                    className="h-14 w-14 object-contain opacity-70"
                  />
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-base font-bold">
                      {s.name}
                    </h2>
                    <p className="truncate text-xs text-muted">
                      {STAY_TYPE_LABEL[s.stay_type] ?? s.stay_type}
                      {s.address ? ` · ${s.address}` : ""}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-full bg-cool/15 px-2 py-0.5 text-[10px] font-bold text-cool">
                    Claimed
                  </span>
                </div>

                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted">
                  <span className="font-bold text-foreground">
                    🎒 {s.backpack_rating.toFixed(1)}
                  </span>
                  {s.rating != null && (
                    <span className="font-bold text-foreground">
                      ★ {s.rating}
                    </span>
                  )}
                  <span>
                    👍 {s.thumbs_up} · 👎 {s.thumbs_down}
                  </span>
                </div>

                <Link
                  href={`/partner/stays/${s.id}`}
                  className="mt-3 inline-flex rounded-full bg-sunset px-4 py-2 text-xs font-bold text-white"
                >
                  Manage listing ›
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

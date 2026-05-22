import Link from "next/link";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Partners admin — hub page for everything a partner-facing listing can
 * power: Stays (live), Experiences (coming), Events (coming). Mirrors
 * the Toolbox admin landing pattern with a card grid + live counts.
 */
export default async function PartnersAdminPage() {
  const supabase = await createClient();

  // Live counts across all four partner surfaces.
  const [staysC, expC, eventsC, eatC] = await Promise.all([
    supabase.from("stays").select("*", { count: "exact", head: true }),
    supabase.from("experiences").select("*", { count: "exact", head: true }),
    supabase.from("events").select("*", { count: "exact", head: true }),
    supabase.from("restaurants").select("*", { count: "exact", head: true }),
  ]);

  const dashboards = [
    {
      slug: "stays",
      title: "Stays",
      blurb: "Hostels, hotels, guesthouses, resorts — partner lodging.",
      href: "/admin/stays",
      status: "live" as const,
      count: staysC.count ?? 0,
      countLabel: "stays",
      icon: "🏠",
    },
    {
      slug: "experiences",
      title: "Experiences",
      blurb: "Tours, dives, kayak rentals, viewpoints — what to do.",
      href: "/admin/experiences",
      status: "live" as const,
      count: expC.count ?? 0,
      countLabel: "experiences",
      icon: "🌊",
    },
    {
      slug: "events",
      title: "Events",
      blurb: "Pub crawls, meetups, parties, concerts.",
      href: "/admin/events",
      status: "live" as const,
      count: eventsC.count ?? 0,
      countLabel: "events",
      icon: "🎉",
    },
    {
      slug: "eat",
      title: "Where to Eat",
      blurb: "Restaurants, cafes, bars — places to eat (in-app for now).",
      href: "/admin/eat",
      status: "live" as const,
      count: eatC.count ?? 0,
      countLabel: "restaurants",
      icon: "🍜",
    },
  ] as const;

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            Travejor Admin
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            Partners
          </h1>
          <p className="mt-1 text-sm text-muted">
            Manage every partner-facing listing in one place — stays,
            experiences, and events.
          </p>
        </div>
        <Link
          href="/admin/toolbox"
          className="rounded-full bg-foreground/10 px-4 py-2 text-sm font-bold text-foreground hover:bg-foreground/15"
        >
          ← Toolbox admin
        </Link>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {dashboards.map((d) => (
          <Link
            key={d.slug}
            href={d.href}
            className="group flex flex-col gap-3 rounded-2xl bg-surface p-5 shadow-card ring-1 ring-border transition-colors hover:ring-glow/50"
          >
            <div className="flex items-center justify-between">
              <span className="text-3xl" aria-hidden>
                {d.icon}
              </span>
              <span
                className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                  d.status === "live"
                    ? "bg-cool/15 text-cool"
                    : "bg-glow/15 text-glow"
                }`}
              >
                {d.status === "live" ? "Live" : "Coming soon"}
              </span>
            </div>
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-bold">{d.title}</h2>
              <p className="mt-1 text-sm text-muted">{d.blurb}</p>
            </div>
            <div className="flex items-center justify-between border-t border-border pt-3">
              {d.count !== null ? (
                <span className="text-xs font-bold text-foreground">
                  {d.count} {d.countLabel}
                </span>
              ) : (
                <span className="text-xs text-muted">—</span>
              )}
              <span className="text-sm font-bold text-glow transition-transform group-hover:translate-x-0.5">
                Open ›
              </span>
            </div>
          </Link>
        ))}
      </section>

      <section className="mt-10">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
          About the partner system
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-muted">
          Each listing carries a <code>claimed_by</code> column that lets a
          verified partner self-manage their content from a future partner
          dashboard. Until that ships, admins curate everything here:
          import via CSV, manually add new listings, and tune ratings or
          contact info inline.
        </p>
      </section>
    </div>
  );
}

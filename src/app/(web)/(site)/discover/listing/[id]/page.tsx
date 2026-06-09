import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { ListingCard } from "@/components/web/listing-card";
import { ListingReactions } from "@/components/web/listing-reactions";
import { allListings, getListingDetail } from "@/lib/web/listings";

type Params = Promise<{ id: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  const listing = getListingDetail(id);
  return { title: listing ? listing.title : "Listing" };
}

const CATEGORY_BACK = {
  stays: { href: "/discover/stays", label: "Where to Stay" },
  experiences: { href: "/discover/experiences", label: "What to Do" },
  events: { href: "/discover/events", label: "Events Nearby" },
};

export default async function ListingDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const listing = getListingDetail(id);
  if (!listing) notFound();

  const back = CATEGORY_BACK[listing.kind];
  const others = allListings().filter((l) => l.id !== listing.id);
  const alsoLiked = others.filter((l) => l.kind === listing.kind).slice(0, 3);
  const nearby = others.slice(0, 3);

  return (
    <article className="mx-auto max-w-6xl px-5 py-8">
      {/* Breadcrumb + share */}
      <div className="flex items-center justify-between">
        <nav className="text-sm text-muted">
          <Link href={back.href} className="hover:text-foreground">
            {back.label}
          </Link>
          <span className="mx-1.5">/</span>
          <span className="text-foreground">{listing.title}</span>
        </nav>
        <button
          type="button"
          className="glass rounded-full px-3.5 py-1.5 text-xs font-bold text-foreground"
        >
          ↗ Share
        </button>
      </div>

      {/* Hero */}
      <div className="relative mt-4 aspect-[16/7] w-full overflow-hidden rounded-3xl">
        <Image
          src={listing.image}
          alt={listing.title}
          fill
          priority
          sizes="(max-width: 1152px) 100vw, 1152px"
          className="object-cover"
        />
        {listing.badge && (
          <span className="absolute left-4 top-4 rounded-full bg-glow px-3 py-1.5 text-xs font-bold text-white">
            {listing.badge}
          </span>
        )}
      </div>

      <div className="mt-7 grid gap-8 lg:grid-cols-[1fr_330px]">
        {/* Main column */}
        <div className="flex flex-col gap-8">
          <header>
            <span className="text-xs font-bold uppercase tracking-wide text-glow">
              {listing.category}
            </span>
            <h1 className="mt-1 text-3xl font-bold tracking-tight">
              {listing.title}
            </h1>
            <p className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
              <span className="font-bold text-foreground">
                <span className="text-glow">★</span> {listing.rating.toFixed(1)}
              </span>
              <span className="inline-flex items-center gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/icons/rustic/01_chat_bubble.png"
                  alt=""
                  aria-hidden
                  className="h-3.5 w-3.5 object-contain"
                />
                {listing.reviews.toLocaleString()} reviews
              </span>
              <span className="inline-flex items-center gap-1">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src="/icons/rustic/01_map_pin.png"
                  alt=""
                  aria-hidden
                  className="h-3.5 w-3.5 object-contain"
                />
                {listing.location}
              </span>
            </p>
            <div className="mt-3 flex flex-wrap gap-1.5">
              {listing.tags.map((t) => (
                <span
                  key={t}
                  className="rounded-full bg-surface px-2.5 py-0.5 text-xs font-medium text-muted ring-1 ring-border"
                >
                  {t}
                </span>
              ))}
            </div>
          </header>

          <section>
            <h2 className="text-lg font-bold">About</h2>
            <p className="mt-2 leading-7 text-foreground/90">
              {listing.description}
            </p>
          </section>

          <section>
            <ListingReactions />
          </section>

          <section>
            <h2 className="text-lg font-bold">Highlights</h2>
            <ul className="mt-3 grid gap-2 sm:grid-cols-2">
              {listing.highlights.map((h) => (
                <li
                  key={h}
                  className="glass flex items-center gap-2 rounded-xl px-3.5 py-2.5 text-sm"
                >
                  <span className="text-cool">✓</span>
                  {h}
                </li>
              ))}
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold">Gallery</h2>
            <div className="mt-3 grid grid-cols-3 gap-3">
              {listing.gallery.map((src, i) => (
                <div
                  key={i}
                  className="relative aspect-square overflow-hidden rounded-xl"
                >
                  <Image
                    src={src}
                    alt=""
                    fill
                    sizes="240px"
                    className="object-cover"
                  />
                </div>
              ))}
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold">Location</h2>
            <div className="grid-overlay glass mt-3 flex h-44 items-center justify-center rounded-2xl">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-sunset text-white shadow-[0_0_0_8px_rgba(255,122,24,0.18)]">
                📍
              </span>
            </div>
            <div className="mt-3 flex items-center justify-between gap-3">
              <p className="text-sm text-muted">{listing.location}</p>
              <button
                type="button"
                className="glass rounded-full px-4 py-2 text-xs font-bold text-foreground"
              >
                Get Directions
              </button>
            </div>
          </section>
        </div>

        {/* Sidebar */}
        <aside className="lg:sticky lg:top-24 lg:self-start">
          <div className="glass-strong rounded-2xl p-5 shadow-card">
            <p className="text-sm font-semibold">Plan it with Wondavu</p>
            <p className="mt-1 text-xs text-muted">
              See live traveler activity, vibe, and who&apos;s going — right
              inside the app.
            </p>
            <Link
              href="/?app=1"
              className="mt-4 block rounded-xl bg-sunset py-3 text-center font-bold text-white"
            >
              Open in the Wondavu app
            </Link>
            <button
              type="button"
              className="mt-2 block w-full rounded-xl border border-border py-3 text-center font-bold text-muted"
            >
              {listing.kind === "events" ? "RSVP" : "Request to book"}
            </button>
            <p className="mt-3 text-center text-[11px] text-muted">
              ✓ Verified Wondavu partner
            </p>
          </div>
        </aside>
      </div>

      {/* Travelers also liked */}
      <section className="mt-12">
        <h2 className="text-xl font-bold tracking-tight">
          Travelers who saved this also liked
        </h2>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {alsoLiked.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      </section>

      {/* Nearby */}
      <section className="mt-10">
        <div className="flex items-end justify-between">
          <h2 className="text-xl font-bold tracking-tight">Nearby on Wondavu</h2>
          <Link href="/discover" className="text-sm font-semibold text-glow">
            Browse all
          </Link>
        </div>
        <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {nearby.map((l) => (
            <ListingCard key={l.id} listing={l} />
          ))}
        </div>
      </section>
    </article>
  );
}

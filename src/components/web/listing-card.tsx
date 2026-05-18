import Image from "next/image";
import Link from "next/link";

import type { WebListing } from "@/lib/web/listings";

const KIND_LABEL: Record<string, string> = {
  stays: "Stay",
  experiences: "Experience",
  events: "Event",
};

/** A listing tile for the Travejor webapp directory grid. */
export function ListingCard({ listing }: { listing: WebListing }) {
  return (
    <Link
      href={listing.href}
      className="group flex flex-col overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-border transition-transform hover:-translate-y-1"
    >
      <div className="relative aspect-[4/3] w-full">
        <Image
          src={listing.image}
          alt={listing.title}
          fill
          sizes="(max-width: 768px) 100vw, 340px"
          className="object-cover transition-transform group-hover:scale-105"
        />
        <span className="absolute left-3 top-3 rounded-full bg-background/90 px-2 py-0.5 text-[11px] font-bold text-foreground backdrop-blur">
          {KIND_LABEL[listing.kind]}
        </span>
        {listing.badge && (
          <span className="absolute right-3 top-3 rounded-full bg-glow px-2.5 py-1 text-[11px] font-bold text-white">
            {listing.badge}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="min-w-0 flex-1 truncate font-bold">{listing.title}</h3>
          <span className="flex shrink-0 items-center gap-1 text-sm font-bold">
            <span className="text-glow">★</span>
            {listing.rating.toFixed(1)}
          </span>
        </div>

        <p className="mt-0.5 truncate text-sm text-muted">
          {listing.category}
        </p>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted">
          <span aria-hidden>📍</span>
          {listing.location}
          <span className="mx-1">·</span>
          <span aria-hidden>💬</span>
          {listing.reviews.toLocaleString()}
        </p>

        <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
          {listing.tags.map((t) => (
            <span
              key={t}
              className="rounded-full bg-surface-elevated px-2 py-0.5 text-[11px] font-medium text-muted ring-1 ring-border"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

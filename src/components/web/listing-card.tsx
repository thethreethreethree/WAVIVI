import Image from "next/image";
import Link from "next/link";

import type { WebListing } from "@/lib/web/listings";

const KIND_LABEL: Record<string, string> = {
  stays: "Stay",
  experiences: "Experience",
  events: "Event",
};

/** Cinematic glass listing tile for the Wondavu webapp directory. */
export function ListingCard({ listing }: { listing: WebListing }) {
  return (
    <Link
      href={listing.href}
      className="glass glow-hover group flex flex-col overflow-hidden rounded-3xl"
    >
      <div className="relative aspect-[4/3] w-full overflow-hidden">
        <Image
          src={listing.image}
          alt={listing.title}
          fill
          sizes="(max-width: 768px) 100vw, 340px"
          className="object-cover transition-transform duration-500 group-hover:scale-110"
        />
        <span className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
        <span className="glass absolute left-3 top-3 rounded-full px-2.5 py-0.5 text-[11px] font-bold text-white">
          {KIND_LABEL[listing.kind]}
        </span>
        {listing.badge && (
          <span className="absolute right-3 top-3 rounded-full bg-sunset px-2.5 py-1 text-[11px] font-bold text-white shadow-[0_6px_18px_-6px_rgba(255,122,24,0.8)]">
            {listing.badge}
          </span>
        )}
        <span className="absolute bottom-3 left-3 flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-bold text-white backdrop-blur">
          <span className="text-glow">★</span>
          {listing.rating.toFixed(1)}
          <span className="font-medium text-white/70">
            ({listing.reviews.toLocaleString()})
          </span>
        </span>
      </div>

      <div className="flex flex-1 flex-col p-4">
        <h3 className="truncate text-base font-bold transition-colors group-hover:text-glow">
          {listing.title}
        </h3>
        <p className="mt-0.5 truncate text-sm text-muted">
          {listing.category}
        </p>
        <p className="mt-1 flex items-center gap-1 text-xs text-muted">
          <span aria-hidden>📍</span>
          {listing.location}
        </p>

        <div className="mt-auto flex flex-wrap gap-1.5 pt-3">
          {listing.tags.map((t) => (
            <span
              key={t}
              className="rounded-full border border-border bg-surface-elevated px-2 py-0.5 text-[11px] font-medium text-muted"
            >
              {t}
            </span>
          ))}
        </div>
      </div>
    </Link>
  );
}

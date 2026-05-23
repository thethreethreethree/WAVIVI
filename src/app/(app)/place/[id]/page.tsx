import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Rating } from "@/components/ui/rating";
import { getPlace } from "@/lib/travejor/places";
import { photo } from "@/lib/travejor/photo";

type Params = Promise<{ id: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  const place = getPlace(id);
  return { title: place ? place.name : "Place" };
}

function vibeLabel(v: number): { text: string; cls: string } {
  if (v >= 80) return { text: "Buzzing", cls: "text-heat" };
  if (v >= 60) return { text: "Social", cls: "text-glow" };
  return { text: "Chill", cls: "text-cool" };
}

export default async function PlaceDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const place = getPlace(id);
  if (!place) notFound();

  const vibe = vibeLabel(place.vibe);
  const back =
    place.kind === "eat" ? "/eat" : place.kind === "stay" ? "/stay" : "/todo";

  return (
    <div className="flex flex-1 flex-col">
      <div className="wc-frame relative h-60 w-full rounded-2xl p-2">
        <span className="relative block h-full w-full overflow-hidden rounded-xl">
          <Image
            src={place.image}
            alt={place.name}
            fill
            sizes="448px"
            className="object-cover"
            priority
          />
          <span className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        </span>
        <Link
          href={back}
          aria-label="Back"
          className="absolute left-4 top-4 flex h-9 w-9 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur"
        >
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
        {place.recommended && (
          <span className="absolute right-4 top-4 rounded-full bg-glow px-2.5 py-1 text-[11px] font-bold text-white">
            ✓ Traveler Favourite
          </span>
        )}
      </div>

      <div className="flex flex-col gap-5 px-5 py-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{place.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {place.category} · {place.distance}
          </p>
          <div className="mt-2 flex items-center gap-3">
            <Rating value={place.rating} favourite={place.recommended} />
            {place.kind === "eat" && (
              <span
                className={`rounded-full px-2 py-0.5 text-[11px] font-semibold text-white ${
                  place.open ? "bg-cool" : "bg-heat"
                }`}
              >
                {place.open ? "Open now" : "Closed"}
              </span>
            )}
          </div>
        </div>

        {/* Folded-in Wondavu vibe reading */}
        <div className="wc-frame rounded-2xl p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold">Live vibe</p>
            <span className={`text-sm font-bold ${vibe.cls}`}>
              🔥 {vibe.text}
            </span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-border">
            <div
              className="h-full rounded-full bg-glow"
              style={{ width: `${place.vibe}%` }}
            />
          </div>
          <div className="mt-3 flex items-center gap-2">
            <div className="flex -space-x-2">
              {["p1", "p2", "p3"].map((s) => (
                <span key={s} className="wc-frame relative h-8 w-8 rounded-full p-1">
                  <span className="relative block h-full w-full overflow-hidden rounded-full">
                    <Image
                      src={photo(`pl-${place.id}-${s}`, 56, 56)}
                      alt=""
                      fill
                      sizes="28px"
                      className="object-cover"
                    />
                  </span>
                </span>
              ))}
            </div>
            <span className="text-xs text-muted">
              travelers are here right now
            </span>
          </div>
        </div>

        <p className="text-sm leading-6 text-foreground/90">
          A traveler-favourite spot near you. Real reviews, real people, and a
          live read on how social it is before you head over.
        </p>

        <div className="flex gap-2">
          <Link
            href="/map"
            className="flex-1 rounded-2xl bg-sunset py-3 text-center font-bold text-white shadow-card active:scale-[0.98]"
          >
            Get Directions
          </Link>
          <Link
            href="/susen"
            className="rounded-2xl border border-glow px-5 py-3 text-center font-bold text-glow"
          >
            Ask Susen
          </Link>
        </div>
      </div>
    </div>
  );
}

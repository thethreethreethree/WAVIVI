import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { Rating } from "@/components/ui/rating";
import { createClient } from "@/lib/supabase/server";
import type { StayRow, StayType } from "@/types/supabase";

type Params = Promise<{ id: string }>;

const STAY_TYPE_LABEL: Record<StayType, string> = {
  hostel: "Hostel",
  hotel: "Hotel",
  guesthouse: "Guesthouse",
  resort: "Resort",
  apartment: "Apartment",
  bnb: "B&B",
  camping: "Camping",
  other: "Stay",
};

export const dynamic = "force-dynamic";

async function fetchStay(id: string): Promise<StayRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("stays")
    .select("*")
    .eq("id", id)
    .eq("active", true)
    .maybeSingle();
  return (data as StayRow | null) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  const stay = await fetchStay(id);
  return { title: stay?.name ?? "Stay" };
}

export default async function StayDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const stay = await fetchStay(id);
  if (!stay) notFound();

  const recommended = stay.backpack_rating >= 4;

  return (
    <div className="flex flex-1 flex-col">
      <div className="wc-frame relative h-60 w-full rounded-2xl p-2">
        <span className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-xl bg-background">
          {stay.photo_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={stay.photo_url}
              alt={stay.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <span className="text-5xl" aria-hidden>
              🏠
            </span>
          )}
          <span className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
        </span>
        <Link
          href="/stay"
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
        {recommended && (
          <span className="absolute right-4 top-4 rounded-full bg-glow px-2.5 py-1 text-[11px] font-bold text-white">
            ✓ Backpacker Pick
          </span>
        )}
      </div>

      <div className="flex flex-col gap-5 px-5 py-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{stay.name}</h1>
          <p className="mt-1 text-sm text-muted">
            {STAY_TYPE_LABEL[stay.stay_type] ?? "Stay"}
            {stay.address ? ` · ${stay.address}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Rating
              value={stay.rating ?? stay.backpack_rating}
              favourite={recommended}
            />
            <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[11px] font-semibold">
              🎒 {stay.backpack_rating.toFixed(1)}
            </span>
            {stay.price_per_night_usd != null && (
              <span className="rounded-full bg-cool/15 px-2 py-0.5 text-[11px] font-semibold text-cool">
                ${stay.price_per_night_usd}/night
              </span>
            )}
          </div>
        </div>

        {stay.description && (
          <p className="text-sm leading-6 text-foreground/90">
            {stay.description}
          </p>
        )}

        {stay.amenities.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {stay.amenities.map((a) => (
              <span
                key={a}
                className="rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-foreground ring-1 ring-border"
              >
                {a}
              </span>
            ))}
          </div>
        )}

        {(stay.check_in_time || stay.check_out_time) && (
          <p className="text-xs text-muted">
            {stay.check_in_time && <>Check-in {stay.check_in_time}</>}
            {stay.check_in_time && stay.check_out_time && " · "}
            {stay.check_out_time && <>Check-out {stay.check_out_time}</>}
          </p>
        )}

        <div className="flex flex-wrap gap-2">
          <a
            href={`https://www.google.com/maps/dir/?api=1&destination=${stay.latitude},${stay.longitude}&destination_place_id=${encodeURIComponent(stay.name)}&travelmode=driving`}
            target="_blank"
            rel="noreferrer"
            className="flex-1 rounded-2xl bg-sunset py-3 text-center font-bold text-white shadow-card active:scale-[0.98]"
          >
            Get Directions
          </a>
          {stay.website && (
            <a
              href={stay.website}
              target="_blank"
              rel="noreferrer"
              className="rounded-2xl border border-glow px-5 py-3 text-center font-bold text-glow"
            >
              Website
            </a>
          )}
        </div>

        {(stay.phone || stay.whatsapp || stay.email || stay.instagram) && (
          <div className="wc-frame flex flex-col gap-2 rounded-2xl p-4 text-sm">
            {stay.phone && <p>📞 {stay.phone}</p>}
            {stay.whatsapp && <p>💬 WhatsApp: {stay.whatsapp}</p>}
            {stay.email && (
              <p>
                ✉️{" "}
                <a className="underline" href={`mailto:${stay.email}`}>
                  {stay.email}
                </a>
              </p>
            )}
            {stay.instagram && <p>📷 {stay.instagram}</p>}
          </div>
        )}
      </div>
    </div>
  );
}

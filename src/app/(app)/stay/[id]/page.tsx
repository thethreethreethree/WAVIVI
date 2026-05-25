import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BackButton } from "@/components/ui/back-button";
import { Rating } from "@/components/ui/rating";
import { StayPhotoGallery } from "@/components/ui/stay-photo-gallery";
import { BackpackerPickButton } from "@/features/stays/backpacker-pick-button";
import { SaveToPlanButton } from "@/features/where-to-next/save-to-plan-button";
import { amenityIconPath } from "@/lib/stays/csv-import";
import { createClient } from "@/lib/supabase/server";
import { flagImage } from "@/lib/travejor/account";
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

function whatsappHref(
  whatsapp: string | null,
  phone: string | null,
): string | null {
  const raw = whatsapp?.trim() || phone?.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  // Strip everything but digits — wa.me only accepts an international number.
  const digits = raw.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}

function instagramHref(value: string | null): string | null {
  const v = value?.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  const handle = v.replace(/^@/, "").trim();
  return handle ? `https://instagram.com/${handle}` : null;
}

function facebookHref(value: string | null): string | null {
  const v = value?.trim();
  if (!v) return null;
  if (/^https?:\/\//i.test(v)) return v;
  return `https://facebook.com/${v.replace(/^@/, "")}`;
}

function websiteHref(value: string | null): string | null {
  const v = value?.trim();
  if (!v) return null;
  return /^https?:\/\//i.test(v) ? v : `https://${v}`;
}

function ContactButton({
  label,
  emoji,
  href,
}: {
  label: string;
  emoji: string;
  href: string | null;
}) {
  const base =
    "flex flex-col items-center gap-1 rounded-2xl py-2.5 text-[11px] font-bold transition-colors";
  if (!href) {
    return (
      <span
        aria-disabled
        className={`${base} cursor-not-allowed bg-surface text-muted opacity-50 ring-1 ring-border`}
        title={`${label} not available`}
      >
        <span className="text-base grayscale" aria-hidden>
          {emoji}
        </span>
        {label}
      </span>
    );
  }
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className={`${base} bg-surface text-foreground ring-1 ring-border hover:bg-foreground/5`}
    >
      <span className="text-base" aria-hidden>
        {emoji}
      </span>
      {label}
    </a>
  );
}

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

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  let voted = false;
  if (user) {
    const { data: v } = await supabase
      .from("stay_votes")
      .select("voter_id")
      .eq("stay_id", stay.id)
      .eq("voter_id", user.id)
      .maybeSingle();
    voted = Boolean(v);
  }

  // Latest 3 travelers who picked this stay → avatar stack
  const { data: voteRows } = await supabase
    .from("stay_votes")
    .select("voter_id, created_at")
    .eq("stay_id", stay.id)
    .order("created_at", { ascending: false })
    .limit(3);
  const voterIds = (voteRows ?? []).map((r) => r.voter_id);
  type PickerProfile = {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    home_country: string | null;
  };
  let pickers: PickerProfile[] = [];
  if (voterIds.length > 0) {
    const { data: profs } = await supabase
      .from("profiles")
      .select("id, username, display_name, avatar_url, home_country")
      .in("id", voterIds);
    const byId = new Map(((profs ?? []) as PickerProfile[]).map((p) => [p.id, p]));
    pickers = voterIds
      .map((id) => byId.get(id))
      .filter((p): p is PickerProfile => Boolean(p));
  }
  const overflow = Math.max(0, stay.thumbs_up - pickers.length);

  return (
    <div className="flex flex-1 flex-col pt-[max(2.5rem,calc(env(safe-area-inset-top)+1.5rem))]">
      <div className="wc-frame relative h-60 w-full rounded-2xl p-2">
        <span className="relative block h-full w-full overflow-hidden rounded-xl">
          {/* Build a deduped photo set: hero cover first, then the IG gallery
              loaded by the CSV import. When there's only one image the
              gallery component falls back to a static StayPhoto. */}
          <StayPhotoGallery
            photos={Array.from(
              new Set(
                [stay.photo_url, ...(stay.photo_urls ?? [])].filter(
                  (u): u is string => Boolean(u),
                ),
              ),
            )}
            alt={stay.name}
            emojiSize="text-5xl"
          />
          <span className="pointer-events-none absolute inset-0 z-10 bg-gradient-to-t from-black/45 to-transparent" />
        </span>
        <BackButton fallback="/stay" className="absolute left-4 top-4" />
        {stay.thumbs_up > 0 && (
          <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-glow px-2.5 py-1 text-[11px] font-bold text-white shadow-card">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/icons/orange/thumbs_up_orange.png"
              alt=""
              aria-hidden
              className="h-3.5 w-3.5 object-contain"
            />
            Backpacker Pick · {stay.thumbs_up}
          </span>
        )}
        {stay.amenities.length > 0 && (
          <div className="absolute inset-x-3 bottom-3 z-10 flex gap-2 overflow-x-auto rounded-xl bg-black/45 px-2.5 py-2 backdrop-blur [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {stay.amenities.map((a) => {
              const icon = amenityIconPath(a);
              return (
                <span
                  key={a}
                  title={a}
                  className="inline-flex shrink-0 items-center gap-1 rounded-full bg-white/15 px-2 py-1 text-[10px] font-bold text-white"
                >
                  {icon ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={icon}
                      alt=""
                      aria-hidden
                      className="h-4 w-4 object-contain"
                    />
                  ) : null}
                  {a}
                </span>
              );
            })}
          </div>
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
            <Rating value={stay.rating ?? stay.backpack_rating} />
            {stay.review_count > 0 && (
              <span className="text-xs text-muted">
                ({stay.review_count.toLocaleString()} review
                {stay.review_count === 1 ? "" : "s"})
              </span>
            )}
            <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-[11px] font-semibold">
              🎒 {stay.backpack_rating.toFixed(1)}
            </span>
            {stay.price_per_night_usd != null && (
              <span className="rounded-full bg-cool/15 px-2 py-0.5 text-[11px] font-semibold text-cool">
                ${stay.price_per_night_usd}/night
              </span>
            )}
          </div>
          {pickers.length > 0 && (
            <div className="mt-3 flex items-center gap-2">
              <span className="text-[11px] font-semibold text-muted">
                Picked by
              </span>
              <div className="flex -space-x-2">
                {pickers.map((p) => (
                  <div key={p.id} className="relative h-10 w-10">
                    <Link
                      href={`/u/${p.username}`}
                      title={p.display_name}
                      className="block h-full w-full overflow-hidden rounded-full bg-surface ring-2 ring-background"
                    >
                      {p.avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={p.avatar_url}
                          alt={p.display_name}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-sm font-bold text-glow">
                          {p.display_name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </Link>
                    {p.home_country && (
                      <span
                        className="pointer-events-none absolute -bottom-0.5 -right-0.5 block h-4 w-4 overflow-hidden rounded-full bg-white ring-2 ring-background"
                        title={p.home_country}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src={flagImage(p.home_country)}
                          alt={p.home_country}
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      </span>
                    )}
                  </div>
                ))}
                {overflow > 0 && (
                  <span className="relative z-10 inline-flex h-10 min-w-[2.5rem] items-center justify-center rounded-full bg-glow px-1 text-xs font-bold text-white ring-2 ring-background">
                    +{overflow}
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        {stay.description && (
          <p className="text-sm leading-6 text-foreground/90">
            {stay.description}
          </p>
        )}


        {(stay.check_in_time || stay.check_out_time) && (
          <p className="text-xs text-muted">
            {stay.check_in_time && <>Check-in {stay.check_in_time}</>}
            {stay.check_in_time && stay.check_out_time && " · "}
            {stay.check_out_time && <>Check-out {stay.check_out_time}</>}
          </p>
        )}

        <Link
          href={`/nav?lat=${stay.latitude}&lng=${stay.longitude}&name=${encodeURIComponent(stay.name)}`}
          className="rounded-2xl bg-sunset py-3 text-center font-bold text-white shadow-card active:scale-[0.98]"
        >
          Get Directions
        </Link>

        <BackpackerPickButton
          stayId={stay.id}
          initialVoted={voted}
          initialCount={stay.thumbs_up}
          signedIn={Boolean(user)}
        />

        {user && (
          <div className="flex justify-center">
            <SaveToPlanButton
              list="saved_hotels"
              item={{
                externalId: stay.id,
                name: stay.name,
                city: stay.address,
                notes: null,
              }}
              label="Save to my trip"
            />
          </div>
        )}

        <div className="grid grid-cols-4 gap-2">
          <ContactButton
            label="WhatsApp"
            emoji="💬"
            href={whatsappHref(stay.whatsapp, stay.phone)}
          />
          <ContactButton
            label="Instagram"
            emoji="📷"
            href={instagramHref(stay.instagram)}
          />
          <ContactButton
            label="Facebook"
            emoji="📘"
            href={facebookHref(stay.facebook)}
          />
          <ContactButton
            label="Website"
            emoji="🌐"
            href={websiteHref(stay.website)}
          />
        </div>

        {(stay.phone || stay.email) && (
          <div className="wc-frame flex flex-col gap-2 rounded-2xl p-4 text-sm">
            {stay.phone && (
              <p>
                📞{" "}
                <a className="underline" href={`tel:${stay.phone}`}>
                  {stay.phone}
                </a>
              </p>
            )}
            {stay.email && (
              <p>
                ✉️{" "}
                <a className="underline" href={`mailto:${stay.email}`}>
                  {stay.email}
                </a>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

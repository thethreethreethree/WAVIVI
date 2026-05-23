import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { BackButton } from "@/components/ui/back-button";
import { Rating } from "@/components/ui/rating";
import { StayPhoto } from "@/components/ui/stay-photo";
import { SaveToPlanButton } from "@/features/where-to-next/save-to-plan-button";
import { amenityIconPath } from "@/lib/stays/csv-import";
import { createClient } from "@/lib/supabase/server";
import type { ExperienceRow } from "@/types/supabase";

type Params = Promise<{ id: string }>;

export const dynamic = "force-dynamic";

async function fetchExperience(id: string): Promise<ExperienceRow | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("experiences")
    .select("*")
    .eq("id", id)
    .eq("active", true)
    .maybeSingle();
  return (data as ExperienceRow | null) ?? null;
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { id } = await params;
  const exp = await fetchExperience(id);
  return { title: exp?.name ?? "Activity" };
}

function whatsappHref(whatsapp: string | null, phone: string | null) {
  const raw = whatsapp?.trim() || phone?.trim();
  if (!raw) return null;
  if (/^https?:\/\//i.test(raw)) return raw;
  const digits = raw.replace(/\D/g, "");
  return digits ? `https://wa.me/${digits}` : null;
}
function instagramHref(v: string | null) {
  const s = v?.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://instagram.com/${s.replace(/^@/, "")}`;
}
function facebookHref(v: string | null) {
  const s = v?.trim();
  if (!s) return null;
  if (/^https?:\/\//i.test(s)) return s;
  return `https://facebook.com/${s.replace(/^@/, "")}`;
}
function websiteHref(v: string | null) {
  const s = v?.trim();
  if (!s) return null;
  return /^https?:\/\//i.test(s) ? s : `https://${s}`;
}

export default async function ExperienceDetailPage({
  params,
}: {
  params: Params;
}) {
  const { id } = await params;
  const exp = await fetchExperience(id);
  if (!exp) notFound();

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <div className="flex flex-1 flex-col pt-[max(2.5rem,calc(env(safe-area-inset-top)+1.5rem))]">
      <div className="wc-frame relative h-60 w-full rounded-2xl p-2">
        <span className="relative block h-full w-full overflow-hidden rounded-xl">
          <StayPhoto src={exp.photo_url} alt={exp.name} emojiSize="text-5xl" />
          <span className="absolute inset-0 bg-gradient-to-t from-black/45 to-transparent" />
        </span>
        <BackButton
          fallback="/todo"
          className="absolute left-4 top-4 flex h-11 w-11 items-center justify-center rounded-full bg-black/45 text-white backdrop-blur transition-transform active:scale-95"
        />
      </div>

      <div className="flex flex-col gap-5 px-5 py-5">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{exp.name}</h1>
          {exp.activity_type && (
            <p className="mt-1 text-sm text-muted">
              {exp.activity_type}
              {exp.address ? ` · ${exp.address}` : ""}
            </p>
          )}
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <Rating value={exp.rating ?? exp.backpack_rating} />
            {exp.review_count > 0 && (
              <span className="text-xs text-muted">
                ({exp.review_count.toLocaleString()} review
                {exp.review_count === 1 ? "" : "s"})
              </span>
            )}
          </div>
        </div>

        {exp.description && (
          <p className="text-sm leading-6 text-foreground/90">
            {exp.description}
          </p>
        )}

        {exp.amenities.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {exp.amenities.map((a) => {
              const icon = amenityIconPath(a);
              return (
                <span
                  key={a}
                  className="inline-flex items-center gap-1.5 rounded-full bg-surface px-2.5 py-1 text-[11px] font-semibold text-foreground ring-1 ring-border"
                >
                  {icon && (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={icon}
                      alt=""
                      aria-hidden
                      className="h-4 w-4 object-contain"
                    />
                  )}
                  {a}
                </span>
              );
            })}
          </div>
        )}

        <a
          href={`https://www.google.com/maps/dir/?api=1&destination=${exp.latitude},${exp.longitude}&destination_place_id=${encodeURIComponent(exp.name)}&travelmode=driving&dir_action=navigate`}
          target="_blank"
          rel="noreferrer"
          className="rounded-2xl bg-sunset py-3 text-center font-bold text-white shadow-card active:scale-[0.98]"
        >
          Get Directions
        </a>

        {user && (
          <div className="flex justify-center">
            <SaveToPlanButton
              list="saved_activities"
              item={{
                externalId: exp.id,
                name: exp.name,
                city: exp.address,
                notes: null,
              }}
              label="Save to my trip"
            />
          </div>
        )}

        <div className="grid grid-cols-4 gap-2">
          <ContactTile
            label="WhatsApp"
            emoji="💬"
            href={whatsappHref(exp.whatsapp, exp.phone)}
          />
          <ContactTile
            label="Instagram"
            emoji="📷"
            href={instagramHref(exp.instagram)}
          />
          <ContactTile
            label="Facebook"
            emoji="📘"
            href={facebookHref(exp.facebook)}
          />
          <ContactTile
            label="Website"
            emoji="🌐"
            href={websiteHref(exp.website)}
          />
        </div>

        {(exp.phone || exp.email) && (
          <div className="wc-frame flex flex-col gap-2 rounded-2xl p-4 text-sm">
            {exp.phone && (
              <p>
                📞{" "}
                <a className="underline" href={`tel:${exp.phone}`}>
                  {exp.phone}
                </a>
              </p>
            )}
            {exp.email && (
              <p>
                ✉️{" "}
                <a className="underline" href={`mailto:${exp.email}`}>
                  {exp.email}
                </a>
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function ContactTile({
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

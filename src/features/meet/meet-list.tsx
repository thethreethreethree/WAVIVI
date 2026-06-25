"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { ScreenHeader } from "@/components/ui/screen-header";
import { MeetUserSearch } from "@/features/meet/meet-user-search";
import { useT } from "@/lib/i18n/client";
import type { PublicChatGroup } from "@/lib/chat";
import { categoryMeta as metaFor } from "@/lib/travejor/group-meta";
import { getGroup } from "@/lib/travejor/groups";

/**
 * Public Meet Travelers list. Renders the real chat_groups table (active
 * rows only — archived groups are filtered server-side). Each card pulls
 * cover image / distance from the matching mock travel-group when one
 * exists, so seed groups keep their hand-picked photo/distance metadata;
 * brand-new groups created via /admin/groups render with their DB-stored
 * cover (or a fallback) and the destination city as the "distance" line.
 */
export function MeetList({ groups }: { groups: PublicChatGroup[] }) {
  const t = useT();
  const [active, setActive] = useState<string>("All");

  const categories = useMemo(() => {
    const set = new Set(groups.map((g) => g.category ?? "Other"));
    return ["All", ...Array.from(set)];
  }, [groups]);

  const visible = useMemo(
    () =>
      active === "All"
        ? groups
        : groups.filter((g) => (g.category ?? "Other") === active),
    [active, groups],
  );

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title={t("nav.meetTravelers")} accent />

      {/* Find a specific traveler — by Wondavu @username, Instagram
          handle, or WhatsApp number. */}
      <MeetUserSearch />

      {/* Category filter strip */}
      <div className="-mx-0 flex gap-2 overflow-x-auto px-5 pb-1 pt-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {categories.map((c) => {
          const isActive = c === active;
          // "All" keeps the globe emoji because it's not a category in the
          // meta map; everything else swaps to the per-category icon.
          const icon = c === "All" ? null : metaFor(c).icon;
          return (
            <button
              key={c}
              type="button"
              onClick={() => setActive(c)}
              className={`inline-flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-bold transition active:scale-[0.97] ${
                isActive
                  ? "wc-frame wc-frame-sunset text-white"
                  : "wc-frame wc-frame-orange-white text-foreground"
              }`}
            >
              {icon ? (
                <Image
                  src={icon}
                  alt=""
                  width={36}
                  height={36}
                  className="h-4 w-4 shrink-0"
                  aria-hidden
                />
              ) : (
                <>
                  {/* "All" chip glyph. Default themes: 🌍 emoji. Journal:
                      pen-style search icon (CSS in globals.css hides one
                      and shows the other depending on the html theme
                      class). */}
                  <span aria-hidden className="meet-all-emoji">
                    🌍
                  </span>
                  <Image
                    src="/icons/journal/search.png"
                    alt=""
                    width={28}
                    height={28}
                    className="meet-all-journal-icon h-4 w-4 shrink-0"
                    aria-hidden
                  />
                </>
              )}
              {c}
            </button>
          );
        })}
      </div>

      <ul className="flex flex-col gap-4 px-5 pb-28 pt-3">
        {visible.map((group) => (
          <GroupCard key={group.id} group={group} />
        ))}
        {visible.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">
            {groups.length === 0
              ? "No groups in this region yet. Tap the globe at the top to try a different region, or start one yourself."
              : `No groups in ${active} yet — try the All filter above.`}
          </p>
        )}
      </ul>
    </div>
  );
}

function GroupCard({ group }: { group: PublicChatGroup }) {
  // Pull mock fall-backs only for the visual fields that aren't on the DB
  // yet (cover, distance). Seeded groups keep their hand-picked metadata.
  const mock = getGroup(group.id);
  const category = group.category ?? "Other";
  const meta = metaFor(category);
  const cover =
    group.cover_image ?? mock?.coverImage ?? "/decor/balloon-floater.png";
  const distance =
    mock?.distance ??
    [group.destination_city, group.destination_country]
      .filter(Boolean)
      .join(", ") ??
    "Nearby";

  return (
    <li className="wc-frame overflow-hidden rounded-3xl p-0">
      {/* Cover banner with overlaid title */}
      <div className="relative h-36 w-full">
        <Image
          src={cover}
          alt={group.name}
          fill
          sizes="448px"
          className="object-cover"
        />
        <span
          className={`absolute inset-0 bg-gradient-to-t ${meta.tint} via-black/20 to-transparent`}
          aria-hidden
        />
        {/* Distance — frosted pill, top-left. Text-only; the 📍 emoji
            read noisy across themes. */}
        <span className="absolute left-3 top-3 inline-flex items-center rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-bold text-white backdrop-blur">
          {distance}
        </span>
        {/* Category — top-right */}
        <span className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-foreground">
          <Image
            src={meta.icon}
            alt=""
            width={36}
            height={36}
            className="h-4 w-4 shrink-0"
            aria-hidden
          />
          {category}
        </span>
        {group.featured && (
          <span className="absolute left-3 bottom-14 inline-flex items-center gap-1 rounded-full bg-glow px-2 py-0.5 text-[10px] font-bold text-white shadow-card">
            <Image
              src="/icons/rustic/star.png"
              alt=""
              width={28}
              height={28}
              className="h-3 w-3 shrink-0"
              aria-hidden
            />
            Featured
          </span>
        )}
        {/* Title — bottom-left over the gradient */}
        <h2 className="absolute bottom-3 left-4 right-4 text-xl font-bold leading-tight text-white drop-shadow">
          {group.name}
        </h2>
      </div>

      {/* Body */}
      <div className="p-4">
        {group.description && (
          <p className="text-sm text-foreground/90">{group.description}</p>
        )}

        <div className="mt-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {group.preview_avatars.length > 0 && (
              <div className="flex -space-x-2">
                {group.preview_avatars.map((url, i) => (
                  <span
                    key={i}
                    className="relative h-8 w-8 overflow-hidden rounded-full bg-surface ring-2 ring-background"
                  >
                    {url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={url}
                        alt=""
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span className="flex h-full w-full items-center justify-center bg-surface text-glow">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/icons/rustic/globe.png"
                          alt=""
                          aria-hidden
                          className="h-3/5 w-3/5 object-contain"
                        />
                      </span>
                    )}
                  </span>
                ))}
              </div>
            )}
            <span className="flex items-center gap-1 text-xs font-semibold text-muted">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {group.member_count} traveler{group.member_count === 1 ? "" : "s"}
            </span>
          </div>
          <Link
            href={`/meet/${group.id}`}
            className="wc-frame wc-frame-sunset shrink-0 rounded-full px-5 py-2.5 text-sm font-bold text-white active:scale-[0.98]"
          >
            Join Chat ›
          </Link>
        </div>
      </div>
    </li>
  );
}

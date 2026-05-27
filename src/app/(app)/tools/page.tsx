"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { SearchField } from "@/components/ui/search-field";
import { SusenAvatar } from "@/components/ui/susen-avatar";
import type { CategoryId } from "@/lib/toolbox/categories";
import { travelerServices } from "@/lib/travejor/tools";

/** Maps a Tools-page tile id to its Toolbox category id. */
const TILE_TO_CATEGORY: Record<string, CategoryId> = {
  atm: "atm",
  market: "market",
  bank: "bank",
  sim: "sim_card",
  wifi: "public_wifi",
  currency: "currency_exchange",
  bathroom: "bathroom",
  transport: "transportation",
  clinic: "medical_clinic",
  police: "police",
  embassy: "embassy",
  laundry: "laundry",
};

export default function ToolsPage() {
  const [query, setQuery] = useState("");

  const services = useMemo(
    () =>
      travelerServices.filter((s) =>
        s.label.toLowerCase().includes(query.toLowerCase()),
      ),
    [query],
  );

  return (
    <div className="flex flex-1 flex-col px-5 pt-[max(3rem,calc(env(safe-area-inset-top)+2rem))]">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Traveler&apos;s Tool</h1>
        <Link href="/susen" aria-label="Ask Susen">
          <SusenAvatar className="h-11 w-11 shadow-md" />
        </Link>
      </div>

      <div className="mt-4">
        <SearchField
          placeholder="Search for a service…"
          value={query}
          onChange={setQuery}
        />
      </div>

      {/* Ask Susen — entry to the social coordinator. The painted CHARCOAL
          frame asset is the visual; content sits absolutely on top. */}
      <Link
        href="/susen"
        className="relative mt-8 block w-full active:scale-[0.99]"
      >
        {/* Frame asset visually overflows past the Link box (negative
            inset + max-w-none) so the painted frame reads bigger without
            forcing the inner content area to grow. The frame is the
            positioning reference; the content overlays it absolutely and
            is vertically centered within the visible painted bar. */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/decor/frames/frame3.png"
          alt=""
          aria-hidden
          className="pointer-events-none relative -mx-4 block h-auto w-[calc(100%+2rem)] max-w-none select-none"
        />
        <span className="absolute inset-0 flex items-center gap-3 px-7">
          <SusenAvatar className="h-10 w-10 ring-2 ring-white/40" />
          <span className="min-w-0 flex-1">
            <span className="block text-base font-bold text-white">
              Ask Susen
            </span>
            <span className="block text-sm text-white/85">
              Find the vibe, the people, and the plan
            </span>
          </span>
          <span className="text-lg text-white">›</span>
        </span>
      </Link>

      {/* Services grid */}
      <div className="mt-6 grid grid-cols-3 gap-x-3 gap-y-7 pb-8">
        {services.map((service) => (
          <Link
            key={service.id}
            href={`/tools/map?category=${
              TILE_TO_CATEGORY[service.id] ?? service.id
            }`}
            className="group flex flex-col items-center gap-2"
          >
            <span className="relative flex h-[104px] w-[104px] items-center justify-center text-glow">
              {/* Soft tan/white wash so the icon pops on the parchment bg. */}
              <span
                aria-hidden
                className="wc-edge-soft absolute inset-0 rounded-full bg-[#fdf4e2]/85 shadow-[0_2px_8px_-2px_rgba(120,70,30,0.20)]"
              />
              <Icon name={service.icon} className="relative h-[92px] w-[92px]" />
            </span>
            <span className="text-center text-sm font-semibold">
              {service.label}
            </span>
          </Link>
        ))}
        {services.length === 0 && (
          <p className="col-span-3 py-10 text-center text-sm text-muted">
            No services match &ldquo;{query}&rdquo;.
          </p>
        )}
      </div>
    </div>
  );
}

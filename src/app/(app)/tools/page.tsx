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

      {/* Ask Susen — entry to the social coordinator */}
      <Link
        href="/susen"
        className="wc-frame wc-frame-sunset mt-4 flex items-center gap-3 rounded-2xl p-4 text-white shadow-card active:scale-[0.99]"
      >
        <SusenAvatar className="h-10 w-10 ring-2 ring-white/40" />
        <span className="min-w-0 flex-1">
          <span className="block text-sm font-bold">Ask Susen</span>
          <span className="block text-xs text-white/85">
            Find the vibe, the people, and the plan
          </span>
        </span>
        <span className="text-lg">›</span>
      </Link>

      {/* Services grid */}
      <div className="mt-6 grid grid-cols-3 gap-x-3 gap-y-7 pb-8">
        {services.map((service, i) => (
          <Link
            key={service.id}
            href={`/tools/map?category=${
              TILE_TO_CATEGORY[service.id] ?? service.id
            }`}
            className="group flex flex-col items-center gap-2"
          >
            <span
              className={`wc-stop-motion-${(i % 5) + 1} wc-frame wc-frame-orange flex h-[68px] w-[68px] items-center justify-center rounded-full text-glow`}
              style={{ animationDelay: `${-i * 0.29}s` }}
            >
              <Icon name={service.icon} className="h-12 w-12" />
            </span>
            <span className="text-center text-xs font-medium">
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

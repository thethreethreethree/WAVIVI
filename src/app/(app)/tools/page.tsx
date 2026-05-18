"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { SearchField } from "@/components/ui/search-field";
import { SusenAvatar } from "@/components/ui/susen-avatar";
import { travelerServices } from "@/lib/travejor/tools";

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
    <div className="flex flex-1 flex-col px-5 pt-5">
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
        className="mt-4 flex items-center gap-3 rounded-2xl bg-sunset p-4 text-white shadow-card active:scale-[0.99]"
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
        {services.map((service) => (
          <Link
            key={service.id}
            href="/map"
            className="flex flex-col items-center gap-2"
          >
            <span className="wc-frame wc-frame-orange flex h-[68px] w-[68px] items-center justify-center rounded-full text-glow">
              <Icon name={service.icon} className="h-7 w-7" />
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

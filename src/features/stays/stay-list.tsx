"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

import { Rating } from "@/components/ui/rating";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SearchField } from "@/components/ui/search-field";
import type { StayRow, StayType } from "@/types/supabase";

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

export function StayList({ stays }: { stays: StayRow[] }) {
  const [query, setQuery] = useState("");

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return stays;
    return stays.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        (s.address ?? "").toLowerCase().includes(q),
    );
  }, [stays, query]);

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Where to Stay" />

      <div className="px-5 pb-2 pt-4">
        <SearchField
          placeholder="Search hostels or hotels"
          value={query}
          onChange={setQuery}
          filled
        />
      </div>

      {stays.length === 0 ? (
        <p className="px-5 py-10 text-center text-sm text-muted">
          No stays in the system yet. Admins can add listings from the
          Partners hub.
        </p>
      ) : (
        <ul className="flex flex-col gap-3 px-5 pb-8 pt-2">
          {results.map((s) => {
            const recommended = s.backpack_rating >= 4;
            return (
              <li key={s.id}>
                <Link
                  href={`/stay/${s.id}`}
                  className="wc-frame flex gap-3 rounded-2xl p-3"
                >
                  <div className="wc-frame relative h-20 w-20 shrink-0 rounded-xl p-1.5">
                    <span className="relative flex h-full w-full items-center justify-center overflow-hidden rounded-lg bg-background">
                      {s.photo_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={s.photo_url}
                          alt={s.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="text-2xl" aria-hidden>
                          🏠
                        </span>
                      )}
                    </span>
                  </div>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <p className="truncate font-bold">{s.name}</p>
                    <p className="truncate text-xs text-muted">
                      {STAY_TYPE_LABEL[s.stay_type] ?? "Stay"}
                    </p>
                    {s.address && (
                      <p className="truncate text-xs text-muted">{s.address}</p>
                    )}
                    <div className="mt-auto flex items-center gap-2 pt-1.5">
                      <Rating
                        value={s.rating ?? s.backpack_rating}
                        favourite={recommended}
                      />
                      {s.price_per_night_usd != null && (
                        <span className="rounded-full bg-cool/15 px-2 py-0.5 text-[11px] font-semibold text-cool">
                          ${s.price_per_night_usd}/night
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              </li>
            );
          })}
          {results.length === 0 && (
            <p className="py-10 text-center text-sm text-muted">
              Nothing matches &ldquo;{query}&rdquo;.
            </p>
          )}
        </ul>
      )}
    </div>
  );
}

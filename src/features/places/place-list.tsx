"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";

import { Rating } from "@/components/ui/rating";
import { ScreenHeader } from "@/components/ui/screen-header";
import { SearchField } from "@/components/ui/search-field";
import { type PlaceKind, placeKindMeta, placesByKind } from "@/lib/travejor/places";

/** List view for Where to Eat / Where to Stay / Things To Do. */
export function PlaceList({ kind }: { kind: PlaceKind }) {
  const [query, setQuery] = useState("");
  const meta = placeKindMeta[kind];

  const results = useMemo(
    () =>
      placesByKind(kind).filter((p) =>
        p.name.toLowerCase().includes(query.toLowerCase()),
      ),
    [kind, query],
  );

  return (
    <div className="flex flex-1 flex-col">
      {kind === "eat" ? (
        <div className="bg-glow px-5 pb-5 pt-5">
          <Link
            href="/"
            aria-label="Back"
            className="mb-2 inline-flex text-white"
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
          <h1 className="text-2xl font-bold text-white">{meta.title}</h1>
        </div>
      ) : (
        <ScreenHeader title={meta.title} />
      )}

      <div className="px-5 pb-2 pt-4">
        <SearchField
          placeholder={meta.searchPlaceholder}
          value={query}
          onChange={setQuery}
          filled
        />
      </div>

      <ul className="flex flex-col gap-3 px-5 pb-8 pt-2">
        {results.map((place) => (
          <li key={place.id}>
            <Link
              href={`/place/${place.id}`}
              className="flex gap-3 rounded-2xl bg-surface p-3 shadow-sm ring-1 ring-border"
            >
              <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl">
                <Image
                  src={place.image}
                  alt={place.name}
                  fill
                  sizes="80px"
                  className="object-cover"
                />
              </div>
              <div className="flex min-w-0 flex-1 flex-col">
                <p className="truncate font-bold">{place.name}</p>
                <p className="truncate text-xs text-muted">{place.category}</p>
                <p className="text-xs text-muted">{place.distance}</p>
                <div className="mt-auto flex items-center gap-2 pt-1.5">
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
            </Link>
          </li>
        ))}
        {results.length === 0 && (
          <p className="py-10 text-center text-sm text-muted">
            Nothing matches &ldquo;{query}&rdquo;.
          </p>
        )}
      </ul>
    </div>
  );
}

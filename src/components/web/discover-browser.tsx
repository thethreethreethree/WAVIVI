"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import { ListingCard } from "@/components/web/listing-card";
import { photo } from "@/lib/travejor/photo";
import {
  type ListingCategory,
  VIBE_TAGS,
  allListings,
} from "@/lib/web/listings";

type CategoryFilter = ListingCategory | "all";
type Sort = "rating" | "reviews" | "az";

const CATEGORIES: { id: CategoryFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "stays", label: "Stays" },
  { id: "experiences", label: "Experiences" },
  { id: "events", label: "Events" },
];

const SORTS: { id: Sort; label: string }[] = [
  { id: "rating", label: "Top rated" },
  { id: "reviews", label: "Most reviewed" },
  { id: "az", label: "A → Z" },
];

const RATINGS = [
  { v: 0, label: "Any" },
  { v: 4, label: "4.0+" },
  { v: 4.5, label: "4.5+" },
];

const PAGE = 9;

export function DiscoverBrowser({
  initialCategory = "all",
}: {
  initialCategory?: CategoryFilter;
}) {
  const [category, setCategory] = useState<CategoryFilter>(initialCategory);
  const [sort, setSort] = useState<Sort>("rating");
  const [minRating, setMinRating] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [visible, setVisible] = useState(PAGE);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const results = useMemo(() => {
    const list = allListings().filter((l) => {
      if (category !== "all" && l.kind !== category) return false;
      if (l.rating < minRating) return false;
      if (tags.length && !tags.some((t) => l.tags.includes(t))) return false;
      if (
        query &&
        !l.title.toLowerCase().includes(query.toLowerCase()) &&
        !l.location.toLowerCase().includes(query.toLowerCase())
      )
        return false;
      return true;
    });
    list.sort((a, b) => {
      if (sort === "az") return a.title.localeCompare(b.title);
      if (sort === "reviews") return b.reviews - a.reviews;
      return b.rating - a.rating;
    });
    return list;
  }, [category, sort, minRating, tags, query]);

  function toggleTag(tag: string) {
    setVisible(PAGE);
    setTags((t) => (t.includes(tag) ? t.filter((x) => x !== tag) : [...t, tag]));
  }

  const filters = (
    <div className="flex flex-col gap-6">
      <FilterGroup label="Category">
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((c) => (
            <Chip
              key={c.id}
              active={category === c.id}
              onClick={() => {
                setCategory(c.id);
                setVisible(PAGE);
              }}
            >
              {c.label}
            </Chip>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="Sort by">
        <div className="flex flex-col gap-1.5">
          {SORTS.map((s) => (
            <Radio
              key={s.id}
              active={sort === s.id}
              onClick={() => setSort(s.id)}
            >
              {s.label}
            </Radio>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="Rating">
        <div className="flex flex-wrap gap-2">
          {RATINGS.map((r) => (
            <Chip
              key={r.v}
              active={minRating === r.v}
              onClick={() => {
                setMinRating(r.v);
                setVisible(PAGE);
              }}
            >
              {r.label}
            </Chip>
          ))}
        </div>
      </FilterGroup>

      <FilterGroup label="Vibe">
        <div className="flex flex-wrap gap-2">
          {VIBE_TAGS.map((t) => (
            <Chip key={t} active={tags.includes(t)} onClick={() => toggleTag(t)}>
              {t}
            </Chip>
          ))}
        </div>
      </FilterGroup>
    </div>
  );

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0">
          <Image
            src={photo("travejor-discover-hero", 1600, 600)}
            alt=""
            fill
            priority
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/55 to-black/35" />
        </div>
        <div className="relative mx-auto max-w-6xl px-5 py-16 md:py-20">
          <span className="font-mono text-xs font-bold uppercase tracking-[0.3em] text-glow">
            Travejor Directory
          </span>
          <h1 className="mt-3 max-w-2xl text-3xl font-bold leading-tight tracking-tight text-white md:text-4xl">
            Discover stays, experiences, and events worth the trip.
          </h1>
          <div className="mt-6 max-w-xl">
            <input
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setVisible(PAGE);
              }}
              placeholder="Search by name or destination…"
              className="w-full rounded-full border border-white/20 bg-white/95 px-5 py-3
                         text-sm text-foreground outline-none placeholder:text-muted"
            />
          </div>
        </div>
      </section>

      {/* Browse */}
      <div className="mx-auto max-w-6xl px-5 py-8">
        <button
          type="button"
          onClick={() => setFiltersOpen((o) => !o)}
          className="mb-4 w-full rounded-xl border border-border bg-surface py-2.5 text-sm font-bold lg:hidden"
        >
          {filtersOpen ? "Hide filters" : "Show filters"}
        </button>

        <div className="lg:grid lg:grid-cols-[260px_1fr] lg:gap-8">
          {/* Sidebar */}
          <aside
            className={`${filtersOpen ? "block" : "hidden"} mb-6 rounded-2xl border border-border bg-surface p-5 lg:mb-0 lg:block lg:self-start`}
          >
            <h2 className="mb-4 text-lg font-bold">Filters</h2>
            {filters}
          </aside>

          {/* Results */}
          <div>
            <div className="mb-4 flex items-baseline justify-between">
              <h2 className="text-lg font-bold">
                {results.length} listing{results.length === 1 ? "" : "s"}
              </h2>
            </div>

            {results.length === 0 ? (
              <p className="rounded-2xl border border-dashed border-border bg-surface py-16 text-center text-sm text-muted">
                No listings match your filters.
              </p>
            ) : (
              <>
                <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
                  {results.slice(0, visible).map((l) => (
                    <ListingCard key={l.id} listing={l} />
                  ))}
                </div>
                {visible < results.length && (
                  <div className="mt-8 text-center">
                    <button
                      type="button"
                      onClick={() => setVisible((v) => v + PAGE)}
                      className="rounded-full border border-border bg-surface px-6 py-3 text-sm font-bold transition-colors hover:border-glow"
                    >
                      Load more
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

function FilterGroup({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">
        {label}
      </h3>
      {children}
    </div>
  );
}

function Chip({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
        active
          ? "bg-foreground text-background"
          : "bg-surface-elevated text-muted ring-1 ring-border hover:text-foreground"
      }`}
    >
      {children}
    </button>
  );
}

function Radio({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex items-center gap-2 text-sm"
    >
      <span
        className={`flex h-4 w-4 items-center justify-center rounded-full border-2 ${
          active ? "border-glow" : "border-border"
        }`}
      >
        {active && <span className="h-2 w-2 rounded-full bg-glow" />}
      </span>
      <span className={active ? "font-semibold" : "text-muted"}>
        {children}
      </span>
    </button>
  );
}

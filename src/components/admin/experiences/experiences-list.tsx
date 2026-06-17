"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ExperienceEditor } from "./experience-editor";
import { ChannelIcon } from "@/components/admin/channel-icon";
import {
  CityFilter,
  CityLabel,
  type CityFilterValue,
} from "@/components/admin/cities/city-filter";
import { photoThumb } from "@/lib/utils/images";
import type { CityRow, ExperienceRow } from "@/types/supabase";

/** Channel glyphs — painted-brand path where we have the asset,
 *  emoji where we don't yet. `ChannelIcon` picks the right renderer. */
const CHANNELS = [
  { key: "instagram", label: "IG",       icon: "/icons/rustic/instagram_badge.png" },
  { key: "facebook",  label: "FB",       icon: "📘" }, // needs painted facebook glyph
  { key: "whatsapp",  label: "WhatsApp", icon: "/icons/rustic/01_chat_bubble.png" },
  { key: "email",     label: "Email",    icon: "/icons/rustic/mail.png" },
  { key: "phone",     label: "Phone",    icon: "📞" }, // needs painted phone glyph
  { key: "website",   label: "Website",  icon: "/icons/rustic/globe.png" },
] as const;
type ChannelKey = (typeof CHANNELS)[number]["key"];

function hasChannel(e: ExperienceRow, key: ChannelKey): boolean {
  return Boolean((e[key] ?? "").toString().trim());
}

const RATING_STEPS = [0, 1, 2, 3, 4, 4.5] as const;

const categoryKey = (e: ExperienceRow) => e.category || "other";

/** Filterable list of experiences in a region, with edit + delete. */
export function ExperiencesList({
  experiences,
  cities = [],
}: {
  experiences: ExperienceRow[];
  cities?: CityRow[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | "all">("all");
  const [cityFilter, setCityFilter] = useState<CityFilterValue>("all");
  const [minRating, setMinRating] = useState(0);
  const [needs, setNeeds] = useState<ChannelKey[]>([]);
  const [editing, setEditing] = useState<ExperienceRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const cityNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of cities) m[c.id] = c.name;
    return m;
  }, [cities]);

  const toggleNeed = (key: ChannelKey) =>
    setNeeds((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));

  // Lowercased query stored once per render so the filter loop doesn't
  // re-allocate `q.toLowerCase()` per row. Search matches name, address,
  // and description — those are the fields an admin scans visually when
  // looking for a known venue.
  const q = query.trim().toLowerCase();

  // Per-dimension predicates — each chip's count is rendered from rows
  // matching every dimension EXCEPT its own. Without this the category
  // pill counts stay pinned at the global cross-city total when a city
  // is selected (same bug shape that left "Hostel 16" stuck on
  // /admin/stays after picking Siquijor).
  const matchesSearch = (e: ExperienceRow) => {
    if (!q) return true;
    const hay = [e.name, e.address, e.description]
      .filter((v): v is string => Boolean(v))
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  };
  const matchesCategory = (e: ExperienceRow) =>
    categoryFilter === "all" || categoryKey(e) === categoryFilter;
  const matchesCity = (e: ExperienceRow) => {
    if (cityFilter === "all") return true;
    if (cityFilter === "unset") return e.city_id === null;
    return e.city_id === cityFilter;
  };
  const matchesRating = (e: ExperienceRow) =>
    (e.backpack_rating ?? 0) >= minRating;
  const matchesNeeds = (e: ExperienceRow) =>
    needs.every((k) => hasChannel(e, k));

  const rowsForCityCounts = useMemo(
    () =>
      experiences.filter(
        (e) =>
          matchesSearch(e) &&
          matchesCategory(e) &&
          matchesRating(e) &&
          matchesNeeds(e),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [experiences, q, categoryFilter, minRating, needs],
  );

  const { categories, categoryCountsAll } = useMemo(() => {
    let all = 0;
    const counts = new Map<string, number>();
    for (const e of experiences) {
      if (
        !matchesSearch(e) ||
        !matchesCity(e) ||
        !matchesRating(e) ||
        !matchesNeeds(e)
      )
        continue;
      all++;
      const key = categoryKey(e);
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
    const ordered = Array.from(counts.entries()).sort(
      (a, b) => b[1] - a[1],
    );
    return { categories: ordered, categoryCountsAll: all };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [experiences, q, cityFilter, minRating, needs]);

  const visible = useMemo(
    () =>
      experiences.filter(
        (e) =>
          matchesSearch(e) &&
          matchesCategory(e) &&
          matchesCity(e) &&
          matchesRating(e) &&
          matchesNeeds(e),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [experiences, q, categoryFilter, cityFilter, minRating, needs],
  );

  async function remove(id: string) {
    if (!window.confirm("Delete this experience? This cannot be undone.")) return;
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/experiences/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(b?.error ?? `Delete failed (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setDeletingId(null);
    }
  }

  async function patchFlag(
    id: string,
    field: "featured" | "top_pick",
    next: boolean,
  ) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/experiences/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ [field]: next }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(b?.error ?? `Update failed (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    }
  }

  const allVisibleSelected =
    visible.length > 0 && visible.every((e) => selected.has(e.id));

  function toggleSelectAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const e of visible) next.delete(e.id);
      } else {
        for (const e of visible) next.add(e.id);
      }
      return next;
    });
  }

  function toggleOne(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function deleteSelected() {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (
      !window.confirm(
        `Delete ${ids.length} experience${ids.length === 1 ? "" : "s"}? This cannot be undone.`,
      )
    ) {
      return;
    }
    setBulkBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/experiences", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(b?.error ?? `Delete failed (${res.status})`);
      }
      setSelected(new Set());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Bulk delete failed.");
    } finally {
      setBulkBusy(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      {/* Search bar — name / address / description match. Sits at the
          very top of the filter stack so it acts as the first cut
          before the city / category / rating chips narrow further. */}
      <div className="relative">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, address, or description…"
          className="admin-input w-full !pr-9"
          aria-label="Search experiences"
        />
        {query && (
          <button
            type="button"
            onClick={() => setQuery("")}
            aria-label="Clear search"
            className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full px-2 py-0.5 text-xs font-bold text-muted hover:bg-foreground/10 hover:text-foreground"
          >
            ×
          </button>
        )}
      </div>

      {/* `rows` is pre-filtered by every other dimension so each city's
          count reflects the current category / search / rating / needs
          slice instead of the global total. */}
      <CityFilter
        cities={cities}
        rows={rowsForCityCounts}
        value={cityFilter}
        onChange={setCityFilter}
      />

      {/* Category filter chips. Counts come from the cross-filter pass
          (every dimension except category) so picking a city drops
          categories that don't exist there to 0 instead of staying
          stuck at the cross-city total. */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Chip
          active={categoryFilter === "all"}
          onClick={() => setCategoryFilter("all")}
          label="All"
          count={categoryCountsAll}
        />
        {categories.map(([category, count]) => (
          <Chip
            key={category}
            active={categoryFilter === category}
            onClick={() => setCategoryFilter(category)}
            label={category}
            count={count}
          />
        ))}
      </div>

      {/* Rating + channels */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface px-3 py-2.5 shadow-card ring-1 ring-border">
        <label className="flex items-center gap-1.5 text-xs font-bold text-muted">
          🎒 Min rating
          <select
            value={minRating}
            onChange={(e) => setMinRating(Number(e.target.value))}
            className="admin-input !w-auto !py-1 !text-xs"
          >
            {RATING_STEPS.map((s) => (
              <option key={s} value={s}>
                {s === 0 ? "Any" : `${s}+`}
              </option>
            ))}
          </select>
        </label>
        <span className="h-4 w-px bg-border" />
        <span className="text-xs font-bold text-muted">Has:</span>
        {CHANNELS.map((ch) => {
          const active = needs.includes(ch.key);
          return (
            <button
              key={ch.key}
              type="button"
              aria-pressed={active}
              onClick={() => toggleNeed(ch.key)}
              className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-bold transition-colors ${
                active
                  ? "bg-sunset text-white"
                  : "text-muted ring-1 ring-border hover:text-foreground"
              }`}
            >
              <ChannelIcon src={ch.icon} />
              {ch.label}
            </button>
          );
        })}
        {(minRating > 0 || needs.length > 0) && (
          <button
            type="button"
            onClick={() => {
              setMinRating(0);
              setNeeds([]);
            }}
            className="ml-auto rounded-full px-2.5 py-1 text-xs font-bold text-heat hover:bg-heat/10"
          >
            Clear
          </button>
        )}
      </div>

      {/* Select-all + bulk delete bar */}
      <div className="flex flex-wrap items-center gap-3 px-1">
        <label className="flex items-center gap-2 text-xs font-bold text-muted">
          <input
            type="checkbox"
            checked={allVisibleSelected}
            onChange={toggleSelectAll}
            className="h-4 w-4 accent-[var(--color-glow,#f7941d)]"
          />
          Select all{visible.length !== experiences.length ? " shown" : ""}
        </label>
        <span className="text-xs font-semibold text-muted">
          {visible.length} of {experiences.length} shown
          {selected.size > 0 ? ` · ${selected.size} selected` : ""}
        </span>
        {selected.size > 0 && (
          <button
            type="button"
            onClick={deleteSelected}
            disabled={bulkBusy}
            className="ml-auto rounded-full bg-heat px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-60"
          >
            {bulkBusy ? "Deleting…" : `Delete ${selected.size} selected`}
          </button>
        )}
      </div>

      {error && (
        <p className="rounded-lg bg-heat/15 px-3 py-2 text-xs font-semibold text-heat">
          {error}
        </p>
      )}

      {visible.length === 0 ? (
        <p className="rounded-2xl bg-surface px-4 py-8 text-center text-sm text-muted shadow-card ring-1 ring-border">
          {minRating > 0 ||
          needs.length > 0 ||
          categoryFilter !== "all" ||
          cityFilter !== "all"
            ? "No experiences match these filters."
            : "No experiences in this region yet — import a CSV above."}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-border">
          {visible.map((e, i) => (
            <li
              key={e.id}
              className={`flex items-center gap-3 px-4 py-3 ${
                i > 0 ? "border-t border-border" : ""
              } ${selected.has(e.id) ? "bg-glow/5" : ""}`}
            >
              <input
                type="checkbox"
                checked={selected.has(e.id)}
                onChange={() => toggleOne(e.id)}
                aria-label={`Select ${e.name}`}
                className="h-4 w-4 shrink-0 accent-[var(--color-glow,#f7941d)]"
              />
              {e.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoThumb(e.photo_url, 96)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-border"
                />
              ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-background text-lg">
                  🧭
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {e.name}
                </span>
                <span className="flex items-center gap-1.5 truncate text-xs text-muted">
                  <CityLabel
                    cityId={e.city_id}
                    cityNameById={cityNameById}
                  />
                  <span className="truncate">
                    {[e.category, e.activity_type]
                      .filter((v) => v && v !== "other")
                      .join(" · ")}
                    {e.address ? ` · ${e.address}` : ""}
                  </span>
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="font-bold text-foreground">
                    🎒 {e.backpack_rating.toFixed(1)}
                  </span>
                  {e.rating != null && (
                    <span className="font-bold text-foreground">
                      ★ {e.rating}
                      <span className="font-medium text-muted">
                        {" "}
                        · {e.review_count} review{e.review_count === 1 ? "" : "s"}
                      </span>
                    </span>
                  )}
                  <span className="text-muted">
                    👍 {e.thumbs_up} · 👎 {e.thumbs_down}
                  </span>
                  {CHANNELS.filter((ch) => hasChannel(e, ch.key)).map((ch) => (
                    <span
                      key={ch.key}
                      title={ch.label}
                      className="rounded-full bg-border px-1.5 py-0.5 font-bold text-foreground"
                    >
                      <ChannelIcon src={ch.icon} /> {ch.label}
                    </span>
                  ))}
                </span>
              </span>
              <span className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  onClick={() => patchFlag(e.id, "featured", !e.featured)}
                  title={
                    e.featured
                      ? "Featured — unpin from the top of the regional list"
                      : "Pin to the top of the regional list"
                  }
                  className={`rounded-full px-3 py-1 text-xs font-bold ring-1 transition-colors ${
                    e.featured
                      ? "bg-glow text-white ring-glow"
                      : "text-muted ring-border hover:text-foreground"
                  }`}
                >
                  {e.featured ? "★ Featured" : "Feature"}
                </button>
                <button
                  type="button"
                  onClick={() => patchFlag(e.id, "top_pick", !e.top_pick)}
                  title={
                    e.top_pick
                      ? "Top pick — remove the ⭐ badge"
                      : "Tag this experience with the ⭐ Top pick badge"
                  }
                  className={`rounded-full px-3 py-1 text-xs font-bold ring-1 transition-colors ${
                    e.top_pick
                      ? "bg-cool text-white ring-cool"
                      : "text-muted ring-border hover:text-foreground"
                  }`}
                >
                  {e.top_pick ? "⭐ Top pick" : "Top pick"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(e)}
                  className="rounded-full px-3 py-1 text-xs font-bold text-muted ring-1 ring-border hover:text-foreground"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => remove(e.id)}
                  disabled={deletingId === e.id}
                  className="rounded-full px-3 py-1 text-xs font-bold text-heat ring-1 ring-border hover:bg-heat/10 disabled:opacity-60"
                >
                  {deletingId === e.id ? "…" : "Delete"}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <ExperienceEditor
          experience={editing}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
        active
          ? "bg-sunset text-white"
          : "text-muted ring-1 ring-border hover:text-foreground"
      }`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 text-[10px] font-extrabold ${
          active ? "bg-white/25" : "bg-border"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { StayEditor } from "./stay-editor";
import { ChannelIcon } from "@/components/admin/channel-icon";
import {
  CityFilter,
  CityLabel,
  type CityFilterValue,
} from "@/components/admin/cities/city-filter";
import { photoThumb } from "@/lib/utils/images";
import type { CityRow, StayRow, StayType } from "@/types/supabase";

const STAY_TYPE_LABEL: Record<StayType, string> = {
  hostel: "Hostel",
  hotel: "Hotel",
  guesthouse: "Guesthouse",
  resort: "Resort",
  apartment: "Apartment",
  bnb: "B&B",
  camping: "Camping",
  other: "Other",
};

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

function hasChannel(s: StayRow, key: ChannelKey): boolean {
  return Boolean((s[key] ?? "").toString().trim());
}

const RATING_STEPS = [0, 1, 2, 3, 4, 4.5] as const;

/** Filterable list of stays in a region, with edit + delete. */
export function StaysList({
  stays,
  cities = [],
}: {
  stays: StayRow[];
  cities?: CityRow[];
}) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<StayType | "all">("all");
  const [cityFilter, setCityFilter] = useState<CityFilterValue>("all");
  const [minRating, setMinRating] = useState(0);
  const [needs, setNeeds] = useState<ChannelKey[]>([]);
  const [editing, setEditing] = useState<StayRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // City name lookup, used by every row's inline CityLabel.
  const cityNameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const c of cities) m[c.id] = c.name;
    return m;
  }, [cities]);

  const toggleNeed = (key: ChannelKey) =>
    setNeeds((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));

  // Lowercased once per render so the filter loop doesn't re-allocate.
  // Search matches name + address + description — the fields an admin
  // visually scans when looking for a specific stay.
  const q = query.trim().toLowerCase();

  // Per-dimension predicates. Each chip's count is rendered from rows
  // that match every dimension EXCEPT its own — so the "Hostel 16"
  // pill drops to "Hostel 0" when Siquijor is selected, instead of
  // staying stuck at the global cross-city total. Symmetric on city
  // chips: "Siquijor 10" recomputes to its hostel count when the
  // Hostel type is selected.
  const matchesSearch = (s: StayRow) => {
    if (!q) return true;
    const hay = [s.name, s.address, s.description]
      .filter((v): v is string => Boolean(v))
      .join(" ")
      .toLowerCase();
    return hay.includes(q);
  };
  const matchesType = (s: StayRow) =>
    typeFilter === "all" || s.stay_type === typeFilter;
  const matchesCity = (s: StayRow) => {
    if (cityFilter === "all") return true;
    if (cityFilter === "unset") return s.city_id === null;
    return s.city_id === cityFilter;
  };
  const matchesRating = (s: StayRow) =>
    (s.backpack_rating ?? 0) >= minRating;
  const matchesNeeds = (s: StayRow) => needs.every((k) => hasChannel(s, k));

  // Rows the City chips count against — everything except the city
  // filter itself. Pre-filtered and passed into <CityFilter rows={…}>
  // so its internal byCityId tally already reflects the type/search/
  // rating/needs slice.
  const rowsForCityCounts = useMemo(
    () =>
      stays.filter(
        (s) =>
          matchesSearch(s) &&
          matchesType(s) &&
          matchesRating(s) &&
          matchesNeeds(s),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stays, q, typeFilter, minRating, needs],
  );

  // Type chip counts — everything except the type filter. "All" sums
  // the buckets to stay consistent with the per-type pills.
  const { typeCountsAll, typeCountsByType } = useMemo(() => {
    let all = 0;
    const byType: Record<string, number> = {};
    for (const s of stays) {
      if (
        !matchesSearch(s) ||
        !matchesCity(s) ||
        !matchesRating(s) ||
        !matchesNeeds(s)
      )
        continue;
      all++;
      byType[s.stay_type] = (byType[s.stay_type] ?? 0) + 1;
    }
    return { typeCountsAll: all, typeCountsByType: byType };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [stays, q, cityFilter, minRating, needs]);

  const visible = useMemo(
    () =>
      stays.filter(
        (s) =>
          matchesSearch(s) &&
          matchesType(s) &&
          matchesCity(s) &&
          matchesRating(s) &&
          matchesNeeds(s),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [stays, q, typeFilter, cityFilter, minRating, needs],
  );

  async function remove(id: string) {
    if (!window.confirm("Delete this stay? This cannot be undone.")) return;
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/stays/${id}`, { method: "DELETE" });
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

  /** Flip a boolean column on one stay (`featured` or `top_pick`). */
  async function patchFlag(
    id: string,
    field: "featured" | "top_pick",
    next: boolean,
  ) {
    setError(null);
    try {
      const res = await fetch(`/api/admin/stays/${id}`, {
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

  // Whether every currently-visible row is selected.
  const allVisibleSelected =
    visible.length > 0 && visible.every((s) => selected.has(s.id));

  function toggleSelectAll() {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const s of visible) next.delete(s.id);
      } else {
        for (const s of visible) next.add(s.id);
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
        `Delete ${ids.length} stay${ids.length === 1 ? "" : "s"}? This cannot be undone.`,
      )
    ) {
      return;
    }
    setBulkBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/stays", {
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
      {/* Search bar — name / address / description match. First cut
          before city / type / rating chips narrow further. */}
      <div className="relative">
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search by name, address, or description…"
          className="admin-input w-full !pr-9"
          aria-label="Search stays"
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

      {/* City filter chips. `rows` is pre-filtered by every other
          dimension so each city's count reflects the current type /
          search / rating / needs slice. */}
      <CityFilter
        cities={cities}
        rows={rowsForCityCounts}
        value={cityFilter}
        onChange={setCityFilter}
      />

      {/* Type filter chips. Counts come from the cross-filter pass
          (every dimension except type itself) so picking Siquijor
          drops "Hostel 16" to "Hostel 0" if Siquijor has no hostels,
          instead of staying stuck at the global total. */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Chip
          active={typeFilter === "all"}
          onClick={() => setTypeFilter("all")}
          label="All"
          count={typeCountsAll}
        />
        {(Object.keys(STAY_TYPE_LABEL) as StayType[]).map((t) => (
          <Chip
            key={t}
            active={typeFilter === t}
            onClick={() => setTypeFilter(t)}
            label={STAY_TYPE_LABEL[t]}
            count={typeCountsByType[t] ?? 0}
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
          Select all{visible.length !== stays.length ? " shown" : ""}
        </label>
        <span className="text-xs font-semibold text-muted">
          {visible.length} of {stays.length} shown
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
          {minRating > 0 || needs.length > 0 || cityFilter !== "all"
            ? "No stays match these filters."
            : "No stays in this region yet — import a CSV above."}
        </p>
      ) : (
        <ul className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-border">
          {visible.map((s, i) => (
            <li
              key={s.id}
              className={`flex items-center gap-3 px-4 py-3 ${
                i > 0 ? "border-t border-border" : ""
              } ${selected.has(s.id) ? "bg-glow/5" : ""}`}
            >
              <input
                type="checkbox"
                checked={selected.has(s.id)}
                onChange={() => toggleOne(s.id)}
                aria-label={`Select ${s.name}`}
                className="h-4 w-4 shrink-0 accent-[var(--color-glow,#f7941d)]"
              />
              {s.photo_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={photoThumb(s.photo_url, 96)}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  referrerPolicy="no-referrer"
                  className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-border"
                />
              ) : (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-background text-lg">
                  🏠
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {s.name}
                </span>
                <span className="flex items-center gap-1.5 truncate text-xs text-muted">
                  <CityLabel
                    cityId={s.city_id}
                    cityNameById={cityNameById}
                  />
                  <span className="truncate">
                    {STAY_TYPE_LABEL[s.stay_type]}
                    {s.address ? ` · ${s.address}` : ""}
                  </span>
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-2 text-[11px]">
                  <span className="font-bold text-foreground">
                    🎒 {s.backpack_rating.toFixed(1)}
                  </span>
                  {s.rating != null && (
                    <span className="font-bold text-foreground">
                      ★ {s.rating}
                      <span className="font-medium text-muted">
                        {" "}
                        · {s.review_count} review{s.review_count === 1 ? "" : "s"}
                      </span>
                    </span>
                  )}
                  <span className="text-muted">
                    👍 {s.thumbs_up} · 👎 {s.thumbs_down}
                  </span>
                  {CHANNELS.filter((ch) => hasChannel(s, ch.key)).map((ch) => (
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
                  onClick={() => patchFlag(s.id, "featured", !s.featured)}
                  title={
                    s.featured
                      ? "Featured — unpin from the top of the regional list"
                      : "Pin to the top of the regional list"
                  }
                  className={`rounded-full px-3 py-1 text-xs font-bold ring-1 transition-colors ${
                    s.featured
                      ? "bg-glow text-white ring-glow"
                      : "text-muted ring-border hover:text-foreground"
                  }`}
                >
                  {s.featured ? "★ Featured" : "Feature"}
                </button>
                <button
                  type="button"
                  onClick={() => patchFlag(s.id, "top_pick", !s.top_pick)}
                  title={
                    s.top_pick
                      ? "Top pick — remove the ⭐ badge"
                      : "Tag this stay with the ⭐ Top pick badge"
                  }
                  className={`rounded-full px-3 py-1 text-xs font-bold ring-1 transition-colors ${
                    s.top_pick
                      ? "bg-cool text-white ring-cool"
                      : "text-muted ring-border hover:text-foreground"
                  }`}
                >
                  {s.top_pick ? "⭐ Top pick" : "Top pick"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(s)}
                  className="rounded-full px-3 py-1 text-xs font-bold text-muted ring-1 ring-border hover:text-foreground"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => remove(s.id)}
                  disabled={deletingId === s.id}
                  className="rounded-full px-3 py-1 text-xs font-bold text-heat ring-1 ring-border hover:bg-heat/10 disabled:opacity-60"
                >
                  {deletingId === s.id ? "…" : "Delete"}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {editing && <StayEditor stay={editing} onClose={() => setEditing(null)} />}
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

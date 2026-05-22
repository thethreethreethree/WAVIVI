"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { ExperienceEditor } from "./experience-editor";
import { photoThumb } from "@/lib/utils/images";
import type { ExperienceRow } from "@/types/supabase";

const CHANNELS = [
  { key: "instagram", label: "IG", icon: "📷" },
  { key: "facebook", label: "FB", icon: "📘" },
  { key: "whatsapp", label: "WhatsApp", icon: "💬" },
  { key: "email", label: "Email", icon: "✉️" },
  { key: "phone", label: "Phone", icon: "📞" },
  { key: "website", label: "Website", icon: "🌐" },
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
}: {
  experiences: ExperienceRow[];
}) {
  const router = useRouter();
  const [categoryFilter, setCategoryFilter] = useState<string | "all">("all");
  const [minRating, setMinRating] = useState(0);
  const [needs, setNeeds] = useState<ChannelKey[]>([]);
  const [editing, setEditing] = useState<ExperienceRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  // Categories present in the data, with counts, sorted by frequency.
  const categories = useMemo(() => {
    const c = new Map<string, number>();
    for (const e of experiences) {
      const key = categoryKey(e);
      c.set(key, (c.get(key) ?? 0) + 1);
    }
    return Array.from(c.entries()).sort((a, b) => b[1] - a[1]);
  }, [experiences]);

  const toggleNeed = (key: ChannelKey) =>
    setNeeds((p) => (p.includes(key) ? p.filter((k) => k !== key) : [...p, key]));

  const visible = useMemo(
    () =>
      experiences.filter((e) => {
        if (categoryFilter !== "all" && categoryKey(e) !== categoryFilter)
          return false;
        if ((e.backpack_rating ?? 0) < minRating) return false;
        return needs.every((k) => hasChannel(e, k));
      }),
    [experiences, categoryFilter, minRating, needs],
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
      {/* Category filter chips */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Chip
          active={categoryFilter === "all"}
          onClick={() => setCategoryFilter("all")}
          label="All"
          count={experiences.length}
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
              <span aria-hidden>{ch.icon}</span>
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
          {minRating > 0 || needs.length > 0 || categoryFilter !== "all"
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
                <span className="block truncate text-xs text-muted">
                  {[e.category, e.activity_type]
                    .filter((v) => v && v !== "other")
                    .join(" · ")}
                  {e.address ? ` · ${e.address}` : ""}
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
                      {ch.icon} {ch.label}
                    </span>
                  ))}
                </span>
              </span>
              <span className="flex shrink-0 flex-col gap-1">
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

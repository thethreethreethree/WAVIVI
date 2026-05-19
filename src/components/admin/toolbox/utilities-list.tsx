"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { Icon } from "@/components/ui/icon";
import { CATEGORY_BY_ID, TOOLBOX_CATEGORIES } from "@/lib/toolbox/categories";
import type { UtilityCategory, UtilityRow } from "@/types/supabase";

import { BackpackRating } from "./backpack-rating";
import { UtilityEditor } from "./utility-editor";

const CROWD_STYLE: Record<string, string> = {
  low: "bg-cool/15 text-cool",
  medium: "bg-glow/15 text-glow",
  high: "bg-heat/15 text-heat",
};

/** Category-filterable list of a region's utilities, with edit + delete. */
export function UtilitiesList({ utilities }: { utilities: UtilityRow[] }) {
  const router = useRouter();
  const [filter, setFilter] = useState<UtilityCategory | "all">("all");
  const [editing, setEditing] = useState<UtilityRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const counts = useMemo(() => {
    const c: Record<string, number> = {};
    for (const u of utilities) c[u.category] = (c[u.category] ?? 0) + 1;
    return c;
  }, [utilities]);

  const visible = useMemo(
    () =>
      filter === "all"
        ? utilities
        : utilities.filter((u) => u.category === filter),
    [utilities, filter],
  );

  async function remove(id: string) {
    if (!window.confirm("Delete this utility? This cannot be undone.")) return;
    setDeletingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/utilities/${id}`, {
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

  return (
    <div className="flex flex-col gap-3">
      {/* Category filter chips */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Chip
          active={filter === "all"}
          onClick={() => setFilter("all")}
          label="All"
          count={utilities.length}
        />
        {TOOLBOX_CATEGORIES.map((c) => (
          <Chip
            key={c.id}
            active={filter === c.id}
            onClick={() => setFilter(c.id)}
            label={c.label}
            count={counts[c.id] ?? 0}
          />
        ))}
      </div>

      {error && (
        <p className="rounded-lg bg-heat/15 px-3 py-2 text-xs font-semibold text-heat">
          {error}
        </p>
      )}

      {visible.length === 0 ? (
        <p className="rounded-2xl bg-surface px-4 py-8 text-center text-sm text-muted shadow-card ring-1 ring-border">
          No utilities in this category yet.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-border">
          {visible.map((u, i) => (
            <li
              key={u.id}
              className={`flex items-center gap-3 px-4 py-3 ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-background text-foreground">
                <Icon
                  name={CATEGORY_BY_ID[u.category].icon}
                  className="h-5 w-5"
                />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {u.name}
                </span>
                <span className="block truncate text-xs text-muted">
                  {u.address ?? CATEGORY_BY_ID[u.category].label}
                </span>
                <span className="mt-1 flex flex-wrap items-center gap-2">
                  <BackpackRating rating={u.backpack_rating} />
                  <span className="text-[11px] text-muted">
                    👍 {u.thumbs_up} · 👎 {u.thumbs_down}
                  </span>
                  {u.crowd_level && (
                    <span
                      className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
                        CROWD_STYLE[u.crowd_level]
                      }`}
                    >
                      {u.crowd_level} crowd
                    </span>
                  )}
                  {u.open_24_hours && (
                    <span className="rounded-full bg-cool/15 px-1.5 py-0.5 text-[10px] font-bold text-cool">
                      24h
                    </span>
                  )}
                </span>
              </span>
              <span className="flex shrink-0 flex-col gap-1">
                <button
                  type="button"
                  onClick={() => setEditing(u)}
                  className="rounded-full px-3 py-1 text-xs font-bold text-muted ring-1 ring-border hover:text-foreground"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() => remove(u.id)}
                  disabled={deletingId === u.id}
                  className="rounded-full px-3 py-1 text-xs font-bold text-heat ring-1 ring-border hover:bg-heat/10 disabled:opacity-60"
                >
                  {deletingId === u.id ? "…" : "Delete"}
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}

      {editing && (
        <UtilityEditor utility={editing} onClose={() => setEditing(null)} />
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

"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import type { UtilityCategoryRow, UtilityOsmFilter } from "@/types/supabase";

import {
  createUtilityCategory,
  deleteUtilityCategory,
  updateUtilityCategory,
} from "./actions";

/** Tiny chip showing a key=value OSM filter; used in the row + edit form. */
function FilterChip({ filter }: { filter: UtilityOsmFilter }) {
  return (
    <span className="rounded-full bg-foreground/10 px-2 py-0.5 font-mono text-[10px] text-foreground">
      {filter.key}={filter.value}
    </span>
  );
}

interface UtilityCountByCategoryId {
  [categoryId: string]: number;
}

/**
 * Admin manager for utility_categories. Mirrors the cities-list shape:
 *  - top row: create a brand-new category
 *  - one row per existing category with rename / icon / OSM-filter edits
 *  - active toggle + delete with a soft-delete fallback hint
 *
 * For full scannability of a new category an engineer still has to
 * mirror it into the static categories.ts (icons + OSM filter literals
 * the scan engine consumes). The page surfaces this with a banner.
 */
export function CategoriesAdmin({
  categories,
  utilityCountById,
}: {
  categories: UtilityCategoryRow[];
  utilityCountById: UtilityCountByCategoryId;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // New-category form state
  const [newLabel, setNewLabel] = useState("");
  const [newId, setNewId] = useState("");
  const [newBlurb, setNewBlurb] = useState("");
  const [newIcon, setNewIcon] = useState("moreTools");
  const [newSort, setNewSort] = useState(900);

  // Per-row edit state — only one row open at a time.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editLabel, setEditLabel] = useState("");
  const [editBlurb, setEditBlurb] = useState("");
  const [editIcon, setEditIcon] = useState("");
  const [editSort, setEditSort] = useState(0);
  const [editFilters, setEditFilters] = useState<UtilityOsmFilter[]>([]);
  const [editFilterKey, setEditFilterKey] = useState("");
  const [editFilterValue, setEditFilterValue] = useState("");

  function clearStatus(): void {
    setError(null);
    setNotice(null);
  }

  function startEdit(c: UtilityCategoryRow): void {
    clearStatus();
    setEditingId(c.id);
    setEditLabel(c.label);
    setEditBlurb(c.blurb);
    setEditIcon(c.icon);
    setEditSort(c.sort_order);
    setEditFilters(c.osm_filters);
    setEditFilterKey("");
    setEditFilterValue("");
  }

  function appendFilter(): void {
    const k = editFilterKey.trim();
    const v = editFilterValue.trim();
    if (!k || !v) return;
    setEditFilters((prev) => [...prev, { key: k, value: v }]);
    setEditFilterKey("");
    setEditFilterValue("");
  }

  function removeFilter(idx: number): void {
    setEditFilters((prev) => prev.filter((_, i) => i !== idx));
  }

  function commitCreate(): void {
    clearStatus();
    if (!newLabel.trim()) {
      setError("Label is required.");
      return;
    }
    startTransition(async () => {
      const res = await createUtilityCategory({
        id: newId.trim() || undefined,
        label: newLabel,
        blurb: newBlurb,
        icon: newIcon,
        sort_order: newSort,
        active: true,
        osm_filters: [],
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setNotice(`Created ${newLabel.trim()}. Add OSM filters in the row below to make it scannable.`);
      setNewLabel("");
      setNewId("");
      setNewBlurb("");
      setNewIcon("moreTools");
      setNewSort(900);
      router.refresh();
    });
  }

  function commitEdit(): void {
    if (!editingId) return;
    clearStatus();
    const id = editingId;
    startTransition(async () => {
      const res = await updateUtilityCategory(id, {
        label: editLabel,
        blurb: editBlurb,
        icon: editIcon,
        sort_order: editSort,
        osm_filters: editFilters,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setNotice("Saved.");
      setEditingId(null);
      router.refresh();
    });
  }

  function commitToggleActive(c: UtilityCategoryRow): void {
    clearStatus();
    startTransition(async () => {
      const res = await updateUtilityCategory(c.id, { active: !c.active });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setNotice(c.active ? `${c.label} hidden.` : `${c.label} re-enabled.`);
      router.refresh();
    });
  }

  function commitDelete(c: UtilityCategoryRow): void {
    clearStatus();
    const inUse = utilityCountById[c.id] ?? 0;
    const msg = inUse
      ? `Delete ${c.label}? ${inUse} utility row(s) reference this category and the DB will block the delete — you'll need to re-bucket them first.`
      : `Delete ${c.label}? This cannot be undone.`;
    if (!window.confirm(msg)) return;
    startTransition(async () => {
      const res = await deleteUtilityCategory(c.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setNotice(`Deleted ${c.label}.`);
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-4">
      {/* Add row */}
      <div className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-border">
        <h2 className="text-sm font-bold text-foreground">Add a category</h2>
        <p className="mt-0.5 text-xs text-muted">
          Registers the slug in the DB so utilities can be assigned to it via
          CSV import or the per-utility editor. To make it{" "}
          <strong className="text-foreground">scannable</strong> via OSM, also
          mirror it into{" "}
          <code className="font-mono">src/lib/toolbox/categories.ts</code> with
          OSM filter rules.
        </p>
        <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-5">
          <input
            type="text"
            value={newLabel}
            onChange={(e) => setNewLabel(e.target.value)}
            placeholder="Label · e.g. Bike Repair"
            className="admin-input sm:col-span-2"
          />
          <input
            type="text"
            value={newId}
            onChange={(e) => setNewId(e.target.value)}
            placeholder="ID (auto from label)"
            className="admin-input"
          />
          <input
            type="text"
            value={newIcon}
            onChange={(e) => setNewIcon(e.target.value)}
            placeholder="Icon · moreTools"
            className="admin-input"
          />
          <input
            type="number"
            value={newSort}
            onChange={(e) => setNewSort(Number(e.target.value) || 0)}
            placeholder="Sort"
            className="admin-input"
          />
        </div>
        <input
          type="text"
          value={newBlurb}
          onChange={(e) => setNewBlurb(e.target.value)}
          placeholder="Traveler blurb (one line)"
          className="admin-input mt-2 w-full"
        />
        <button
          type="button"
          onClick={commitCreate}
          disabled={pending || !newLabel.trim()}
          className="mt-3 rounded-full bg-sunset px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
        >
          {pending ? "Adding…" : "Add category"}
        </button>
      </div>

      {error && (
        <p className="rounded-lg bg-heat/15 px-3 py-2 text-xs font-semibold text-heat">
          {error}
        </p>
      )}
      {notice && !error && (
        <p className="rounded-lg bg-cool/15 px-3 py-2 text-xs font-semibold text-cool">
          {notice}
        </p>
      )}

      {/* List */}
      <ul className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-border">
        {categories.map((c, i) => {
          const isEditing = editingId === c.id;
          const inUse = utilityCountById[c.id] ?? 0;
          return (
            <li
              key={c.id}
              className={`flex flex-col gap-2 px-4 py-3 ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              {!isEditing ? (
                <>
                  <div className="flex flex-wrap items-center gap-3">
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 text-sm font-bold text-foreground">
                        {c.label}
                        {!c.active && (
                          <span className="rounded-full bg-heat/15 px-2 py-0.5 text-[10px] font-bold text-heat">
                            Hidden
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-[11px] text-muted">
                        id: <code className="font-mono">{c.id}</code> · sort{" "}
                        {c.sort_order} · {inUse} utility row
                        {inUse === 1 ? "" : "s"}
                        {c.blurb ? ` · ${c.blurb}` : ""}
                      </span>
                      {c.osm_filters.length > 0 && (
                        <span className="mt-1 flex flex-wrap items-center gap-1">
                          {c.osm_filters.map((f, fi) => (
                            <FilterChip
                              key={`${f.key}-${f.value}-${fi}`}
                              filter={f}
                            />
                          ))}
                        </span>
                      )}
                    </span>
                    <span className="flex shrink-0 items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => startEdit(c)}
                        className="rounded-full px-3 py-1 text-xs font-bold text-muted ring-1 ring-border hover:text-foreground"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => commitToggleActive(c)}
                        disabled={pending}
                        className="rounded-full px-3 py-1 text-xs font-bold text-muted ring-1 ring-border hover:text-foreground disabled:opacity-50"
                      >
                        {c.active ? "Hide" : "Show"}
                      </button>
                      <button
                        type="button"
                        onClick={() => commitDelete(c)}
                        disabled={pending}
                        className="rounded-full px-3 py-1 text-xs font-bold text-heat ring-1 ring-border hover:bg-heat/10 disabled:opacity-50"
                        title={
                          inUse > 0
                            ? "Delete will be blocked — re-bucket utilities first"
                            : "Delete this category"
                        }
                      >
                        Delete
                      </button>
                    </span>
                  </div>
                </>
              ) : (
                <div className="flex flex-col gap-2 rounded-lg bg-background/40 p-3 ring-1 ring-border">
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-4">
                    <input
                      type="text"
                      value={editLabel}
                      onChange={(e) => setEditLabel(e.target.value)}
                      placeholder="Label"
                      className="admin-input sm:col-span-2"
                    />
                    <input
                      type="text"
                      value={editIcon}
                      onChange={(e) => setEditIcon(e.target.value)}
                      placeholder="Icon name"
                      className="admin-input"
                    />
                    <input
                      type="number"
                      value={editSort}
                      onChange={(e) =>
                        setEditSort(Number(e.target.value) || 0)
                      }
                      placeholder="Sort"
                      className="admin-input"
                    />
                  </div>
                  <input
                    type="text"
                    value={editBlurb}
                    onChange={(e) => setEditBlurb(e.target.value)}
                    placeholder="Traveler blurb"
                    className="admin-input w-full"
                  />
                  <div className="rounded-lg bg-foreground/5 p-2">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
                      OSM filters
                    </p>
                    <p className="mt-0.5 text-[11px] text-muted">
                      Each row: a tag the scan engine queries on Overpass
                      (e.g. <code>amenity</code> + <code>atm</code>). Union
                      — any match counts.
                    </p>
                    {editFilters.length > 0 ? (
                      <ul className="mt-2 flex flex-col gap-1">
                        {editFilters.map((f, fi) => (
                          <li
                            key={`${f.key}-${f.value}-${fi}`}
                            className="flex items-center gap-2"
                          >
                            <FilterChip filter={f} />
                            <button
                              type="button"
                              onClick={() => removeFilter(fi)}
                              className="text-[11px] font-bold text-heat hover:underline"
                            >
                              remove
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 text-[11px] text-muted">
                        No filters yet — this category won&apos;t be scanned.
                      </p>
                    )}
                    <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-3">
                      <input
                        type="text"
                        value={editFilterKey}
                        onChange={(e) => setEditFilterKey(e.target.value)}
                        placeholder="OSM key · amenity"
                        className="admin-input"
                      />
                      <input
                        type="text"
                        value={editFilterValue}
                        onChange={(e) => setEditFilterValue(e.target.value)}
                        placeholder="OSM value · atm"
                        className="admin-input"
                      />
                      <button
                        type="button"
                        onClick={appendFilter}
                        disabled={
                          !editFilterKey.trim() || !editFilterValue.trim()
                        }
                        className="rounded-full bg-foreground/10 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-foreground/15 disabled:opacity-50"
                      >
                        Add filter
                      </button>
                    </div>
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      type="button"
                      onClick={() => setEditingId(null)}
                      className="rounded-full px-3 py-1.5 text-xs font-bold text-muted ring-1 ring-border hover:text-foreground"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      onClick={commitEdit}
                      disabled={pending || !editLabel.trim()}
                      className="rounded-full bg-cool px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                    >
                      {pending ? "Saving…" : "Save"}
                    </button>
                  </div>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

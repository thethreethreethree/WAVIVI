"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  addFreeTextSavedItem,
  removeSavedItem,
  toggleFavoriteSavedItem,
  updateSavedItemNotes,
  type SavedItemList,
} from "@/features/where-to-next/actions";
import type { SavedTravelItem } from "@/types/supabase";

interface Props {
  planId: string;
  list: SavedItemList;
  title: string;
  emptyHint: string;
  addPlaceholder: string;
  browseHref?: string;
  browseLabel?: string;
  initialItems: SavedTravelItem[];
}

export function ManageSavedList({
  planId,
  list,
  title,
  emptyHint,
  addPlaceholder,
  browseHref,
  browseLabel,
  initialItems,
}: Props) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  function add() {
    if (!name.trim()) {
      setError("Add a name first.");
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await addFreeTextSavedItem(planId, list, name, notes);
      if (!res.ok) {
        setError(res.error ?? "Couldn't add that.");
        return;
      }
      setName("");
      setNotes("");
      router.refresh();
    });
  }

  function remove(externalId: string) {
    setItems((cur) => cur.filter((it) => it.externalId !== externalId));
    startTransition(async () => {
      await removeSavedItem(planId, list, externalId);
      router.refresh();
    });
  }

  function toggleFavorite(externalId: string) {
    setItems((cur) =>
      cur.map((it) =>
        it.externalId === externalId
          ? { ...it, favorite: !it.favorite }
          : it,
      ),
    );
    startTransition(async () => {
      await toggleFavoriteSavedItem(planId, list, externalId);
      router.refresh();
    });
  }

  function commitNotes(externalId: string, value: string) {
    setItems((cur) =>
      cur.map((it) =>
        it.externalId === externalId
          ? { ...it, notes: value.trim() || null }
          : it,
      ),
    );
    startTransition(async () => {
      await updateSavedItemNotes(planId, list, externalId, value);
    });
  }

  const sorted = [...items].sort(
    (a, b) => Number(b.favorite ?? false) - Number(a.favorite ?? false),
  );

  return (
    <div className="flex flex-1 flex-col gap-5 px-5 pb-8 pt-[max(2.5rem,calc(env(safe-area-inset-top)+1.5rem))]">
      <header className="flex items-start justify-between gap-3">
        <Link
          href={`/where-to-next/plans/${planId}`}
          aria-label="Back"
          className="wc-frame wc-frame-orange-white flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-glow"
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
        <div className="min-w-0 flex-1">
          <p className="text-xs font-bold uppercase tracking-wide text-glow">
            My Saved List
          </p>
          <h1 className="mt-0.5 truncate text-2xl font-bold tracking-tight">
            <span className="wc-underline">{title}</span>
          </h1>
        </div>
      </header>

      {/* Add form */}
      <section className="wc-frame rounded-2xl p-4">
        <p className="text-xs font-bold uppercase tracking-wide text-muted">
          Add to this list
        </p>
        <div className="mt-2 flex flex-col gap-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={addPlaceholder}
            className="wtn-input"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
            placeholder="Notes (optional)"
            className="wtn-input resize-y text-sm"
          />
          {error && (
            <p className="text-[11px] font-semibold text-heat">{error}</p>
          )}
          <div className="flex items-center justify-end gap-2">
            {browseHref && browseLabel && (
              <Link
                href={browseHref}
                className="wc-frame wc-frame-orange-white rounded-full px-4 py-2 text-xs font-bold text-glow"
              >
                {browseLabel}
              </Link>
            )}
            <button
              type="button"
              onClick={add}
              disabled={pending}
              className="wc-frame wc-frame-sunset rounded-full px-5 py-2 text-xs font-bold text-white disabled:opacity-60"
            >
              {pending ? "Saving…" : "Add"}
            </button>
          </div>
        </div>
      </section>

      {/* Items */}
      {sorted.length === 0 ? (
        <p className="rounded-2xl bg-surface p-4 text-center text-sm text-muted ring-1 ring-border">
          {emptyHint}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sorted.map((it) => (
            <SavedItemCard
              key={it.externalId}
              item={it}
              onRemove={() => remove(it.externalId)}
              onToggleFavorite={() => toggleFavorite(it.externalId)}
              onSaveNotes={(v) => commitNotes(it.externalId, v)}
              pending={pending}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function SavedItemCard({
  item,
  onRemove,
  onToggleFavorite,
  onSaveNotes,
  pending,
}: {
  item: SavedTravelItem;
  onRemove: () => void;
  onToggleFavorite: () => void;
  onSaveNotes: (next: string) => void;
  pending: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [notes, setNotes] = useState(item.notes ?? "");

  function commit() {
    setEditing(false);
    if ((notes.trim() || null) !== (item.notes ?? null)) {
      onSaveNotes(notes);
    }
  }

  return (
    <li className="wc-frame rounded-2xl p-3">
      <div className="flex items-start gap-3">
        <button
          type="button"
          onClick={onToggleFavorite}
          disabled={pending}
          aria-label={item.favorite ? "Unfavourite" : "Favourite"}
          className="shrink-0 text-xl"
        >
          {item.favorite ? "⭐" : "☆"}
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-bold">{item.name}</p>
          {item.city && (
            <p className="truncate text-xs text-muted">{item.city}</p>
          )}
          {editing ? (
            <textarea
              autoFocus
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              onBlur={commit}
              rows={2}
              placeholder="Add notes…"
              className="wtn-input mt-2 resize-y text-xs"
            />
          ) : item.notes ? (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-1 block text-left text-xs italic text-foreground/80"
            >
              {item.notes}
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setEditing(true)}
              className="mt-1 text-[11px] font-semibold text-glow underline"
            >
              + Add notes
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={onRemove}
          disabled={pending}
          aria-label="Remove"
          className="shrink-0 rounded-full p-1 text-muted hover:text-heat"
        >
          ✕
        </button>
      </div>
    </li>
  );
}

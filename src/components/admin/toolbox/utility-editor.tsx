"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { MAX_BACKPACKS } from "@/lib/toolbox/backpacks";
import { CATEGORY_BY_ID, TOOLBOX_CATEGORIES } from "@/lib/toolbox/categories";
import type { CrowdLevel, UtilityCategory, UtilityRow } from "@/types/supabase";

const CROWD_LEVELS: CrowdLevel[] = ["low", "medium", "high"];

interface UtilityEditorProps {
  utility: UtilityRow;
  onClose: () => void;
}

/** Modal editor for a single toolbox utility. Saves via PATCH. */
export function UtilityEditor({ utility, onClose }: UtilityEditorProps) {
  const router = useRouter();
  const [name, setName] = useState(utility.name);
  const [category, setCategory] = useState<UtilityCategory>(utility.category);
  const [address, setAddress] = useState(utility.address ?? "");
  const [phone, setPhone] = useState(utility.phone ?? "");
  const [website, setWebsite] = useState(utility.website ?? "");
  const [open24, setOpen24] = useState(utility.open_24_hours);
  const [rating, setRating] = useState(utility.backpack_rating);
  const [crowd, setCrowd] = useState<CrowdLevel | "">(
    utility.crowd_level ?? "",
  );
  const [description, setDescription] = useState(utility.description ?? "");
  const [notes, setNotes] = useState<string[]>(() => {
    const n = [...utility.traveler_notes];
    while (n.length < 3) n.push("");
    return n.slice(0, 3);
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/utilities/${utility.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          category,
          address: address.trim() || null,
          phone: phone.trim() || null,
          website: website.trim() || null,
          open_24_hours: open24,
          backpack_rating: rating,
          crowd_level: crowd || null,
          description: description.trim() || null,
          traveler_notes: notes.map((n) => n.trim()).filter(Boolean),
        }),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(b?.error ?? `Save failed (${res.status})`);
      }
      router.refresh();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-0 sm:items-center sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90dvh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-surface shadow-card ring-1 ring-border sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-surface px-4 py-3">
          <h3 className="text-sm font-bold">Edit utility</h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="flex h-7 w-7 items-center justify-center rounded-full text-muted hover:bg-border"
          >
            ×
          </button>
        </div>

        <div className="flex flex-col gap-3 p-4">
          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="admin-input"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Category">
              <select
                value={category}
                onChange={(e) =>
                  setCategory(e.target.value as UtilityCategory)
                }
                className="admin-input"
              >
                {TOOLBOX_CATEGORIES.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Crowd level">
              <select
                value={crowd}
                onChange={(e) =>
                  setCrowd(e.target.value as CrowdLevel | "")
                }
                className="admin-input"
              >
                <option value="">—</option>
                {CROWD_LEVELS.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </Field>
          </div>

          <Field label="Address">
            <input
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              className="admin-input"
            />
          </Field>

          <div className="grid grid-cols-2 gap-3">
            <Field label="Phone">
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="admin-input"
              />
            </Field>
            <Field label="Website">
              <input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                className="admin-input"
              />
            </Field>
          </div>

          <label className="flex items-center gap-2 text-xs font-bold">
            <input
              type="checkbox"
              checked={open24}
              onChange={(e) => setOpen24(e.target.checked)}
              className="h-4 w-4 accent-glow"
            />
            Open 24 hours
          </label>

          <Field label={`Backpack rating — ${rating.toFixed(1)} / ${MAX_BACKPACKS}`}>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min={0}
                max={MAX_BACKPACKS}
                step={0.5}
                value={rating}
                onChange={(e) => setRating(Number(e.target.value))}
                className="w-full accent-glow"
              />
              <span className="shrink-0 text-sm" aria-hidden>
                {Array.from({ length: MAX_BACKPACKS }, (_, i) => (
                  <span
                    key={i}
                    className={i < Math.round(rating) ? "" : "opacity-25 grayscale"}
                  >
                    🎒
                  </span>
                ))}
              </span>
            </div>
          </Field>

          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="admin-input resize-y"
            />
          </Field>

          <fieldset className="flex flex-col gap-1.5">
            <legend className="text-xs font-bold text-muted">
              Traveler notes (up to 3)
            </legend>
            {notes.map((note, i) => (
              <input
                key={i}
                value={note}
                onChange={(e) => {
                  const next = [...notes];
                  next[i] = e.target.value;
                  setNotes(next);
                }}
                placeholder={`Note ${i + 1}`}
                className="admin-input"
              />
            ))}
          </fieldset>

          {error && (
            <p className="rounded-lg bg-heat/15 px-3 py-2 text-xs font-semibold text-heat">
              {error}
            </p>
          )}
        </div>

        <div className="sticky bottom-0 flex gap-2 border-t border-border bg-surface px-4 py-3">
          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded-full bg-sunset px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {busy ? "Saving…" : "Save changes"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-bold text-muted hover:text-foreground"
          >
            Cancel
          </button>
          <span className="ml-auto self-center text-[10px] text-muted">
            {CATEGORY_BY_ID[category].label}
          </span>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-bold text-muted">{label}</span>
      {children}
    </label>
  );
}

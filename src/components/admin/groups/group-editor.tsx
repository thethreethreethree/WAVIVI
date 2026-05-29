"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { AdminChatGroup } from "@/lib/chat";

const CATEGORIES = [
  "Food",
  "Nightlife",
  "Culture",
  "Nature",
  "Beach",
  "Wellness",
  "Adventure",
  "Coworking",
  "Photography",
  "Backpacker",
  "Other",
];

type Region = {
  id: string;
  display_name: string;
  city: string | null;
  country: string | null;
};

/**
 * Modal editor for chat groups. Doubles as create + edit:
 *  • `group === null` → POST /api/admin/groups   (creates a new group)
 *  • `group ≠ null`    → PATCH /api/admin/groups/[id]
 *
 * id is editable on create (it's the URL slug used by /meet/[id]) but
 * locked on edit — changing it would orphan every existing message + member.
 */
export function GroupEditor({
  group,
  onClose,
}: {
  group: AdminChatGroup | null;
  onClose: () => void;
}) {
  const router = useRouter();
  const isEdit = group !== null;
  const [id, setId] = useState(group?.id ?? "");
  const [name, setName] = useState(group?.name ?? "");
  const [category, setCategory] = useState(group?.category ?? "");
  const [description, setDescription] = useState(group?.description ?? "");
  const [coverImage, setCoverImage] = useState(group?.cover_image ?? "");
  const [destinationCity, setDestinationCity] = useState(
    group?.destination_city ?? "",
  );
  const [destinationCountry, setDestinationCountry] = useState(
    group?.destination_country ?? "",
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Region picker — replaces free-text city + country.
  const [regions, setRegions] = useState<Region[]>([]);
  const [regionId, setRegionId] = useState<string>("");
  useEffect(() => {
    let cancelled = false;
    fetch("/api/regions")
      .then((r) => r.json())
      .then((j: { regions?: Region[] }) => {
        if (cancelled) return;
        const list = j.regions ?? [];
        setRegions(list);
        // Pre-select the region whose city + country match the saved
        // values, so editing an existing group lands on the right row.
        const existing = list.find(
          (r) =>
            (r.city ?? "").toLowerCase() ===
              (group?.destination_city ?? "").toLowerCase() &&
            (r.country ?? "").toLowerCase() ===
              (group?.destination_country ?? "").toLowerCase(),
        );
        if (existing) setRegionId(existing.id);
      })
      .catch(() => {
        /* leave list empty — admin can still type in fallback fields */
      });
    return () => {
      cancelled = true;
    };
  }, [group?.destination_city, group?.destination_country]);

  function chooseRegion(id: string) {
    setRegionId(id);
    const r = regions.find((x) => x.id === id);
    if (r) {
      setDestinationCity(r.city ?? "");
      setDestinationCountry(r.country ?? "");
    }
  }

  // Cover image upload — drop or click.
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  async function uploadFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/admin/groups/upload-cover", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(b?.error ?? `Upload failed (${res.status})`);
      }
      const json = (await res.json()) as { url?: string };
      if (json.url) setCoverImage(json.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  function onFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (f) void uploadFile(f);
    e.target.value = "";
  }
  function onDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragOver(false);
    const f = e.dataTransfer.files?.[0];
    if (f) void uploadFile(f);
  }

  async function save() {
    setBusy(true);
    setError(null);
    try {
      const body = {
        ...(isEdit ? {} : { id: id.trim() }),
        name: name.trim(),
        category: category.trim() || null,
        description: description.trim() || null,
        cover_image: coverImage.trim() || null,
        destination_city: destinationCity.trim() || null,
        destination_country: destinationCountry.trim() || null,
      };
      const url = isEdit
        ? `/api/admin/groups/${group!.id}`
        : "/api/admin/groups";
      const res = await fetch(url, {
        method: isEdit ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
          <h3 className="text-sm font-bold">
            {isEdit ? "Edit group" : "New chat group"}
          </h3>
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
          {!isEdit && (
            <Field label="URL slug (id)">
              <input
                value={id}
                onChange={(e) =>
                  setId(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
                }
                placeholder="e.g. foodies-bangkok"
                maxLength={64}
                className="admin-input"
              />
              <span className="text-[10px] text-muted">
                3–64 chars; lowercase letters, numbers, dashes only. Becomes
                /meet/{id || "your-slug"}.
              </span>
            </Field>
          )}

          <Field label="Name">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Foodies in Bangkok"
              maxLength={80}
              className="admin-input"
            />
          </Field>

          <Field label="Category">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="admin-input"
            >
              <option value="">— Pick one —</option>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </Field>

          <Field label="Description">
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="What's the vibe? What kind of plans happen here?"
              className="admin-input resize-y"
            />
          </Field>

          {/* Cover image — drop / upload + URL fallback. */}
          <Field label="Cover image">
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
              onClick={() => fileRef.current?.click()}
              className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-3 py-6 text-center transition-colors ${
                dragOver
                  ? "border-glow bg-glow/10"
                  : "border-border bg-surface-elevated hover:border-glow/60"
              }`}
            >
              <p className="text-xs font-bold text-foreground">
                {uploading
                  ? "Uploading…"
                  : "Drop an image here or click to upload"}
              </p>
              <p className="mt-0.5 text-[10px] text-muted">
                JPEG / PNG / WebP · up to 5 MB
              </p>
              <input
                ref={fileRef}
                type="file"
                accept="image/jpeg,image/png,image/webp"
                onChange={onFileInput}
                className="hidden"
              />
            </div>
            <input
              value={coverImage}
              onChange={(e) => setCoverImage(e.target.value)}
              placeholder="…or paste an image URL"
              className="admin-input mt-2"
            />
            {coverImage && /^https?:\/\//i.test(coverImage) && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverImage}
                alt="Cover preview"
                className="mt-2 h-28 w-full rounded-lg border border-border object-cover"
              />
            )}
          </Field>

          {/* Region — replaces free-text city + country. Writes the
              selected region's city/country into the existing columns
              so downstream queries don't change shape yet. */}
          <Field label="Region">
            <select
              value={regionId}
              onChange={(e) => chooseRegion(e.target.value)}
              className="admin-input"
            >
              <option value="">— Pick a region —</option>
              {regions.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.display_name}
                  {r.country ? ` · ${r.country}` : ""}
                </option>
              ))}
            </select>
            <span className="text-[10px] text-muted">
              Sets destination city + country from your{" "}
              <a className="font-semibold text-glow" href="/admin/regions">
                Regions
              </a>{" "}
              list. Need a new one? Add it there first.
            </span>
          </Field>

          {/* Read-only echo so admins can confirm what'll be saved. */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Destination city">
              <input
                value={destinationCity}
                onChange={(e) => setDestinationCity(e.target.value)}
                placeholder="(set by region)"
                className="admin-input"
              />
            </Field>
            <Field label="Destination country">
              <input
                value={destinationCountry}
                onChange={(e) => setDestinationCountry(e.target.value)}
                placeholder="(set by region)"
                className="admin-input"
              />
            </Field>
          </div>

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
            disabled={busy || !name.trim() || (!isEdit && !id.trim())}
            className="rounded-full bg-sunset px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
          >
            {busy ? "Saving…" : isEdit ? "Save changes" : "Create group"}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full px-4 py-2 text-sm font-bold text-muted hover:text-foreground"
          >
            Cancel
          </button>
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

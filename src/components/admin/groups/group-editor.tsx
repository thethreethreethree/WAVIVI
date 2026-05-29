"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";

import type { AdminChatGroup } from "@/lib/chat";

type PartnerHit = {
  type: "stay" | "restaurant" | "experience" | "event";
  id: string;
  name: string;
  address: string | null;
  latitude: number;
  longitude: number;
  region_id: string | null;
};
const PARTNER_EMOJI: Record<PartnerHit["type"], string> = {
  stay: "🛏️",
  restaurant: "🍽️",
  experience: "🎟️",
  event: "🎉",
};

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
  // Specific-location pin — optional. Either picked from our partner DB
  // (place_partner_* set) or, later, from Google Maps (those fields stay
  // null). Manual "Clear" zeroes everything.
  const [placeName, setPlaceName] = useState(group?.place_name ?? "");
  const [placeAddress, setPlaceAddress] = useState(group?.place_address ?? "");
  const [placeLat, setPlaceLat] = useState<number | null>(
    group?.place_lat ?? null,
  );
  const [placeLng, setPlaceLng] = useState<number | null>(
    group?.place_lng ?? null,
  );
  const [placePartnerId, setPlacePartnerId] = useState<string | null>(
    group?.place_partner_id ?? null,
  );
  const [placePartnerType, setPlacePartnerType] = useState<
    PartnerHit["type"] | null
  >((group?.place_partner_type ?? null) as PartnerHit["type"] | null);
  const [partnerQuery, setPartnerQuery] = useState("");
  const [partnerHits, setPartnerHits] = useState<PartnerHit[]>([]);
  const [partnerSearching, setPartnerSearching] = useState(false);
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

  // Partner search — debounced. Scoped to the selected region when one
  // exists so admins don't see partners from other countries by accident.
  useEffect(() => {
    if (partnerQuery.trim().length < 2) {
      setPartnerHits([]);
      return;
    }
    let cancelled = false;
    const t = window.setTimeout(async () => {
      setPartnerSearching(true);
      try {
        const params = new URLSearchParams({ q: partnerQuery });
        if (regionId) params.set("region_id", regionId);
        const res = await fetch(
          `/api/admin/groups/partner-search?${params.toString()}`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const json = (await res.json()) as { results?: PartnerHit[] };
        if (!cancelled) setPartnerHits(json.results ?? []);
      } catch {
        if (!cancelled) setPartnerHits([]);
      } finally {
        if (!cancelled) setPartnerSearching(false);
      }
    }, 220);
    return () => {
      cancelled = true;
      window.clearTimeout(t);
    };
  }, [partnerQuery, regionId]);

  function choosePartner(p: PartnerHit) {
    setPlaceName(p.name);
    setPlaceAddress(p.address ?? "");
    setPlaceLat(p.latitude);
    setPlaceLng(p.longitude);
    setPlacePartnerId(p.id);
    setPlacePartnerType(p.type);
    setPartnerQuery("");
    setPartnerHits([]);
  }
  function clearLocation() {
    setPlaceName("");
    setPlaceAddress("");
    setPlaceLat(null);
    setPlaceLng(null);
    setPlacePartnerId(null);
    setPlacePartnerType(null);
    setPartnerQuery("");
    setPartnerHits([]);
  }

  // Cover image upload — drop or click.
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  /** Shrink a phone-camera photo client-side before sending it across the
   *  network. Vercel caps API-route bodies at ~4.5 MB, and raw HEIC/JPEG
   *  from a modern phone is routinely 5–12 MB. We resize to a max edge of
   *  1920 px and re-encode at quality 0.85 — visually indistinguishable
   *  on a cover banner, but typically lands at 300–800 KB.
   *
   *  PNG inputs are re-emitted as PNG so transparency is preserved (logos,
   *  stickers, cropped portraits). Everything else is re-emitted as JPEG
   *  for the smaller payload. JPEG has no alpha channel, so for the JPEG
   *  path we pre-fill the canvas with white — otherwise the canvas's
   *  default transparent-black backing buffer would bake any leftover
   *  alpha out as black. */
  async function compressForUpload(file: File): Promise<File> {
    // Tiny files (<700 KB) are already fine — skip the canvas round trip
    // (also preserves the PNG's original alpha for sub-700 KB PNGs).
    if (file.size < 700 * 1024) return file;
    const bmp = await createImageBitmap(file).catch(() => null);
    if (!bmp) return file;
    const MAX_EDGE = 1920;
    const scale = Math.min(1, MAX_EDGE / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * scale);
    const h = Math.round(bmp.height * scale);
    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;

    const keepAlpha = file.type === "image/png";
    if (!keepAlpha) {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, w, h);
    }
    ctx.drawImage(bmp, 0, 0, w, h);
    const mime = keepAlpha ? "image/png" : "image/jpeg";
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob(resolve, mime, keepAlpha ? undefined : 0.85),
    );
    if (!blob) return file;
    // If compression somehow grew the file (rare on already-small images),
    // keep the original.
    if (blob.size >= file.size) return file;
    const ext = keepAlpha ? ".png" : ".jpg";
    return new File([blob], file.name.replace(/\.[a-z0-9]+$/i, ext), {
      type: mime,
      lastModified: Date.now(),
    });
  }

  const TOO_BIG_MESSAGE =
    "The picture looks great but the file is too big. Please choose something smaller.";

  async function uploadFile(file: File) {
    setUploading(true);
    setError(null);
    try {
      // Quick MIME guard so we don't waste a canvas round trip on a
      // .mov / .pdf / etc. The server enforces the real allow-list.
      if (!file.type.startsWith("image/")) {
        throw new Error("Pick an image file (JPEG, PNG, or WebP).");
      }
      const prepared = await compressForUpload(file);
      // Friendlier ceiling than Vercel's opaque 413. The server still
      // enforces a 5 MB cap as defence-in-depth.
      const HARD_CAP = 4 * 1024 * 1024;
      if (prepared.size > HARD_CAP) {
        throw new Error(TOO_BIG_MESSAGE);
      }
      const form = new FormData();
      form.append("file", prepared);
      const res = await fetch("/api/admin/groups/upload-cover", {
        method: "POST",
        body: form,
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as { error?: string } | null;
        // Server-side 413 (Vercel body cap) and our /upload-cover 413
        // (the route's own 5 MB check) both surface the same friendly
        // message so admins see a consistent prompt.
        const fallback =
          res.status === 413
            ? TOO_BIG_MESSAGE
            : `Upload failed (${res.status})`;
        throw new Error(b?.error ?? fallback);
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
        place_name: placeName.trim() || null,
        place_address: placeAddress.trim() || null,
        place_lat: placeLat,
        place_lng: placeLng,
        place_partner_id: placePartnerId,
        place_partner_type: placePartnerType,
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

        {error && (
          <div
            role="status"
            aria-live="polite"
            className="flex items-start gap-2 border-b border-heat/20 bg-heat/10 px-4 py-3"
          >
            <span aria-hidden className="mt-0.5 text-base">
              ⚠️
            </span>
            <p className="flex-1 text-sm font-semibold text-heat">{error}</p>
            <button
              type="button"
              onClick={() => setError(null)}
              aria-label="Dismiss"
              className="shrink-0 text-base leading-none text-heat hover:opacity-70"
            >
              ×
            </button>
          </div>
        )}

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

          {/* Specific location pin — optional. Picked from our own partner
              network (stays / restaurants / experiences / events). Google
              Maps autocomplete is a planned follow-up. */}
          <Field label="Specific location (optional)">
            {placeName ? (
              <div className="rounded-lg bg-surface-elevated p-3 ring-1 ring-border">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-bold text-foreground">
                      {placePartnerType
                        ? `${PARTNER_EMOJI[placePartnerType]} `
                        : "📍 "}
                      {placeName}
                    </p>
                    {placeAddress && (
                      <p className="truncate text-[11px] text-muted">
                        {placeAddress}
                      </p>
                    )}
                    {placePartnerType && placePartnerId && (
                      <a
                        href={`/admin/${
                          placePartnerType === "stay"
                            ? "stays"
                            : placePartnerType === "restaurant"
                              ? "restaurants"
                              : placePartnerType === "experience"
                                ? "experiences"
                                : "events"
                        }`}
                        className="mt-1 inline-block text-[10px] font-semibold text-glow underline"
                      >
                        Open partner admin ›
                      </a>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={clearLocation}
                    className="shrink-0 rounded-full px-2 py-1 text-[10px] font-bold text-muted ring-1 ring-border hover:text-foreground"
                  >
                    Clear
                  </button>
                </div>
              </div>
            ) : (
              <>
                <input
                  value={partnerQuery}
                  onChange={(e) => setPartnerQuery(e.target.value)}
                  placeholder="Search partners — stays, restaurants, experiences, events"
                  className="admin-input"
                />
                <span className="text-[10px] text-muted">
                  Pin this group to a specific partner location.{" "}
                  {regionId
                    ? "Limited to the selected region."
                    : "Pick a region first to narrow results."}
                </span>
                {partnerSearching && (
                  <p className="mt-1 text-[10px] text-muted">Searching…</p>
                )}
                {partnerHits.length > 0 && (
                  <ul className="mt-1 max-h-56 overflow-y-auto rounded-lg ring-1 ring-border">
                    {partnerHits.map((h) => (
                      <li
                        key={`${h.type}-${h.id}`}
                        className="border-b border-border last:border-b-0"
                      >
                        <button
                          type="button"
                          onClick={() => choosePartner(h)}
                          className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-surface-elevated"
                        >
                          <span className="text-base">
                            {PARTNER_EMOJI[h.type]}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="block truncate text-xs font-bold text-foreground">
                              {h.name}
                            </span>
                            {h.address && (
                              <span className="block truncate text-[10px] text-muted">
                                {h.address}
                              </span>
                            )}
                          </span>
                          <span className="shrink-0 rounded-full bg-glow/10 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-glow">
                            {h.type}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
                {partnerQuery.trim().length >= 2 &&
                  !partnerSearching &&
                  partnerHits.length === 0 && (
                    <p className="mt-1 text-[10px] text-muted">
                      No partners match &ldquo;{partnerQuery}&rdquo;.
                    </p>
                  )}
              </>
            )}
          </Field>

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

"use client";

import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";

import {
  bulkDeleteFeedPosts,
  createFeedPost,
  deleteFeedPost,
  importFeedPostsCsv,
  setFeedPostDisplayOrder,
} from "./actions";
import { FEED_CSV_TEMPLATE } from "./csv";
import type { FeedPostRow } from "@/types/supabase";

/** Admin UI for ONE region's feed: paste-IG-URL form on top, then a
 *  list of existing posts with delete + pin-order controls. Pure
 *  client-side — every mutation goes through a server action and
 *  triggers `router.refresh()` so the list re-renders against fresh
 *  DB state. */
export function FeedAdminClient({
  regionId,
  posts,
}: {
  regionId: string;
  posts: FeedPostRow[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Bulk-selection state — matches the pattern used by the stays /
  // restaurants / experiences admin lists so the muscle memory carries
  // across surfaces.
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);

  const allSelected = posts.length > 0 && posts.every((p) => selected.has(p.id));

  function toggleOne(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll(): void {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        for (const p of posts) next.delete(p.id);
      } else {
        for (const p of posts) next.add(p.id);
      }
      return next;
    });
  }

  async function deleteSelected(): Promise<void> {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (
      !window.confirm(
        `Delete ${ids.length} feed post${ids.length === 1 ? "" : "s"}? This cannot be undone.`,
      )
    ) {
      return;
    }
    clearStatus();
    setBulkBusy(true);
    try {
      const res = await bulkDeleteFeedPosts(ids);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setNotice(
        `Deleted ${res.deleted} post${res.deleted === 1 ? "" : "s"}.`,
      );
      setSelected(new Set());
      router.refresh();
    } finally {
      setBulkBusy(false);
    }
  }

  // Compose form state ------------------------------------------------
  const [handle, setHandle] = useState("");
  const [caption, setCaption] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [igPostUrl, setIgPostUrl] = useState("");
  const [locationLabel, setLocationLabel] = useState("");
  const [verified, setVerified] = useState(false);
  const [likesLabel, setLikesLabel] = useState("");

  function clearStatus(): void {
    setError(null);
    setNotice(null);
  }

  function resetForm(): void {
    setHandle("");
    setCaption("");
    setImageUrl("");
    setVideoUrl("");
    setIgPostUrl("");
    setLocationLabel("");
    setVerified(false);
    setLikesLabel("");
  }

  function onSubmit(): void {
    clearStatus();
    startTransition(async () => {
      const res = await createFeedPost({
        regionId,
        handle,
        caption,
        imageUrl,
        videoUrl: videoUrl || null,
        igPostUrl: igPostUrl || null,
        locationLabel: locationLabel || null,
        verified,
        likesLabel: likesLabel || undefined,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setNotice("Posted.");
      resetForm();
      router.refresh();
    });
  }

  function onDelete(id: string): void {
    clearStatus();
    if (!window.confirm("Delete this feed post?")) return;
    startTransition(async () => {
      const res = await deleteFeedPost(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  function onPinChange(id: string, raw: string): void {
    clearStatus();
    const value = raw.trim();
    const parsed = value === "" ? null : Number.parseInt(value, 10);
    if (parsed !== null && Number.isNaN(parsed)) {
      setError("Pin order must be an integer or empty.");
      return;
    }
    startTransition(async () => {
      const res = await setFeedPostDisplayOrder(id, parsed);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      router.refresh();
    });
  }

  // CSV bulk-import state ---------------------------------------------
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [csvText, setCsvText] = useState("");
  const [csvResult, setCsvResult] = useState<
    | null
    | {
        ok: boolean;
        headerError: string | null;
        inserted: number;
        considered: number;
        errors: { lineNumber: number; reason: string }[];
      }
  >(null);

  async function onFilePicked(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setCsvText(text);
    setCsvResult(null);
  }

  function downloadTemplate() {
    const blob = new Blob([FEED_CSV_TEMPLATE], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "wondavu-feed-template.csv";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function onImportCsv() {
    clearStatus();
    setCsvResult(null);
    if (!csvText.trim()) {
      setError("Paste a CSV or pick a file first.");
      return;
    }
    startTransition(async () => {
      const res = await importFeedPostsCsv(regionId, csvText);
      setCsvResult(res);
      if (res.inserted > 0) {
        // Clear the textarea + file picker on partial / full success so
        // the admin doesn't accidentally re-import the same rows.
        setCsvText("");
        if (fileInputRef.current) fileInputRef.current.value = "";
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Compose form */}
      <section className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-border">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
          New post
        </h2>
        <p className="mt-1 text-xs text-muted">
          Paste an Instagram post URL + the image URL. The image will be
          mirrored to Supabase Storage so the IG CDN can&apos;t expire
          it. Handle and caption are required; everything else is
          optional.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Field label="Handle (without @)" required>
            <input
              type="text"
              value={handle}
              onChange={(e) => setHandle(e.target.value)}
              placeholder="NomadicLena"
              className="admin-input"
            />
          </Field>
          <Field label="Location label">
            <input
              type="text"
              value={locationLabel}
              onChange={(e) => setLocationLabel(e.target.value)}
              placeholder="El Nido, Palawan"
              className="admin-input"
            />
          </Field>
          <Field label="Image URL (any public image; will be mirrored)" required>
            <input
              type="url"
              value={imageUrl}
              onChange={(e) => setImageUrl(e.target.value)}
              placeholder="https://…"
              className="admin-input"
            />
          </Field>
          <Field label="Video URL (optional — IG MP4 / direct MP4)">
            <input
              type="url"
              value={videoUrl}
              onChange={(e) => setVideoUrl(e.target.value)}
              placeholder="https://… .mp4"
              className="admin-input"
            />
          </Field>
          <Field label="Instagram post URL (optional)">
            <input
              type="url"
              value={igPostUrl}
              onChange={(e) => setIgPostUrl(e.target.value)}
              placeholder="https://www.instagram.com/p/…/"
              className="admin-input"
            />
          </Field>
          <Field label="Caption" required className="sm:col-span-2">
            <textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="Lost in the magic of El Nido's hidden lagoons 🛶"
              rows={2}
              className="admin-input"
            />
          </Field>
          <Field label="Likes label (free-form, e.g. 2.4K)">
            <input
              type="text"
              value={likesLabel}
              onChange={(e) => setLikesLabel(e.target.value)}
              placeholder="0"
              className="admin-input"
            />
          </Field>
          <label className="flex items-center gap-2 self-end text-xs font-bold text-muted">
            <input
              type="checkbox"
              checked={verified}
              onChange={(e) => setVerified(e.target.checked)}
              className="h-4 w-4 accent-[var(--color-glow,#f7941d)]"
            />
            Show verified checkmark
          </label>
        </div>

        {error && (
          <p className="mt-3 rounded-lg bg-heat/15 px-3 py-2 text-xs font-semibold text-heat">
            {error}
          </p>
        )}
        {notice && !error && (
          <p className="mt-3 rounded-lg bg-cool/15 px-3 py-2 text-xs font-semibold text-cool">
            {notice}
          </p>
        )}

        <div className="mt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={onSubmit}
            disabled={pending || !handle.trim() || !imageUrl.trim()}
            className="rounded-full bg-sunset px-5 py-2 text-sm font-bold text-white shadow-card hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Posting…" : "Post to feed"}
          </button>
        </div>
      </section>

      {/* CSV bulk upload */}
      <section className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-border">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
            Bulk upload (CSV)
          </h2>
          <button
            type="button"
            onClick={downloadTemplate}
            className="rounded-full bg-foreground/10 px-3 py-1 text-xs font-bold text-foreground hover:bg-foreground/15"
          >
            Download template
          </button>
        </div>
        <p className="mt-1 text-xs text-muted">
          One row = one post. Header columns: <code>handle, caption,
          image_url</code> (required), <code>video_url, location_label,
          ig_post_url, likes_label, verified</code> (optional). Every
          post lands in this region — the CSV has no region column on
          purpose so an upload here can&rsquo;t misroute. Images +
          videos are mirrored to Storage the same way as the manual
          form (videos pass-through, no transcode, 50&nbsp;MB cap).
        </p>

        <div className="mt-3 flex flex-wrap items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={onFilePicked}
            className="block text-xs file:mr-2 file:rounded-full file:border-0 file:bg-foreground/10 file:px-3 file:py-1 file:text-xs file:font-bold file:text-foreground hover:file:bg-foreground/15"
          />
          {csvText && (
            <span className="text-[11px] font-bold text-muted">
              {csvText.split("\n").filter((l) => l.trim().length > 0).length}{" "}
              line(s) loaded
            </span>
          )}
        </div>

        <textarea
          value={csvText}
          onChange={(e) => {
            setCsvText(e.target.value);
            setCsvResult(null);
          }}
          rows={6}
          placeholder="Or paste CSV text here. First row must be the header."
          className="admin-input mt-3 w-full font-mono text-xs"
        />

        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={onImportCsv}
            disabled={pending || !csvText.trim()}
            className="rounded-full bg-sunset px-5 py-2 text-sm font-bold text-white shadow-card hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending ? "Importing…" : "Import CSV"}
          </button>
          {csvText && (
            <button
              type="button"
              onClick={() => {
                setCsvText("");
                setCsvResult(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
              className="rounded-full px-3 py-1 text-xs font-bold text-muted ring-1 ring-border hover:bg-foreground/5"
            >
              Clear
            </button>
          )}
        </div>

        {csvResult && (
          <div className="mt-3 flex flex-col gap-2">
            {csvResult.headerError ? (
              <p className="rounded-lg bg-heat/15 px-3 py-2 text-xs font-semibold text-heat">
                {csvResult.headerError}
              </p>
            ) : (
              <p
                className={`rounded-lg px-3 py-2 text-xs font-semibold ${
                  csvResult.ok
                    ? "bg-cool/15 text-cool"
                    : "bg-heat/15 text-heat"
                }`}
              >
                {csvResult.inserted} of {csvResult.considered} row(s)
                imported
                {csvResult.errors.length > 0
                  ? ` · ${csvResult.errors.length} failed`
                  : ""}
                .
              </p>
            )}
            {csvResult.errors.length > 0 && (
              <ul className="rounded-lg bg-foreground/5 px-3 py-2 text-[11px] text-foreground/80">
                {csvResult.errors.slice(0, 20).map((e) => (
                  <li key={e.lineNumber}>
                    <strong>Row {e.lineNumber}:</strong> {e.reason}
                  </li>
                ))}
                {csvResult.errors.length > 20 && (
                  <li className="italic text-muted">
                    …and {csvResult.errors.length - 20} more.
                  </li>
                )}
              </ul>
            )}
          </div>
        )}
      </section>

      {/* Existing posts list */}
      <section>
        <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">
          Posts in this region ({posts.length})
        </h2>
        {posts.length === 0 ? (
          <p className="rounded-2xl bg-surface px-4 py-8 text-center text-sm text-muted shadow-card ring-1 ring-border">
            No posts yet for this region. Until you add some, /feed
            shows the hand-picked launch seed cards as a placeholder.
          </p>
        ) : (
          <>
            {/* Select-all + bulk-delete bar. Matches the convention used
                by the stays / restaurants / experiences admin lists so
                the same muscle memory works across surfaces. */}
            <div className="mb-2 flex flex-wrap items-center gap-3 px-1">
              <label className="flex items-center gap-2 text-xs font-bold text-muted">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  className="h-4 w-4 accent-[var(--color-glow,#f7941d)]"
                />
                Select all
              </label>
              <span className="text-xs font-semibold text-muted">
                {selected.size > 0
                  ? `${selected.size} selected`
                  : `${posts.length} post${posts.length === 1 ? "" : "s"}`}
              </span>
              {selected.size > 0 && (
                <button
                  type="button"
                  onClick={deleteSelected}
                  disabled={bulkBusy || pending}
                  className="ml-auto rounded-full bg-heat px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-60"
                >
                  {bulkBusy
                    ? "Deleting…"
                    : `Delete ${selected.size} selected`}
                </button>
              )}
            </div>
            <ul className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-border">
            {posts.map((p, i) => (
              <li
                key={p.id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  i > 0 ? "border-t border-border" : ""
                } ${selected.has(p.id) ? "bg-glow/5" : ""}`}
              >
                <input
                  type="checkbox"
                  checked={selected.has(p.id)}
                  onChange={() => toggleOne(p.id)}
                  aria-label={`Select post by @${p.handle}`}
                  className="h-4 w-4 shrink-0 accent-[var(--color-glow,#f7941d)]"
                />
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={p.image_url}
                  alt=""
                  loading="lazy"
                  referrerPolicy="no-referrer"
                  className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-border"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    @{p.handle}
                    {p.verified ? " ✓" : ""}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {p.caption}
                  </span>
                  <span className="block truncate text-[11px] text-muted/80">
                    {p.location_label ?? "—"}
                    {p.ig_post_url ? (
                      <>
                        {" · "}
                        <a
                          href={p.ig_post_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-glow hover:underline"
                        >
                          IG post
                        </a>
                      </>
                    ) : null}
                  </span>
                </span>
                <label className="flex shrink-0 items-center gap-1 text-[11px] font-bold text-muted">
                  Pin
                  <input
                    type="number"
                    defaultValue={p.display_order ?? ""}
                    onBlur={(e) => onPinChange(p.id, e.target.value)}
                    placeholder="—"
                    className="admin-input !w-16 !px-2 !py-1 !text-xs"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => onDelete(p.id)}
                  disabled={pending}
                  className="rounded-full px-3 py-1 text-xs font-bold text-heat ring-1 ring-border hover:bg-heat/10 disabled:opacity-50"
                >
                  Delete
                </button>
              </li>
            ))}
            </ul>
          </>
        )}
      </section>
    </div>
  );
}

function Field({
  label,
  required,
  className,
  children,
}: {
  label: string;
  required?: boolean;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className ?? ""}`}>
      <span className="text-xs font-bold text-muted">
        {label}
        {required ? " *" : ""}
      </span>
      {children}
    </label>
  );
}

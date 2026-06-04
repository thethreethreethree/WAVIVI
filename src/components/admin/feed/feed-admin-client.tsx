"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createFeedPost,
  deleteFeedPost,
  setFeedPostDisplayOrder,
} from "./actions";
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

  // Compose form state ------------------------------------------------
  const [handle, setHandle] = useState("");
  const [caption, setCaption] = useState("");
  const [imageUrl, setImageUrl] = useState("");
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
          <ul className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-border">
            {posts.map((p, i) => (
              <li
                key={p.id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  i > 0 ? "border-t border-border" : ""
                }`}
              >
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

"use client";

import { useState, useTransition } from "react";

import {
  type IgList,
  refreshInstagramPosts,
  saveInstagramPosts,
} from "@/features/instagram/actions";
import { InstagramIcon } from "@/features/instagram/instagram-icon";
import type { InstagramPost } from "@/features/instagram/types";
import { isValidPostUrl } from "@/features/instagram/validation";

/** Each list (Featured / Feed) holds at most 6 posts. */
const MAX_POSTS = 6;

/**
 * Reusable Instagram-post list manager — used twice on the Edit Profile
 * page, once for Featured Travel Moments and once for the Travel Feed.
 * Autosaves to the appropriate column via saveInstagramPosts.
 */
export function InstagramPostManager({
  title = "Featured Travel Posts",
  description = "Showcase a few moments that capture your travel vibe.",
  list = "featured",
  initialPosts = [],
  canPullFromInstagram = false,
}: {
  title?: string;
  description?: string;
  /** Which DB column the manager writes to. */
  list?: IgList;
  initialPosts?: InstagramPost[];
  /** Show the "Pull latest from Instagram" CTA — typically when the user
      has a verified IG handle linked. */
  canPullFromInstagram?: boolean;
}) {
  const [posts, setPosts] = useState<InstagramPost[]>(initialPosts);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [pending, startTransition] = useTransition();

  /** Persist the current list to the DB. */
  function persist(next: InstagramPost[]) {
    startTransition(async () => {
      const res = await saveInstagramPosts(next.map((p) => p.url), list);
      if (res.error) {
        setError(res.error);
        return;
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 1200);
    });
  }

  function add() {
    const url = draft.trim();
    if (!isValidPostUrl(url)) {
      setError("Paste a valid Instagram post or reel link.");
      return;
    }
    if (posts.length >= MAX_POSTS) {
      setError(`You can feature up to ${MAX_POSTS} posts.`);
      return;
    }
    if (posts.some((p) => p.url === url)) {
      setError("That post is already featured.");
      return;
    }
    const next = [
      ...posts,
      {
        id: crypto.randomUUID(),
        url,
        // No thumbnail yet — Pull-from-Instagram fills this on demand,
        // and InstagramThumb renders the brand gradient fallback in
        // the meantime. Used to seed picsum.photos here but those got
        // rate-limited by Vercel's optimizer and broke fresh web
        // visits.
        image: null,
      },
    ];
    setPosts(next);
    setDraft("");
    setError(null);
    persist(next);
  }

  function move(index: number, dir: -1 | 1) {
    const nextIndex = index + dir;
    if (nextIndex < 0 || nextIndex >= posts.length) return;
    const copy = [...posts];
    [copy[index], copy[nextIndex]] = [copy[nextIndex], copy[index]];
    setPosts(copy);
    persist(copy);
  }

  function remove(id: string) {
    const next = posts.filter((p) => p.id !== id);
    setPosts(next);
    persist(next);
  }

  function pullFromInstagram() {
    setError(null);
    startTransition(async () => {
      const res = await refreshInstagramPosts(list);
      if (res.error || res.urls.length === 0) {
        setError(res.error ?? "Couldn't pull posts from Instagram.");
        return;
      }
      const next = res.urls.map((url, i) => ({
        id: `ig-${i}`,
        url,
        // Pull-from-Instagram returned URLs only (no thumbnails in
        // this code path) — InstagramThumb will render the gradient
        // fallback until a real CDN thumb is stored alongside.
        image: null,
      }));
      setPosts(next);
      setSaved(true);
      setTimeout(() => setSaved(false), 1500);
    });
  }

  return (
    <div
      id="travel-posts"
      className="wc-frame scroll-mt-4 rounded-2xl p-4 shadow-card"
    >
      <div className="flex items-center gap-2">
        <InstagramIcon className="h-5 w-5 text-glow" />
        <h3 className="text-sm font-bold">{title}</h3>
        {(pending || saved) && (
          <span
            className={`text-[10px] font-bold ${
              saved ? "text-cool" : "text-muted"
            }`}
          >
            {saved ? "Saved ✓" : "Saving…"}
          </span>
        )}
        <span className="ml-auto text-xs text-muted">
          {posts.length}/{MAX_POSTS}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-muted">{description}</p>

      {canPullFromInstagram && (
        <button
          type="button"
          onClick={pullFromInstagram}
          disabled={pending}
          className="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-glow/40 bg-glow/10 px-4 py-2.5 text-sm font-bold text-glow active:scale-[0.98] disabled:opacity-50"
        >
          <InstagramIcon className="h-4 w-4" />
          {pending ? "Pulling…" : "Pull latest from Instagram"}
        </button>
      )}

      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          placeholder="Paste Instagram post URL"
          className="wc-frame w-full rounded-xl bg-transparent px-3 py-2.5
                     text-sm outline-none focus-visible:border-glow"
        />
        <button
          type="button"
          onClick={add}
          disabled={posts.length >= MAX_POSTS}
          className="bg-sunset shrink-0 rounded-xl px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
        >
          Add
        </button>
      </div>

      {error && <p className="mt-1.5 text-xs text-heat">{error}</p>}

      {posts.length > 0 && (
        <ul className="mt-3 flex flex-col gap-2">
          {posts.map((post, i) => (
            <li
              key={post.id}
              className="wc-frame flex items-center gap-2 rounded-xl p-2"
            >
              <span className="truncate text-xs text-muted">{post.url}</span>
              <span className="ml-auto flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  aria-label="Move up"
                  className="wc-frame flex h-6 w-6 items-center justify-center rounded-md text-muted"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  aria-label="Move down"
                  className="wc-frame flex h-6 w-6 items-center justify-center rounded-md text-muted"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => remove(post.id)}
                  aria-label="Remove"
                  className="flex h-6 w-6 items-center justify-center rounded-md bg-heat/10 text-heat"
                >
                  ×
                </button>
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

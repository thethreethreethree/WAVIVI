"use client";

import { useState } from "react";

import { InstagramIcon } from "@/features/instagram/instagram-icon";
import type { InstagramPost } from "@/features/instagram/types";
import { isValidPostUrl, postShortcode } from "@/features/instagram/validation";
import { photo } from "@/lib/travejor/photo";

const MAX_POSTS = 6;

/**
 * Featured Travel Posts manager — add, remove, and reorder showcase posts
 * in the Edit Profile flow. Stores URLs only; capped at 6.
 */
export function InstagramPostManager({
  initialPosts = [],
}: {
  initialPosts?: InstagramPost[];
}) {
  const [posts, setPosts] = useState<InstagramPost[]>(initialPosts);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);

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
    setPosts((p) => [
      ...p,
      {
        id: crypto.randomUUID(),
        url,
        image: photo(postShortcode(url) ?? url, 240, 240),
      },
    ]);
    setDraft("");
    setError(null);
  }

  function move(index: number, dir: -1 | 1) {
    const next = index + dir;
    if (next < 0 || next >= posts.length) return;
    setPosts((p) => {
      const copy = [...p];
      [copy[index], copy[next]] = [copy[next], copy[index]];
      return copy;
    });
  }

  return (
    <div
      id="travel-posts"
      className="scroll-mt-4 rounded-2xl bg-surface p-4 shadow-card ring-1 ring-border"
    >
      <div className="flex items-center gap-2">
        <InstagramIcon className="h-5 w-5 text-glow" />
        <h3 className="text-sm font-bold">Featured Travel Posts</h3>
        <span className="ml-auto text-xs text-muted">
          {posts.length}/{MAX_POSTS}
        </span>
      </div>
      <p className="mt-0.5 text-xs text-muted">
        Showcase a few moments that capture your travel vibe.
      </p>

      <div className="mt-3 flex gap-2">
        <input
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            setError(null);
          }}
          placeholder="Paste Instagram post URL"
          className="w-full rounded-xl border border-border bg-surface px-3 py-2.5
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
              className="flex items-center gap-2 rounded-xl bg-surface-elevated p-2 ring-1 ring-border"
            >
              <span className="truncate text-xs text-muted">{post.url}</span>
              <span className="ml-auto flex shrink-0 items-center gap-1">
                <button
                  type="button"
                  onClick={() => move(i, -1)}
                  aria-label="Move up"
                  className="flex h-6 w-6 items-center justify-center rounded-md bg-surface text-muted ring-1 ring-border"
                >
                  ↑
                </button>
                <button
                  type="button"
                  onClick={() => move(i, 1)}
                  aria-label="Move down"
                  className="flex h-6 w-6 items-center justify-center rounded-md bg-surface text-muted ring-1 ring-border"
                >
                  ↓
                </button>
                <button
                  type="button"
                  onClick={() => setPosts((p) => p.filter((x) => x.id !== post.id))}
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

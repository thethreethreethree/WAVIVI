"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useTransition } from "react";

import { addDvsComment, deleteDvsComment } from "@/lib/dvs/actions";
import type { DvsCommentDisplay } from "@/lib/dvs/server";

/**
 * Lazy-loaded comments thread under a DVS card.
 *
 * Mounted only when the card's expanded state is `true` (the parent
 * key-mounts this component on expand so the fetch never happens for
 * collapsed cards). Loads the thread once via the server route below,
 * then appends new comments optimistically.
 *
 * Author can soft-delete their own comments via the (×) button next
 * to each row. Admin moderation lives in the admin surface.
 */
export function DvsCommentsThread({
  shareId,
  viewerId,
  viewerUsername,
  viewerAvatarUrl,
}: {
  shareId: string;
  /** Signed-in user id, or null for anonymous viewers (read-only). */
  viewerId: string | null;
  viewerUsername: string | null;
  viewerAvatarUrl: string | null;
}) {
  const [comments, setComments] = useState<DvsCommentDisplay[]>([]);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/dvs/${shareId}/comments`, {
          cache: "no-store",
        });
        const json = (await res.json()) as { comments?: DvsCommentDisplay[] };
        if (!cancelled) setComments(json.comments ?? []);
      } catch {
        if (!cancelled) setError("Couldn't load comments.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shareId]);

  function submit() {
    if (!viewerId) {
      setError("Sign in to comment.");
      return;
    }
    const body = draft.trim();
    if (body.length === 0) return;
    setError(null);
    startTransition(async () => {
      const res = await addDvsComment(shareId, body);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      // Optimistic append using the server-confirmed id. We don't
      // know the exact created_at the DB stamped — render with a
      // local approximation; the next page load reconciles.
      setComments((prev) => [
        ...prev,
        {
          id: res.id,
          shareId,
          authorId: viewerId,
          authorUsername: viewerUsername ?? "you",
          authorDisplayName: viewerUsername ?? "You",
          authorAvatarUrl: viewerAvatarUrl,
          body,
          createdAt: new Date().toISOString(),
        },
      ]);
      setDraft("");
    });
  }

  function remove(commentId: string) {
    setError(null);
    startTransition(async () => {
      const res = await deleteDvsComment(commentId);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setComments((prev) => prev.filter((c) => c.id !== commentId));
    });
  }

  return (
    <div className="mt-3 flex flex-col gap-2 rounded-xl bg-surface-elevated p-3 ring-1 ring-border">
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
        💬 Comments
      </p>

      {loading ? (
        <p className="text-xs text-muted">Loading…</p>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted">
          No comments yet. Be the first to chime in.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {comments.map((c) => (
            <li key={c.id} className="flex items-start gap-2">
              <Link
                href={`/u/${encodeURIComponent(c.authorUsername)}`}
                className="block h-7 w-7 shrink-0 overflow-hidden rounded-full bg-surface"
              >
                {c.authorAvatarUrl ? (
                  <Image
                    src={c.authorAvatarUrl}
                    alt={c.authorDisplayName}
                    width={28}
                    height={28}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <span className="flex h-full w-full items-center justify-center text-xs font-bold text-glow">
                    {c.authorDisplayName.charAt(0).toUpperCase()}
                  </span>
                )}
              </Link>
              <div className="min-w-0 flex-1 rounded-xl bg-surface px-2.5 py-1.5">
                <p className="text-[11px] font-bold leading-tight text-foreground">
                  @{c.authorUsername}
                </p>
                <p className="text-xs leading-snug text-foreground">{c.body}</p>
              </div>
              {viewerId === c.authorId && (
                <button
                  type="button"
                  onClick={() => remove(c.id)}
                  aria-label="Delete comment"
                  className="text-xs text-muted hover:text-heat"
                >
                  ×
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {error && (
        <p className="rounded-lg bg-heat/15 px-2 py-1 text-[11px] font-semibold text-heat">
          {error}
        </p>
      )}

      {viewerId ? (
        <div className="flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 500))}
            placeholder="Reply with a tip or question…"
            disabled={pending}
            className="flex-1 rounded-full bg-surface px-3 py-1.5 text-xs outline-none ring-1 ring-border focus:ring-glow disabled:opacity-50"
            onKeyDown={(e) => {
              if (e.key === "Enter") submit();
            }}
          />
          <button
            type="button"
            onClick={submit}
            disabled={pending || draft.trim().length === 0}
            className="rounded-full bg-sunset px-3 py-1.5 text-xs font-bold text-white disabled:opacity-50"
          >
            Send
          </button>
        </div>
      ) : (
        <p className="text-xs text-muted">
          <Link href="/login" className="font-bold text-glow underline">
            Sign in
          </Link>{" "}
          to add a comment.
        </p>
      )}
    </div>
  );
}

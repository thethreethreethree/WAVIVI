"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { ChatGroupMember } from "@/lib/chat";
import { photoThumb } from "@/lib/utils/images";

/** Per-group member admin table. Featured toggle + kick, both backed by
 *  PATCH/DELETE /api/admin/groups/[id]/members/[userId]. */
export function GroupMembersList({
  groupId,
  members,
}: {
  groupId: string;
  members: ChatGroupMember[];
}) {
  const router = useRouter();
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function setFeatured(userId: string, featured: boolean) {
    setPendingId(userId);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/groups/${groupId}/members/${userId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ featured }),
        },
      );
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(b?.error ?? `Update failed (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
    } finally {
      setPendingId(null);
    }
  }

  async function kick(userId: string, displayName: string) {
    if (
      !window.confirm(
        `Remove ${displayName} from this group? They can rejoin later.`,
      )
    ) {
      return;
    }
    setPendingId(userId);
    setError(null);
    try {
      const res = await fetch(
        `/api/admin/groups/${groupId}/members/${userId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(b?.error ?? `Kick failed (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Kick failed.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {error && (
        <p className="rounded-lg bg-heat/15 px-3 py-2 text-xs font-semibold text-heat">
          {error}
        </p>
      )}
      {members.length === 0 ? (
        <p className="rounded-2xl bg-surface px-4 py-8 text-center text-sm text-muted shadow-card ring-1 ring-border">
          No members yet.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-border">
          {members.map((m, i) => {
            const busy = pendingId === m.user_id;
            return (
              <li
                key={m.user_id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  i > 0 ? "border-t border-border" : ""
                } ${m.featured ? "bg-glow/5" : ""}`}
              >
                {m.avatar_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={photoThumb(m.avatar_url, 96)}
                    alt=""
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    className="h-10 w-10 shrink-0 rounded-full object-cover ring-1 ring-border"
                  />
                ) : (
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-background text-sm font-bold text-glow ring-1 ring-border">
                    {m.display_name.slice(0, 1).toUpperCase()}
                  </span>
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {m.display_name}
                    {m.featured && (
                      <span className="ml-1.5 rounded-full bg-glow/15 px-1.5 py-0.5 text-[10px] font-bold text-glow">
                        ⭐ featured
                      </span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    <Link
                      href={`/u/${m.username}`}
                      target="_blank"
                      className="font-semibold hover:underline"
                    >
                      @{m.username}
                    </Link>
                    {m.home_country ? ` · ${m.home_country}` : ""}
                    {m.bio ? ` · ${m.bio}` : ""}
                  </span>
                </span>
                <span className="flex shrink-0 flex-col gap-1">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setFeatured(m.user_id, !m.featured)}
                    className="rounded-full px-3 py-1 text-xs font-bold text-glow ring-1 ring-border hover:bg-glow/5 disabled:opacity-60"
                  >
                    {m.featured ? "Unfeature" : "Feature"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => kick(m.user_id, m.display_name)}
                    className="rounded-full px-3 py-1 text-xs font-bold text-heat ring-1 ring-border hover:bg-heat/10 disabled:opacity-60"
                  >
                    {busy ? "…" : "Kick"}
                  </button>
                </span>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

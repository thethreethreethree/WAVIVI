"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { GroupEditor } from "./group-editor";
import type { AdminChatGroup } from "@/lib/chat";
import { photoThumb } from "@/lib/utils/images";

type StateFilter = "all" | "featured" | "archived" | "active";

/** Filterable list of every chat group, with create / edit / feature /
 *  archive / delete actions and per-row links into the member manager. */
export function GroupsList({ groups }: { groups: AdminChatGroup[] }) {
  const router = useRouter();
  const [stateFilter, setStateFilter] = useState<StateFilter>("active");
  const [categoryFilter, setCategoryFilter] = useState<string | "all">("all");
  const [editing, setEditing] = useState<AdminChatGroup | null>(null);
  const [creating, setCreating] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const categories = useMemo(() => {
    const c = new Map<string, number>();
    for (const g of groups) {
      const key = g.category || "—";
      c.set(key, (c.get(key) ?? 0) + 1);
    }
    return Array.from(c.entries()).sort((a, b) => b[1] - a[1]);
  }, [groups]);

  const visible = useMemo(
    () =>
      groups.filter((g) => {
        if (stateFilter === "featured" && !g.featured) return false;
        if (stateFilter === "archived" && !g.archived) return false;
        if (stateFilter === "active" && g.archived) return false;
        if (
          categoryFilter !== "all" &&
          (g.category || "—") !== categoryFilter
        ) {
          return false;
        }
        return true;
      }),
    [groups, stateFilter, categoryFilter],
  );

  /** Generic PATCH wrapper used by the feature / archive toggles. */
  async function patch(g: AdminChatGroup, body: Record<string, unknown>) {
    setPendingId(g.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/groups/${g.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
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

  async function remove(g: AdminChatGroup) {
    if (
      !window.confirm(
        `Delete "${g.name}"? Cascades to ${g.member_count} members + all messages. This cannot be undone.`,
      )
    ) {
      return;
    }
    setPendingId(g.id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/groups/${g.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(b?.error ?? `Delete failed (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
    } finally {
      setPendingId(null);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Group chats</h1>
          <p className="text-sm text-muted">
            {groups.length} total · {groups.filter((g) => !g.archived).length} active
            · {groups.filter((g) => g.featured).length} featured
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="rounded-full bg-sunset px-4 py-2 text-sm font-bold text-white"
        >
          + New group
        </button>
      </div>

      {/* State filter — Active by default so admins don't see archived noise. */}
      <div className="flex gap-1.5">
        {(
          [
            ["active", "Active"],
            ["featured", "Featured"],
            ["archived", "Archived"],
            ["all", "All"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            onClick={() => setStateFilter(id)}
            className={`rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
              stateFilter === id
                ? "bg-sunset text-white"
                : "text-muted ring-1 ring-border hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Category chips */}
      <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <Chip
          active={categoryFilter === "all"}
          onClick={() => setCategoryFilter("all")}
          label="All categories"
          count={groups.length}
        />
        {categories.map(([cat, count]) => (
          <Chip
            key={cat}
            active={categoryFilter === cat}
            onClick={() => setCategoryFilter(cat)}
            label={cat}
            count={count}
          />
        ))}
      </div>

      {error && (
        <p className="rounded-lg bg-heat/15 px-3 py-2 text-xs font-semibold text-heat">
          {error}
        </p>
      )}

      {visible.length === 0 ? (
        <p className="rounded-2xl bg-surface px-4 py-8 text-center text-sm text-muted shadow-card ring-1 ring-border">
          No groups match these filters.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {visible.map((g) => {
            const busy = pendingId === g.id;
            return (
              <li
                key={g.id}
                className={`rounded-2xl bg-surface p-3.5 shadow-card ring-1 ring-border transition-opacity ${
                  g.archived ? "opacity-60" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  {g.cover_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={photoThumb(g.cover_image, 96)}
                      alt=""
                      loading="lazy"
                      className="h-12 w-12 shrink-0 rounded-xl object-cover ring-1 ring-border"
                    />
                  ) : (
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-background text-lg">
                      💬
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-bold">{g.name}</p>
                      {g.featured && (
                        <span className="rounded-full bg-glow/15 px-1.5 py-0.5 text-[10px] font-bold text-glow">
                          ⭐ featured
                        </span>
                      )}
                      {g.archived && (
                        <span className="rounded-full bg-foreground/10 px-1.5 py-0.5 text-[10px] font-bold text-muted">
                          archived
                        </span>
                      )}
                    </div>
                    <p className="truncate text-xs text-muted">
                      <code className="rounded bg-background px-1 text-[10px]">
                        {g.id}
                      </code>{" "}
                      ·{" "}
                      {[
                        g.category,
                        `${g.member_count} traveler${g.member_count === 1 ? "" : "s"}`,
                        [g.destination_city, g.destination_country]
                          .filter(Boolean)
                          .join(", ") || null,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </p>
                    {g.description && (
                      <p className="mt-1 line-clamp-2 text-xs text-foreground/80">
                        {g.description}
                      </p>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => patch(g, { featured: !g.featured })}
                    className="rounded-full px-3 py-1.5 text-xs font-bold text-glow ring-1 ring-border hover:bg-glow/5 disabled:opacity-60"
                  >
                    {g.featured ? "Unfeature" : "Feature"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => patch(g, { archived: !g.archived })}
                    className={`rounded-full px-3 py-1.5 text-xs font-bold ring-1 ring-border disabled:opacity-60 ${
                      g.archived
                        ? "text-cool hover:bg-cool/10"
                        : "text-foreground hover:bg-foreground/5"
                    }`}
                  >
                    {g.archived ? "Restore" : "Archive"}
                  </button>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => setEditing(g)}
                    className="rounded-full px-3 py-1.5 text-xs font-bold text-muted ring-1 ring-border hover:text-foreground"
                  >
                    Edit
                  </button>
                  <Link
                    href={`/admin/groups/${g.id}`}
                    className="rounded-full px-3 py-1.5 text-xs font-bold text-muted ring-1 ring-border hover:text-foreground"
                  >
                    Manage members ({g.member_count})
                  </Link>
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => remove(g)}
                    className="ml-auto rounded-full px-3 py-1.5 text-xs font-bold text-heat ring-1 ring-border hover:bg-heat/10 disabled:opacity-60"
                  >
                    {busy ? "…" : "Delete"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {(editing || creating) && (
        <GroupEditor
          group={editing}
          onClose={() => {
            setEditing(null);
            setCreating(false);
          }}
        />
      )}
    </div>
  );
}

function Chip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-bold transition-colors ${
        active
          ? "bg-sunset text-white"
          : "text-muted ring-1 ring-border hover:text-foreground"
      }`}
    >
      {label}
      <span
        className={`rounded-full px-1.5 text-[10px] font-extrabold ${
          active ? "bg-white/25" : "bg-border"
        }`}
      >
        {count}
      </span>
    </button>
  );
}

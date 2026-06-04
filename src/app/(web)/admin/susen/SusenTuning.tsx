"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import type { SusenDevNote } from "@/lib/susen/tuning";

/**
 * Tuning console for /admin/susen.
 *
 * - Add rule: hand-write a live instruction (steers every reply immediately).
 * - Live rules: what's injected right now — retire (stop injecting) or delete.
 * - Recent chats: the capture log — promote a turn to a live rule, or delete.
 *
 * Every action hits /api/admin/susen/notes and router.refresh()es so the
 * lists stay in sync. Server enforces admin; this is just the surface.
 */
export function SusenTuning({
  liveRules,
  captures,
}: {
  liveRules: SusenDevNote[];
  captures: SusenDevNote[];
}) {
  const router = useRouter();
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const patch = async (
    id: string,
    flags: { active?: boolean; is_instruction?: boolean; applied?: boolean },
  ) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/susen/notes/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(flags),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (id: string) => {
    if (!confirm("Delete this entry from the log? This can't be undone.")) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/susen/notes/${id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusyId(null);
    }
  };

  const addRule = async () => {
    const message = draft.trim();
    if (!message) return;
    setAdding(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/susen/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ message }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      setDraft("");
      router.refresh();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setAdding(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      {error ? (
        <p className="rounded-xl bg-heat/10 px-3 py-2 text-xs font-medium text-heat">
          {error}
        </p>
      ) : null}

      {/* Add a rule */}
      <section className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-border">
        <h2 className="text-sm font-bold">Add a rule</h2>
        <p className="mt-0.5 text-xs text-muted">
          A live instruction that shapes every reply — e.g.{" "}
          <span className="italic">
            “Always suggest a meetup when you recommend a bar.”
          </span>{" "}
          Takes effect on her next message.
        </p>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          rows={2}
          maxLength={500}
          placeholder="Always / Never / From now on…"
          className="mt-3 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sunset/40"
        />
        <div className="mt-2 flex items-center justify-between">
          <span className="text-[11px] text-muted">{draft.length}/500</span>
          <button
            type="button"
            onClick={addRule}
            disabled={adding || draft.trim().length === 0}
            className="rounded-full bg-sunset px-4 py-1.5 text-xs font-bold text-white hover:bg-sunset/90 disabled:opacity-50"
          >
            {adding ? "Adding…" : "Add rule"}
          </button>
        </div>
      </section>

      {/* Live rules */}
      <section>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-bold">
          Live rules
          <span className="rounded-full bg-glow/15 px-2 py-0.5 text-[10px] font-bold text-glow">
            steering every reply now · {liveRules.length}
          </span>
        </h2>
        {liveRules.length === 0 ? (
          <p className="rounded-2xl bg-surface px-4 py-6 text-center text-xs text-muted shadow-card ring-1 ring-border">
            No active rules — she’s running on her default persona.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {liveRules.map((r) => (
              <li
                key={r.id}
                className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-glow/30"
              >
                <p className="text-sm font-medium">{r.message}</p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="truncate text-[11px] text-muted">
                    {r.author ?? "unknown"} · {r.created_at.slice(0, 10)}
                    {r.source ? ` · ${r.source}` : ""}
                  </span>
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      onClick={() => patch(r.id, { active: false })}
                      disabled={busyId === r.id}
                      className="rounded-full bg-foreground/10 px-3 py-1 text-[11px] font-bold text-foreground hover:bg-foreground/15 disabled:opacity-50"
                    >
                      {busyId === r.id ? "…" : "Retire"}
                    </button>
                    <button
                      type="button"
                      onClick={() => remove(r.id)}
                      disabled={busyId === r.id}
                      className="rounded-full px-2 py-1 text-[11px] font-bold text-heat hover:bg-heat/10 disabled:opacity-50"
                      aria-label="Delete"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Recent captures (the log) */}
      <section>
        <h2 className="mb-2 text-sm font-bold">
          Recent chats{" "}
          <span className="font-normal text-muted">
            — captured for the log; promote any to a live rule
          </span>
        </h2>
        {captures.length === 0 ? (
          <p className="rounded-2xl bg-surface px-4 py-6 text-center text-xs text-muted shadow-card ring-1 ring-border">
            No captured chats yet.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-border">
            {captures.map((n, i) => (
              <li
                key={n.id}
                className={`flex items-start gap-3 px-4 py-3 ${
                  i > 0 ? "border-t border-border" : ""
                }`}
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm">{n.message}</p>
                  {n.susen_reply ? (
                    <p className="mt-0.5 line-clamp-2 text-[11px] text-muted">
                      ↳ {n.susen_reply}
                    </p>
                  ) : null}
                  <span className="mt-1 block text-[11px] text-muted">
                    {n.author ?? "unknown"} · {n.created_at.slice(0, 10)}
                    {n.source ? ` · ${n.source}` : ""}
                  </span>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  <button
                    type="button"
                    onClick={() =>
                      patch(n.id, { is_instruction: true, active: true })
                    }
                    disabled={busyId === n.id}
                    className="rounded-full bg-glow/15 px-3 py-1 text-[11px] font-bold text-glow hover:bg-glow/25 disabled:opacity-50"
                  >
                    {busyId === n.id ? "…" : "Make live rule"}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(n.id)}
                    disabled={busyId === n.id}
                    className="rounded-full px-2 py-0.5 text-[11px] font-bold text-heat hover:bg-heat/10 disabled:opacity-50"
                    aria-label="Delete"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

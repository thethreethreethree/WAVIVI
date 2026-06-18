"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import type {
  DupCandidate,
  DupGroup,
} from "@/lib/data-quality/dup-maps-audit";

import { dedupKeepOneAction } from "./audit-actions";

const SOURCE_LABEL: Record<DupCandidate["source"], string> = {
  stays: "Stays",
  restaurants: "Restaurants",
  experiences: "Experiences",
  traveler_utilities: "Utilities",
};

/**
 * Inline triage of duplicate-maps-URL groups. Server returned the
 * groups already pre-sorted (cross-table first, then by group size);
 * inside a group rows come "most enriched" first. The admin picks
 * which row to KEEP — the others get retired (active=false for
 * places, hard-delete for utilities).
 *
 * Acts on one group at a time so a misclick doesn't cascade.
 * Re-fetches the canonical group from the server inside
 * dedupKeepOneAction so the apply is always consistent with the live
 * DB rather than the (possibly stale) client view.
 */
export function DupMapsClient({ groups }: { groups: DupGroup[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busyUrl, setBusyUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Limit DOM size to keep the page responsive — 903 groups across
  // 100s of rows each would otherwise render a huge tree.
  const PAGE = 30;
  const [shown, setShown] = useState(PAGE);

  const crossTableCount = groups.filter(
    (g) => new Set(g.rows.map((r) => r.source)).size > 1,
  ).length;

  function retire(url: string, keepId: string, total: number) {
    if (
      !window.confirm(
        `Keep this row and retire ${total - 1} other(s) sharing the same Google Maps URL?`,
      )
    ) {
      return;
    }
    setBusyUrl(url);
    setError(null);
    startTransition(async () => {
      const res = await dedupKeepOneAction(url, keepId);
      if (!res.ok) setError(res.error ?? "Action failed.");
      setBusyUrl(null);
      router.refresh();
    });
  }

  return (
    <section className="flex flex-col gap-4">
      <header>
        <h2 className="text-lg font-bold tracking-tight">
          Duplicate Google Maps URLs
        </h2>
        <p className="mt-1 text-sm text-muted">
          Each group shares the same <code>google_maps_url</code> — same
          CID, same physical venue. Within-group sort is
          &ldquo;most-enriched first&rdquo; (channels desc, then
          reviews). Pick the row to keep and retire the rest. Places get{" "}
          <code>active=false</code>; utilities are hard-deleted (no
          active flag on that table). Cross-table groups (one place in
          two buckets) float to the top.
        </p>
      </header>

      <div className="rounded-2xl bg-glow p-4 text-white shadow-card">
        <p className="text-xs font-bold uppercase tracking-wider text-white/80">
          Summary
        </p>
        <div className="mt-3 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
          <div>
            <p className="text-lg font-bold">{groups.length}</p>
            <p className="text-[10px] text-white/85">Duplicate groups</p>
          </div>
          <div>
            <p className="text-lg font-bold">{crossTableCount}</p>
            <p className="text-[10px] text-white/85">Cross-table</p>
          </div>
          <div>
            <p className="text-lg font-bold">
              {groups.reduce((n, g) => n + g.rows.length, 0)}
            </p>
            <p className="text-[10px] text-white/85">Rows in groups</p>
          </div>
          <div>
            <p className="text-lg font-bold">
              {groups.reduce((n, g) => n + g.rows.length - 1, 0)}
            </p>
            <p className="text-[10px] text-white/85">Retirable</p>
          </div>
        </div>
      </div>

      {error ? (
        <div className="rounded-2xl bg-heat/10 p-3 text-xs font-medium text-heat ring-1 ring-heat/30">
          {error}
        </div>
      ) : null}

      <ul className="flex flex-col gap-3">
        {groups.slice(0, shown).map((g) => {
          const tables = new Set(g.rows.map((r) => r.source));
          return (
            <li
              key={g.url}
              className="rounded-2xl bg-surface p-3 shadow-card ring-1 ring-border"
            >
              <div className="flex flex-wrap items-center gap-2 text-[11px]">
                <span className="rounded-full bg-foreground/10 px-2 py-0.5 font-bold">
                  {g.rows.length} rows
                </span>
                {tables.size > 1 ? (
                  <span className="rounded-full bg-heat/15 px-2 py-0.5 font-bold text-heat">
                    cross-table ({tables.size})
                  </span>
                ) : null}
                <a
                  href={g.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="truncate text-muted underline-offset-2 hover:underline"
                  title={g.url}
                >
                  {g.url.slice(0, 90)}…
                </a>
              </div>
              <ul className="mt-2 flex flex-col gap-1">
                {g.rows.map((r, i) => (
                  <li
                    key={`${r.source}:${r.id}`}
                    className={`flex items-center justify-between gap-2 rounded-xl px-2 py-1.5 text-xs ${
                      i === 0 ? "bg-glow/10 ring-1 ring-glow/30" : ""
                    }`}
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      <span className="shrink-0 rounded-full bg-foreground/10 px-2 py-0.5 text-[10px] font-bold">
                        {SOURCE_LABEL[r.source]}
                      </span>
                      <span className="truncate font-medium">{r.name}</span>
                      <span className="hidden shrink-0 text-[10px] text-muted sm:inline">
                        {r.channelCount} ch
                        {r.reviewCount != null
                          ? ` · ${r.reviewCount} reviews`
                          : ""}
                        {!r.active ? " · inactive" : ""}
                      </span>
                    </span>
                    {i === 0 ? (
                      <button
                        type="button"
                        onClick={() => retire(g.url, r.id, g.rows.length)}
                        disabled={pending && busyUrl === g.url}
                        className="shrink-0 rounded-full bg-sunset px-3 py-1 text-[10px] font-bold text-white hover:bg-sunset/90 disabled:opacity-50"
                      >
                        {pending && busyUrl === g.url
                          ? "Retiring…"
                          : `↓ Keep — retire ${g.rows.length - 1}`}
                      </button>
                    ) : (
                      <span className="shrink-0 text-[10px] text-muted">
                        will retire
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>

      {shown < groups.length ? (
        <button
          type="button"
          onClick={() => setShown((s) => s + PAGE)}
          className="self-center rounded-full bg-foreground/10 px-4 py-1.5 text-xs font-bold text-foreground hover:bg-foreground/15"
        >
          Show {Math.min(PAGE, groups.length - shown)} more
        </button>
      ) : null}
    </section>
  );
}

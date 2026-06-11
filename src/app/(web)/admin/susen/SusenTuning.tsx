"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import type {
  ReviewMarker,
  ScopeType,
  SusenDevNote,
} from "@/lib/susen/tuning";

/** Props for the location dropdowns, shaped by the parent page. */
export interface ScopeRegion {
  id: string;
  displayName: string;
  country: string | null;
}
export interface ScopeCity {
  id: string;
  name: string;
  regionId: string;
}

const SCOPE_OPTIONS: { value: ScopeType; label: string; hint: string }[] = [
  {
    value: "general",
    label: "General",
    hint: "Steers every reply, everywhere.",
  },
  {
    value: "country",
    label: "Country",
    hint: "Fires when the query / session resolves to this country.",
  },
  {
    value: "region",
    label: "Region",
    hint: "Fires for one region (e.g. El Nido + its cities).",
  },
  {
    value: "city",
    label: "City",
    hint: "Most specific — fires only for queries about this city.",
  },
];

/** Small chip describing a rule's scope on the live-rules list. */
function ScopeBadge({ note }: { note: SusenDevNote }) {
  const label = (() => {
    switch (note.scope_type) {
      case "city":
        return `🏙 city`;
      case "region":
        return `📍 region`;
      case "country":
        return `🌍 ${note.country ?? "country"}`;
      case "general":
      default:
        return "● general";
    }
  })();
  const tone =
    note.scope_type === "general"
      ? "bg-foreground/10 text-foreground"
      : note.scope_type === "country"
        ? "bg-cool/15 text-cool"
        : note.scope_type === "region"
          ? "bg-sunset/15 text-sunset"
          : "bg-heat/15 text-heat";
  return (
    <span
      className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${tone}`}
    >
      {label}
    </span>
  );
}

/** Trigger pills next to a rule, "always fires" tone when none set. */
function TriggerPills({ triggers }: { triggers: string[] | null }) {
  const trigs = triggers ?? [];
  if (trigs.length === 0) {
    return (
      <span className="shrink-0 rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] text-muted">
        always fires
      </span>
    );
  }
  return (
    <span className="flex flex-wrap gap-1">
      {trigs.slice(0, 6).map((t) => (
        <span
          key={t}
          className="rounded-full bg-glow/10 px-2 py-0.5 text-[10px] font-medium text-glow"
        >
          {t}
        </span>
      ))}
      {trigs.length > 6 ? (
        <span className="rounded-full bg-foreground/5 px-2 py-0.5 text-[10px] text-muted">
          +{trigs.length - 6}
        </span>
      ) : null}
    </span>
  );
}

/** Pull DeepSeek's real token counts out of the namespaced tags written by
 *  captureAdminTurn (tok / in / out / cache). Returns null for older rows
 *  captured before token instrumentation shipped. */
function tokensFromTags(tags: string[] | null): {
  total: number | null;
  input: number | null;
  output: number | null;
  cacheHit: number | null;
} | null {
  if (!tags || tags.length === 0) return null;
  const get = (p: string): number | null => {
    const hit = tags.find((x) => x.startsWith(`${p}:`));
    if (!hit) return null;
    const n = Number(hit.slice(p.length + 1));
    return Number.isFinite(n) ? n : null;
  };
  const total = get("tok");
  const input = get("in");
  const output = get("out");
  if (total == null && input == null && output == null) return null;
  return { total, input, output, cacheHit: get("cache") };
}

/** Small "1,643 tok" pill for one captured turn; hover shows in/out/cached. */
function TokenBadge({ tags }: { tags: string[] | null }) {
  const u = tokensFromTags(tags);
  if (!u) return null;
  const total = u.total ?? (u.input ?? 0) + (u.output ?? 0);
  const detail = [
    u.input != null ? `${u.input.toLocaleString()} in` : null,
    u.output != null ? `${u.output.toLocaleString()} out` : null,
    u.cacheHit != null ? `${u.cacheHit.toLocaleString()} cached` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  return (
    <span
      title={detail || undefined}
      className="shrink-0 rounded-full bg-cool/15 px-2 py-0.5 text-[10px] font-bold text-cool"
    >
      {total.toLocaleString()} tok
    </span>
  );
}

/** 🚩/🔥 review-marker pills (set from chat: "flag" / "fire response susen"). */
function MarkerBadges({ tags }: { tags: string[] | null }) {
  const t = tags ?? [];
  return (
    <>
      {t.includes("flag") ? (
        <span className="shrink-0 rounded-full bg-heat/15 px-2 py-0.5 text-[10px] font-bold text-heat">
          🚩 flagged
        </span>
      ) : null}
      {t.includes("fire") ? (
        <span className="shrink-0 rounded-full bg-sunset/15 px-2 py-0.5 text-[10px] font-bold text-sunset">
          🔥 fire
        </span>
      ) : null}
    </>
  );
}

const FILTERS: { key: ReviewMarker | null; label: string; href: string }[] = [
  { key: null, label: "All", href: "/admin/susen" },
  { key: "flag", label: "🚩 Flagged", href: "/admin/susen?filter=flag" },
  { key: "fire", label: "🔥 Fire", href: "/admin/susen?filter=fire" },
];

/**
 * Tuning console for /admin/susen.
 *
 * - Add rule: hand-write a live instruction (steers every reply immediately).
 * - Live rules: what's injected right now — retire (stop injecting) or delete.
 * - Recent chats: the capture log — promote a turn to a live rule, or delete.
 *   Filterable to 🚩 flagged / 🔥 fire turns (markers set from chat); clear a
 *   marker once reviewed.
 *
 * Every action hits /api/admin/susen/notes and router.refresh()es so the
 * lists stay in sync. Server enforces admin; this is just the surface.
 */
export function SusenTuning({
  liveRules,
  captures,
  activeFilter,
  regions,
  cities,
  countries,
}: {
  liveRules: SusenDevNote[];
  captures: SusenDevNote[];
  activeFilter: ReviewMarker | null;
  regions: ScopeRegion[];
  cities: ScopeCity[];
  countries: string[];
}) {
  const router = useRouter();
  // Form state — "Create a Rule" panel is hidden until the admin opens
  // it so the page reads as "review existing rules" by default.
  const [formOpen, setFormOpen] = useState(false);
  const [scope, setScope] = useState<ScopeType>("general");
  const [country, setCountry] = useState("");
  const [regionId, setRegionId] = useState("");
  const [cityId, setCityId] = useState("");
  const [triggersText, setTriggersText] = useState("");
  const [draft, setDraft] = useState("");
  const [adding, setAdding] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // City dropdown filters by selected region — picking El Nido (Region)
  // narrows the City list to El Nido cities only. If the admin picks a
  // city whose region we know, auto-set the region too.
  const filteredCities = useMemo(() => {
    if (scope !== "city" || !regionId) return cities;
    return cities.filter((c) => c.regionId === regionId);
  }, [scope, cities, regionId]);

  // When the selected region changes, drop the city pick if it isn't
  // a child of the new region.
  function onRegionChange(next: string) {
    setRegionId(next);
    if (next && !cities.some((c) => c.id === cityId && c.regionId === next)) {
      setCityId("");
    }
    // Auto-fill country from the region so a Country rule scoped via
    // region context lands with the right country string.
    const r = regions.find((rr) => rr.id === next);
    if (r?.country) setCountry(r.country);
  }
  // When the selected city changes, lock the region to that city's parent
  // and auto-fill country.
  function onCityChange(next: string) {
    setCityId(next);
    const c = cities.find((cc) => cc.id === next);
    if (c) {
      setRegionId(c.regionId);
      const r = regions.find((rr) => rr.id === c.regionId);
      if (r?.country) setCountry(r.country);
    }
  }

  function resetForm() {
    setScope("general");
    setCountry("");
    setRegionId("");
    setCityId("");
    setTriggersText("");
    setDraft("");
  }

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

  const clearMarker = async (id: string, marker: ReviewMarker) => {
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(`/api/admin/susen/notes/${id}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ clearMarker: marker }),
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
    // Client-side scope validation mirrors the API route so the
    // admin sees the error inline instead of after a round-trip.
    if (scope === "country" && !country.trim()) {
      setError("Pick a country for a Country-scope rule.");
      return;
    }
    if ((scope === "region" || scope === "city") && !regionId) {
      setError("Pick a region for a Region/City-scope rule.");
      return;
    }
    if (scope === "city" && !cityId) {
      setError("Pick a city for a City-scope rule.");
      return;
    }
    setAdding(true);
    setError(null);
    try {
      const triggers = triggersText
        .split(/[,\n]/)
        .map((t) => t.trim())
        .filter(Boolean);
      const res = await fetch("/api/admin/susen/notes", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          message,
          scope,
          country: country.trim() || null,
          regionId: regionId || null,
          cityId: cityId || null,
          triggers: triggers.length > 0 ? triggers : null,
        }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? res.statusText);
      resetForm();
      setFormOpen(false);
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

      {/* Create a Rule — scope-aware authoring panel.
          Collapsed by default so the page reads as "review existing
          rules" first. Each scope picks up a different conditional
          location dropdown (none for General, country dropdown for
          Country, region dropdown for Region, region+city for City).
          Triggers are optional keywords that gate which queries
          activate the rule — blank means "always fire in scope". */}
      <section className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-border">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-sm font-bold">Create a Rule</h2>
            <p className="mt-0.5 text-xs text-muted">
              These rules are Susen&apos;s{" "}
              <strong className="text-foreground">primary</strong> source for
              the topics they cover — she will follow the rule&apos;s
              structure, ordering, and named venues over her general training.
              Scope the rule so it only fires where it&apos;s relevant.
            </p>
          </div>
          {!formOpen ? (
            <button
              type="button"
              onClick={() => setFormOpen(true)}
              className="shrink-0 rounded-full bg-sunset px-4 py-1.5 text-xs font-bold text-white hover:bg-sunset/90"
            >
              + Create a Rule
            </button>
          ) : (
            <button
              type="button"
              onClick={() => {
                setFormOpen(false);
                resetForm();
                setError(null);
              }}
              className="shrink-0 rounded-full bg-foreground/10 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-foreground/15"
            >
              Cancel
            </button>
          )}
        </div>

        {formOpen ? (
          <div className="mt-4 flex flex-col gap-4">
            {/* Scope picker — 4 radios as pill buttons. */}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Scope
              </span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {SCOPE_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setScope(o.value)}
                    className={`rounded-full px-3 py-1 text-xs font-bold transition-colors ${
                      scope === o.value
                        ? "bg-sunset text-white"
                        : "bg-background text-foreground ring-1 ring-border hover:bg-foreground/5"
                    }`}
                    title={o.hint}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
              <p className="mt-1 text-[11px] text-muted">
                {SCOPE_OPTIONS.find((o) => o.value === scope)?.hint}
              </p>
            </div>

            {/* Conditional location picker. */}
            {scope === "country" ? (
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Country
                </label>
                <select
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sunset/40"
                >
                  <option value="">Pick a country…</option>
                  {countries.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {scope === "region" ? (
              <div>
                <label className="text-[11px] font-bold uppercase tracking-wider text-muted">
                  Region
                </label>
                <select
                  value={regionId}
                  onChange={(e) => onRegionChange(e.target.value)}
                  className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sunset/40"
                >
                  <option value="">Pick a region…</option>
                  {regions.map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.displayName}
                      {r.country ? ` — ${r.country}` : ""}
                    </option>
                  ))}
                </select>
              </div>
            ) : null}

            {scope === "city" ? (
              <div className="flex flex-col gap-3 sm:flex-row">
                <div className="flex-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted">
                    Parent region
                  </label>
                  <select
                    value={regionId}
                    onChange={(e) => onRegionChange(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sunset/40"
                  >
                    <option value="">Pick a region…</option>
                    {regions.map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.displayName}
                        {r.country ? ` — ${r.country}` : ""}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="flex-1">
                  <label className="text-[11px] font-bold uppercase tracking-wider text-muted">
                    City
                  </label>
                  <select
                    value={cityId}
                    onChange={(e) => onCityChange(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sunset/40"
                  >
                    <option value="">
                      {regionId ? "Pick a city…" : "Pick a region first…"}
                    </option>
                    {filteredCities.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            ) : null}

            {/* Triggers — comma-separated keywords. Blank = always fire. */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Trigger keywords (optional)
              </label>
              <input
                type="text"
                value={triggersText}
                onChange={(e) => setTriggersText(e.target.value)}
                placeholder="e.g. vibe, nightlife, bar, where to drink"
                className="mt-1.5 w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sunset/40"
              />
              <p className="mt-1 text-[11px] text-muted">
                Comma-separated. The rule fires only when the user&apos;s
                message contains one of these as a substring. Leave blank to
                fire on every in-scope question.
              </p>
            </div>

            {/* Rule body — the long-form guidance Susen reproduces. */}
            <div>
              <label className="text-[11px] font-bold uppercase tracking-wider text-muted">
                Rule body
              </label>
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                rows={6}
                maxLength={2000}
                placeholder="El Nido's nightlife revolves around Frendz, Hub, Pangolin, Amigos, Rooftop Bar, and Kuridas. In order of time, everyone starts at Frendz from 8pm-9pm..."
                className="mt-1.5 w-full resize-none rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-sunset/40"
              />
              <div className="mt-1 flex items-center justify-between">
                <span className="text-[11px] text-muted">
                  {draft.length}/2000
                </span>
                <button
                  type="button"
                  onClick={addRule}
                  disabled={adding || draft.trim().length === 0}
                  className="rounded-full bg-sunset px-4 py-1.5 text-xs font-bold text-white hover:bg-sunset/90 disabled:opacity-50"
                >
                  {adding ? "Creating…" : "Create rule"}
                </button>
              </div>
            </div>
          </div>
        ) : null}
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
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                  <ScopeBadge note={r} />
                  <TriggerPills triggers={r.triggers} />
                </div>
                <p className="text-sm font-medium whitespace-pre-wrap">
                  {r.message}
                </p>
                <div className="mt-2 flex items-center justify-between gap-3">
                  <span className="flex min-w-0 items-center gap-2 text-[11px] text-muted">
                    <span className="truncate">
                      {r.author ?? "unknown"} · {r.created_at.slice(0, 10)}
                      {r.source ? ` · ${r.source}` : ""}
                    </span>
                    <TokenBadge tags={r.tags} />
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

      {/* Recent captures (the log) — filterable to flagged / fire turns */}
      <section>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-bold">
            {activeFilter === "flag"
              ? "🚩 Flagged messages"
              : activeFilter === "fire"
                ? "🔥 Fire responses"
                : "Recent chats"}
            {activeFilter ? null : (
              <span className="font-normal text-muted">
                {" "}
                — captured for the log; promote any to a live rule
              </span>
            )}
          </h2>
          <div className="flex items-center gap-0.5 rounded-full bg-background p-0.5 text-[11px] font-bold ring-1 ring-border">
            {FILTERS.map((f) => (
              <Link
                key={f.label}
                href={f.href}
                scroll={false}
                className={`rounded-full px-2.5 py-0.5 transition-colors ${
                  activeFilter === f.key
                    ? "bg-sunset text-white"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {f.label}
              </Link>
            ))}
          </div>
        </div>
        {captures.length === 0 ? (
          <p className="rounded-2xl bg-surface px-4 py-6 text-center text-xs text-muted shadow-card ring-1 ring-border">
            {activeFilter === "flag"
              ? "No flagged messages. In chat, type “flag” right after a response to mark it for review."
              : activeFilter === "fire"
                ? "No fire responses yet. In chat, type “fire response susen” after a great reply."
                : "No captured chats yet."}
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
                  <div className="mt-1 flex flex-wrap items-center gap-2">
                    <span className="text-[11px] text-muted">
                      {n.author ?? "unknown"} · {n.created_at.slice(0, 10)}
                      {n.source ? ` · ${n.source}` : ""}
                    </span>
                    <TokenBadge tags={n.tags} />
                    <MarkerBadges tags={n.tags} />
                  </div>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1">
                  {activeFilter ? (
                    <button
                      type="button"
                      onClick={() => clearMarker(n.id, activeFilter)}
                      disabled={busyId === n.id}
                      className="rounded-full bg-foreground/10 px-3 py-1 text-[11px] font-bold text-foreground hover:bg-foreground/15 disabled:opacity-50"
                    >
                      {busyId === n.id ? "…" : "✓ Reviewed"}
                    </button>
                  ) : null}
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

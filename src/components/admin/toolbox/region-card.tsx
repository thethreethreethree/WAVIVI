"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

import type { RegionRow } from "@/types/supabase";

import { ScanButton } from "./scan-button";
import { humanizeTime } from "./toolbox-utils";

interface RegionCardProps {
  region: RegionRow;
  utilityCount: number;
}

/** A region summary card with scan / edit / enable-disable / view actions. */
export function RegionCard({ region, utilityCount }: RegionCardProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Editable fields
  const [country, setCountry] = useState(region.country);
  const [province, setProvince] = useState(region.province ?? "");
  const [city, setCity] = useState(region.city);
  const [radius, setRadius] = useState(region.radius_km);
  const [scanEnabled, setScanEnabled] = useState(region.scan_enabled);

  // Delete-confirmation modal state. Kept here (not promoted to its own
  // component) because the FK cascade behaviour is region-specific and
  // the modal is only rendered when an admin opens it; no benefit to
  // splitting the file. impact starts null and is fetched on open.
  const [deleting, setDeleting] = useState(false);
  const [confirmName, setConfirmName] = useState("");
  const [impact, setImpact] = useState<{
    cascade: {
      cities: number;
      feed_posts: number;
      traveler_utilities: number;
      scan_jobs: number;
    };
    orphan: {
      stays: number;
      restaurants: number;
      experiences: number;
      events: number;
    };
  } | null>(null);
  const [impactErr, setImpactErr] = useState<string | null>(null);

  async function patch(body: Record<string, unknown>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/regions/${region.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(b?.error ?? `Request failed (${res.status})`);
      }
      router.refresh();
      return true;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed.");
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive() {
    await patch({ active: !region.active });
  }

  async function saveEdits() {
    if (!country.trim() || !city.trim()) {
      setError("Country and city are required.");
      return;
    }
    const ok = await patch({
      country: country.trim(),
      province: province.trim() || null,
      city: city.trim(),
      radius_km: radius,
      scan_enabled: scanEnabled,
      // display_name is auto-recomposed server-side from the new city +
      // province (see PATCH route). We don't send it from the form so the
      // server stays the source of truth — overrides go through a future
      // dedicated "custom display name" field, not this default flow.
    });
    if (ok) setEditing(false);
  }

  /** Re-seed every form field from the current region prop. Called whenever
   *  the inline editor is opened so a save in another tab (or a server-side
   *  rename like the auto-derived display_name) flows in cleanly instead of
   *  the editor opening with the values from when the component first
   *  mounted. The useState initialisers above only run once per mount, and
   *  this card stays mounted for the life of the page. */
  function openEditor(): void {
    setCountry(region.country);
    setProvince(region.province ?? "");
    setCity(region.city);
    setRadius(region.radius_km);
    setScanEnabled(region.scan_enabled);
    setError(null);
    setEditing(true);
  }

  async function openDeleteModal() {
    setDeleting(true);
    setConfirmName("");
    setImpact(null);
    setImpactErr(null);
    try {
      const res = await fetch(`/api/admin/regions/${region.id}/impact`);
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(b?.error ?? `Impact preview failed (${res.status})`);
      }
      const body = (await res.json()) as typeof impact;
      setImpact(body);
    } catch (err) {
      setImpactErr(err instanceof Error ? err.message : "Impact preview failed.");
    }
  }

  async function confirmDelete() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/regions/${region.id}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const b = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(b?.error ?? `Delete failed (${res.status})`);
      }
      // Modal closes by virtue of the region disappearing from the parent
      // list after router.refresh().
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed.");
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-border">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="truncate text-sm font-bold">{region.display_name}</h3>
          <p className="truncate text-xs text-muted">{region.country}</p>
        </div>
        <div className="flex shrink-0 gap-1.5">
          <Badge on={region.active} onLabel="Active" offLabel="Disabled" />
          <Badge
            on={region.scan_enabled}
            onLabel="Scan on"
            offLabel="Scan off"
          />
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted">
        <span>
          <span className="font-bold text-foreground">{utilityCount}</span>{" "}
          utilities
        </span>
        <span>{region.radius_km} km radius</span>
        <span>Last scan: {humanizeTime(region.last_scan_at)}</span>
      </div>

      {editing ? (
        <div className="mt-3 flex flex-col gap-2 border-t border-border pt-3">
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            <input
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              placeholder="Country"
              className="admin-input"
            />
            <input
              value={province}
              onChange={(e) => setProvince(e.target.value)}
              placeholder="Province / State"
              className="admin-input"
            />
            <input
              value={city}
              onChange={(e) => setCity(e.target.value)}
              placeholder="City"
              className="admin-input"
            />
          </div>
          <label className="flex flex-col gap-1">
            <span className="text-xs font-bold text-muted">
              Radius — {radius} km
            </span>
            <input
              type="range"
              min={1}
              max={100}
              step={1}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full accent-glow"
            />
            {/* Live explainer so admins know dragging the slider isn't only
                about scan range — it also caps what travelers see across
                every source (lib/regions/within-radius applies the same
                radius_km to /stay, /eat, /todo, /events, and the home
                Recommended-for-you rail). */}
            <span className="text-[11px] text-muted">
              Travelers will see stays, restaurants, experiences, and events
              within{" "}
              <span className="font-bold text-foreground">{radius} km</span>{" "}
              of {region.display_name} on the app.
            </span>
          </label>
          <label className="flex items-center gap-2 text-xs font-bold">
            <input
              type="checkbox"
              checked={scanEnabled}
              onChange={(e) => setScanEnabled(e.target.checked)}
              className="h-4 w-4 accent-glow"
            />
            Scheduled scans enabled
          </label>
          {error && (
            <p className="text-[11px] font-semibold text-heat">{error}</p>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={saveEdits}
              disabled={busy}
              className="rounded-full bg-sunset px-3.5 py-1.5 text-xs font-bold text-white disabled:opacity-60"
            >
              {busy ? "Saving…" : "Save"}
            </button>
            <button
              type="button"
              onClick={() => {
                setEditing(false);
                setError(null);
              }}
              className="rounded-full px-3.5 py-1.5 text-xs font-bold text-muted hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* Scan / edit / enable-disable actions */}
          <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <ScanButton regionId={region.id} />
            <button
              type="button"
              onClick={openEditor}
              className="rounded-full px-3 py-1.5 text-xs font-bold text-muted ring-1 ring-border hover:text-foreground"
            >
              Edit
            </button>
            <button
              type="button"
              onClick={toggleActive}
              disabled={busy}
              className="rounded-full px-3 py-1.5 text-xs font-bold text-muted ring-1 ring-border hover:text-foreground disabled:opacity-60"
            >
              {region.active ? "Disable" : "Enable"}
            </button>
            <button
              type="button"
              onClick={openDeleteModal}
              disabled={busy}
              className="rounded-full px-3 py-1.5 text-xs font-bold text-heat ring-1 ring-border hover:bg-heat/10 disabled:opacity-60"
            >
              Delete
            </button>
            {error && (
              <span className="text-[11px] font-semibold text-heat">
                {error}
              </span>
            )}
          </div>
          {/* Per-region content shortcuts */}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <ContentLink href={`/admin/stays/${region.id}`} label="Stays" />
            <ContentLink href={`/admin/eat/${region.id}`} label="Where to eat" />
            <ContentLink
              href={`/admin/experiences/${region.id}`}
              label="Experiences"
            />
            <ContentLink href={`/admin/events/${region.id}`} label="Events" />
            <Link
              href={`/admin/toolbox/${region.id}`}
              className="rounded-full px-3 py-1.5 text-xs font-bold text-glow ring-1 ring-border hover:bg-glow/10"
            >
              Utilities ›
            </Link>
          </div>
        </>
      )}

      {deleting && (
        <div
          role="dialog"
          aria-modal
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => !busy && setDeleting(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-card ring-1 ring-border"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold text-foreground">
              Delete {region.display_name}?
            </h3>
            <p className="mt-1 text-xs text-muted">
              This cannot be undone. Cascaded rows are deleted immediately;
              orphaned rows stay in the database with{" "}
              <code className="font-mono">region_id = NULL</code> and become
              invisible on the public listings.
            </p>

            {impactErr ? (
              <p className="mt-3 rounded-lg bg-heat/15 px-3 py-2 text-xs font-semibold text-heat">
                {impactErr}
              </p>
            ) : !impact ? (
              <p className="mt-3 text-xs text-muted">Loading impact preview…</p>
            ) : (
              <div className="mt-3 flex flex-col gap-2">
                <ImpactBlock
                  tone="heat"
                  label="Cascade delete (gone for good)"
                  rows={[
                    ["Cities", impact.cascade.cities],
                    ["Feed posts", impact.cascade.feed_posts],
                    ["Toolbox utilities", impact.cascade.traveler_utilities],
                    ["Scan jobs", impact.cascade.scan_jobs],
                  ]}
                />
                <ImpactBlock
                  tone="muted"
                  label="Orphan (kept in DB, region_id set to NULL)"
                  rows={[
                    ["Stays", impact.orphan.stays],
                    ["Restaurants", impact.orphan.restaurants],
                    ["Experiences", impact.orphan.experiences],
                    ["Events", impact.orphan.events],
                  ]}
                />
                {(impact.orphan.stays +
                  impact.orphan.restaurants +
                  impact.orphan.experiences +
                  impact.orphan.events >
                  0) && (
                  <p className="text-[11px] text-heat">
                    Tip: move places to another region from /admin/stays,
                    /admin/eat, etc. before deleting, or accept that they
                    become unlisted.
                  </p>
                )}
              </div>
            )}

            <label className="mt-4 block text-xs font-bold text-muted">
              Type{" "}
              <code className="font-mono text-foreground">
                {region.display_name}
              </code>{" "}
              to confirm
            </label>
            <input
              type="text"
              value={confirmName}
              onChange={(e) => setConfirmName(e.target.value)}
              placeholder={region.display_name}
              className="admin-input mt-1 w-full"
              autoFocus
            />

            {error && (
              <p className="mt-3 rounded-lg bg-heat/15 px-3 py-2 text-xs font-semibold text-heat">
                {error}
              </p>
            )}

            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleting(false)}
                disabled={busy}
                className="rounded-full px-4 py-1.5 text-xs font-bold text-muted ring-1 ring-border hover:text-foreground disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={
                  busy ||
                  !impact ||
                  confirmName.trim() !== region.display_name.trim()
                }
                className="rounded-full bg-heat px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
              >
                {busy ? "Deleting…" : "Delete region"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function ImpactBlock({
  tone,
  label,
  rows,
}: {
  tone: "heat" | "muted";
  label: string;
  rows: [string, number][];
}) {
  const total = rows.reduce((acc, [, n]) => acc + n, 0);
  const accent =
    tone === "heat" ? "ring-heat/40 bg-heat/5" : "ring-border bg-foreground/5";
  return (
    <div className={`rounded-lg px-3 py-2 ring-1 ${accent}`}>
      <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
        {label} · {total}
      </p>
      <ul className="mt-1 grid grid-cols-2 gap-x-3 text-xs">
        {rows.map(([k, n]) => (
          <li key={k} className="flex justify-between">
            <span className="text-muted">{k}</span>
            <span className="font-bold text-foreground">{n}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ContentLink({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="rounded-full px-3 py-1.5 text-xs font-bold text-glow ring-1 ring-border hover:bg-glow/10"
    >
      {label} ›
    </Link>
  );
}

function Badge({
  on,
  onLabel,
  offLabel,
}: {
  on: boolean;
  onLabel: string;
  offLabel: string;
}) {
  return (
    <span
      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
        on ? "bg-cool/15 text-cool" : "bg-heat/15 text-heat"
      }`}
    >
      {on ? onLabel : offLabel}
    </span>
  );
}

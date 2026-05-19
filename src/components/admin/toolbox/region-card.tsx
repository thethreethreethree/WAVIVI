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
    const ok = await patch({
      country: country.trim(),
      province: province.trim() || null,
      city: city.trim(),
      radius_km: radius,
      scan_enabled: scanEnabled,
    });
    if (ok) setEditing(false);
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
        <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-border pt-3">
          <ScanButton regionId={region.id} />
          <button
            type="button"
            onClick={() => setEditing(true)}
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
          <Link
            href={`/admin/toolbox/${region.id}`}
            className="rounded-full px-3 py-1.5 text-xs font-bold text-glow ring-1 ring-border hover:bg-glow/10"
          >
            View Utilities ›
          </Link>
          {error && (
            <span className="text-[11px] font-semibold text-heat">
              {error}
            </span>
          )}
        </div>
      )}
    </div>
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

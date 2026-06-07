"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createCity,
  deleteCity,
  mergeCities,
  renameCity,
  suggestCityCentroid,
  updateCityGeo,
} from "./actions";
import type { CityRow } from "@/types/supabase";

/** Per-city aggregate, built server-side and handed in to spare the
 *  client three count queries per render. */
export interface CityWithCounts extends CityRow {
  stays: number;
  restaurants: number;
  experiences: number;
}

/** Admin list of all cities in one region — rename, merge, delete,
 *  hand-create. Pure client UI; every mutation goes through a server
 *  action and revalidates the relevant per-region pages. */
export function CitiesList({
  regionId,
  cities,
}: {
  regionId: string;
  cities: CityWithCounts[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [mergingFromId, setMergingFromId] = useState<string | null>(null);
  const [mergeTargetId, setMergeTargetId] = useState<string>("");
  const [newCityName, setNewCityName] = useState("");
  const [geoEditingId, setGeoEditingId] = useState<string | null>(null);
  const [geoLat, setGeoLat] = useState("");
  const [geoLng, setGeoLng] = useState("");
  const [geoRadius, setGeoRadius] = useState("");

  function clearStatus(): void {
    setError(null);
    setNotice(null);
  }

  function beginRename(c: CityWithCounts): void {
    clearStatus();
    setEditingId(c.id);
    setEditName(c.name);
  }

  function commitRename(): void {
    if (!editingId) return;
    const id = editingId;
    const name = editName;
    startTransition(async () => {
      const res = await renameCity(id, name);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setNotice("Renamed.");
      setEditingId(null);
      setEditName("");
      router.refresh();
    });
  }

  function beginMerge(c: CityWithCounts): void {
    clearStatus();
    setMergingFromId(c.id);
    setMergeTargetId("");
  }

  function commitMerge(): void {
    if (!mergingFromId || !mergeTargetId) return;
    const src = mergingFromId;
    const tgt = mergeTargetId;
    startTransition(async () => {
      const res = await mergeCities(src, tgt);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setNotice(`Merged — moved ${res.moved ?? 0} place(s).`);
      setMergingFromId(null);
      setMergeTargetId("");
      router.refresh();
    });
  }

  function commitDelete(c: CityWithCounts): void {
    clearStatus();
    if (
      !window.confirm(
        `Delete ${c.name}? This only works if no places point at it.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      const res = await deleteCity(c.id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setNotice("City deleted.");
      router.refresh();
    });
  }

  function beginGeoEdit(c: CityWithCounts): void {
    clearStatus();
    setGeoEditingId(c.id);
    setGeoLat(c.latitude != null ? String(c.latitude) : "");
    setGeoLng(c.longitude != null ? String(c.longitude) : "");
    setGeoRadius(c.radius_km != null ? String(c.radius_km) : "");
  }

  function autoCentre(): void {
    if (!geoEditingId) return;
    const id = geoEditingId;
    startTransition(async () => {
      const res = await suggestCityCentroid(id);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      if (res.latitude == null || res.longitude == null) {
        setError(
          "No placed venues in this city yet — type the centre by hand.",
        );
        return;
      }
      setGeoLat(String(res.latitude));
      setGeoLng(String(res.longitude));
      setNotice(`Centred on the centroid of ${res.sampleCount} place(s).`);
    });
  }

  function commitGeo(): void {
    if (!geoEditingId) return;
    const id = geoEditingId;
    const allBlank = !geoLat.trim() && !geoLng.trim() && !geoRadius.trim();
    const lat = allBlank ? null : Number(geoLat);
    const lng = allBlank ? null : Number(geoLng);
    const radius = allBlank ? null : Number(geoRadius);
    if (
      !allBlank &&
      (Number.isNaN(lat as number) ||
        Number.isNaN(lng as number) ||
        Number.isNaN(radius as number))
    ) {
      setError("Lat, lng, and radius must all be numbers.");
      return;
    }
    startTransition(async () => {
      const res = await updateCityGeo(id, {
        latitude: lat,
        longitude: lng,
        radius_km: radius,
      });
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setNotice(allBlank ? "City geo cleared." : "City geo saved.");
      setGeoEditingId(null);
      setGeoLat("");
      setGeoLng("");
      setGeoRadius("");
      router.refresh();
    });
  }

  function commitCreate(): void {
    clearStatus();
    const name = newCityName;
    if (!name.trim()) return;
    startTransition(async () => {
      const res = await createCity(regionId, name);
      if (!res.ok) {
        setError(res.error);
        return;
      }
      setNotice(`Created ${name.trim()}.`);
      setNewCityName("");
      router.refresh();
    });
  }

  const mergingFrom = cities.find((c) => c.id === mergingFromId) ?? null;
  // Targets for a merge: every other city in the same region. Surface
  // a count line so admins know what they're collapsing.
  const mergeTargets = cities.filter((c) => c.id !== mergingFromId);

  return (
    <div className="flex flex-col gap-4">
      {/* Add-city row */}
      <div className="flex flex-wrap items-center gap-2 rounded-2xl bg-surface px-3 py-3 shadow-card ring-1 ring-border">
        <label className="text-xs font-bold text-muted">New city</label>
        <input
          type="text"
          value={newCityName}
          onChange={(e) => setNewCityName(e.target.value)}
          placeholder="e.g. Carmen"
          className="admin-input max-w-xs"
        />
        <button
          type="button"
          onClick={commitCreate}
          disabled={pending || !newCityName.trim()}
          className="rounded-full bg-sunset px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
        >
          {pending ? "…" : "Add"}
        </button>
        <span className="text-[11px] text-muted">
          Use this for towns the CSV scraper hasn&apos;t covered yet — then hand-assign places to it from the per-region admin tables.
        </span>
      </div>

      {error && (
        <p className="rounded-lg bg-heat/15 px-3 py-2 text-xs font-semibold text-heat">
          {error}
        </p>
      )}
      {notice && !error && (
        <p className="rounded-lg bg-cool/15 px-3 py-2 text-xs font-semibold text-cool">
          {notice}
        </p>
      )}

      {cities.length === 0 ? (
        <p className="rounded-2xl bg-surface px-4 py-8 text-center text-sm text-muted shadow-card ring-1 ring-border">
          No cities in this region yet — import a CSV from{" "}
          <a href="/admin/batch-city-import" className="text-glow underline">
            Batch city import
          </a>{" "}
          or add one above.
        </p>
      ) : (
        <ul className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-border">
          {cities.map((c, i) => {
            const total = c.stays + c.restaurants + c.experiences;
            const isEditing = editingId === c.id;
            return (
              <li
                key={c.id}
                className={`flex flex-wrap items-center gap-3 px-4 py-3 ${
                  i > 0 ? "border-t border-border" : ""
                }`}
              >
                <span className="min-w-0 flex-1">
                  {isEditing ? (
                    <input
                      autoFocus
                      type="text"
                      value={editName}
                      onChange={(e) => setEditName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") commitRename();
                        if (e.key === "Escape") setEditingId(null);
                      }}
                      className="admin-input max-w-xs"
                    />
                  ) : (
                    <span className="block truncate text-sm font-semibold">
                      {c.name}
                    </span>
                  )}
                  <span className="block truncate text-[11px] text-muted">
                    slug: <code className="font-mono">{c.slug}</code> · {total}{" "}
                    place{total === 1 ? "" : "s"} ({c.stays} stays ·{" "}
                    {c.restaurants} eats · {c.experiences} experiences)
                  </span>
                  <span className="block truncate text-[11px] text-muted">
                    {c.latitude != null &&
                    c.longitude != null &&
                    c.radius_km != null ? (
                      <>
                        geo: {c.latitude.toFixed(4)}, {c.longitude.toFixed(4)} ·{" "}
                        radius {c.radius_km} km
                      </>
                    ) : (
                      <span className="text-heat/80">
                        geo: not set — falls back to region radius
                      </span>
                    )}
                  </span>
                </span>
                <span className="flex shrink-0 items-center gap-1.5">
                  {isEditing ? (
                    <>
                      <button
                        type="button"
                        onClick={commitRename}
                        disabled={pending || !editName.trim()}
                        className="rounded-full bg-cool px-3 py-1 text-xs font-bold text-white disabled:opacity-50"
                      >
                        Save
                      </button>
                      <button
                        type="button"
                        onClick={() => setEditingId(null)}
                        className="rounded-full px-3 py-1 text-xs font-bold text-muted ring-1 ring-border hover:text-foreground"
                      >
                        Cancel
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => beginRename(c)}
                        className="rounded-full px-3 py-1 text-xs font-bold text-muted ring-1 ring-border hover:text-foreground"
                      >
                        Rename
                      </button>
                      <button
                        type="button"
                        onClick={() => beginGeoEdit(c)}
                        className="rounded-full px-3 py-1 text-xs font-bold text-muted ring-1 ring-border hover:text-foreground"
                      >
                        {c.latitude != null ? "Edit geo" : "Set geo"}
                      </button>
                      <button
                        type="button"
                        onClick={() => beginMerge(c)}
                        disabled={cities.length < 2}
                        className="rounded-full px-3 py-1 text-xs font-bold text-muted ring-1 ring-border hover:text-foreground disabled:opacity-40"
                      >
                        Merge…
                      </button>
                      <button
                        type="button"
                        onClick={() => commitDelete(c)}
                        disabled={pending}
                        className="rounded-full px-3 py-1 text-xs font-bold text-heat ring-1 ring-border hover:bg-heat/10 disabled:opacity-50"
                        title={
                          total > 0
                            ? "Delete only works on empty cities — merge first"
                            : "Delete this empty city"
                        }
                      >
                        Delete
                      </button>
                    </>
                  )}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      {geoEditingId &&
        (() => {
          const c = cities.find((x) => x.id === geoEditingId);
          if (!c) return null;
          return (
            <div
              role="dialog"
              aria-modal
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
              onClick={() => setGeoEditingId(null)}
            >
              <div
                className="w-full max-w-md rounded-2xl bg-surface p-5 shadow-card ring-1 ring-border"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-base font-bold">
                  {c.latitude != null ? "Edit" : "Set"} geo for {c.name}
                </h3>
                <p className="mt-1 text-xs text-muted">
                  Centre + radius for the public listing filter. When set,
                  venues with this city_id are kept only if they sit inside
                  the circle — overrides the region&apos;s default radius.
                  Leave all three blank to clear and fall back to the
                  region radius. Radius range: 1&ndash;200 km.
                </p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  <label className="block">
                    <span className="text-[11px] font-bold text-muted">
                      Latitude
                    </span>
                    <input
                      type="text"
                      value={geoLat}
                      onChange={(e) => setGeoLat(e.target.value)}
                      placeholder="11.18"
                      className="admin-input mt-1 w-full"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-bold text-muted">
                      Longitude
                    </span>
                    <input
                      type="text"
                      value={geoLng}
                      onChange={(e) => setGeoLng(e.target.value)}
                      placeholder="119.39"
                      className="admin-input mt-1 w-full"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] font-bold text-muted">
                      Radius km
                    </span>
                    <input
                      type="text"
                      value={geoRadius}
                      onChange={(e) => setGeoRadius(e.target.value)}
                      placeholder="25"
                      className="admin-input mt-1 w-full"
                    />
                  </label>
                </div>
                <button
                  type="button"
                  onClick={autoCentre}
                  disabled={pending}
                  className="mt-3 rounded-full px-3 py-1 text-xs font-bold text-muted ring-1 ring-border hover:text-foreground disabled:opacity-50"
                >
                  Auto-centre from placed venues
                </button>
                <div className="mt-4 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setGeoEditingId(null)}
                    className="rounded-full px-4 py-1.5 text-xs font-bold text-muted ring-1 ring-border hover:text-foreground"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={commitGeo}
                    disabled={pending}
                    className="rounded-full bg-sunset px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
                  >
                    {pending ? "Saving…" : "Save"}
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

      {mergingFrom && (
        <div
          role="dialog"
          aria-modal
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setMergingFromId(null)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-card ring-1 ring-border"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-base font-bold">Merge {mergingFrom.name}</h3>
            <p className="mt-1 text-xs text-muted">
              Moves all {mergingFrom.stays + mergingFrom.restaurants + mergingFrom.experiences}{" "}
              place(s) into the target, then deletes {mergingFrom.name}.
              Cannot be undone — admins can rename the target afterwards.
            </p>
            <label className="mt-3 block text-xs font-bold text-muted">
              Target city
            </label>
            <select
              value={mergeTargetId}
              onChange={(e) => setMergeTargetId(e.target.value)}
              className="admin-input mt-1 w-full"
            >
              <option value="">— Pick a city —</option>
              {mergeTargets.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.stays + c.restaurants + c.experiences})
                </option>
              ))}
            </select>
            <div className="mt-4 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setMergingFromId(null)}
                className="rounded-full px-4 py-1.5 text-xs font-bold text-muted ring-1 ring-border hover:text-foreground"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={commitMerge}
                disabled={pending || !mergeTargetId}
                className="rounded-full bg-heat px-4 py-1.5 text-xs font-bold text-white disabled:opacity-50"
              >
                {pending ? "Merging…" : "Merge"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

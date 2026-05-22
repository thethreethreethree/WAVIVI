"use client";

import { useRouter } from "next/navigation";
import { useRef, useState } from "react";

interface ImportSummary {
  added: number;
  updated: number;
  skipped: number;
  parsed: number;
  rowErrors: string[];
}

const CUISINES = [
  "Filipino",
  "Seafood",
  "Italian",
  "Cafe",
  "Bar & Grill",
  "Vegan",
  "Asian",
  "International",
  "Bakery",
  "other",
];

/** Admin Restaurants CSV importer — mirrors the other admin importers. */
export function RestaurantsCsvImport({ regionId }: { regionId: string }) {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [cuisine, setCuisine] = useState<string>("Filipino");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportSummary | null>(null);

  async function handleImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      setError("Choose a CSV file first.");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const csv = await file.text();
      const res = await fetch(
        `/api/admin/regions/${regionId}/import-restaurants`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ cuisine, csv }),
        },
      );
      const body = (await res.json().catch(() => null)) as
        | (ImportSummary & { error?: string })
        | null;
      if (!res.ok || !body) {
        throw new Error(body?.error ?? `Import failed (${res.status})`);
      }
      setResult(body);
      if (fileRef.current) fileRef.current.value = "";
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Import failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-border">
      <h2 className="text-sm font-bold">Import restaurants from CSV</h2>
      <p className="mt-0.5 text-xs text-muted">
        Upload a CSV — rows match existing restaurants in this region by
        location. Matches refresh details; new ones are added.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold text-muted">Default cuisine</span>
          <select
            value={cuisine}
            onChange={(e) => setCuisine(e.target.value)}
            className="admin-input"
          >
            {CUISINES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-bold text-muted">CSV file</span>
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            className="admin-input file:mr-2 file:rounded-full file:border-0 file:bg-glow/15 file:px-2 file:py-0.5 file:text-xs file:font-bold file:text-glow"
          />
        </label>

        <button
          type="button"
          onClick={handleImport}
          disabled={busy}
          className="rounded-full bg-sunset px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
        >
          {busy ? "Importing…" : "Import CSV"}
        </button>
      </div>

      {error && (
        <p className="mt-3 rounded-lg bg-heat/15 px-3 py-2 text-xs font-semibold text-heat">
          {error}
        </p>
      )}

      {result && (
        <div className="mt-3 rounded-lg bg-cool/10 px-3 py-2 text-xs">
          <p className="font-bold text-cool">
            Imported {result.parsed} row(s): {result.added} added,{" "}
            {result.updated} updated
            {result.skipped > 0 ? `, ${result.skipped} skipped` : ""}.
          </p>
          {result.rowErrors.length > 0 && (
            <ul className="mt-1 list-disc pl-4 text-muted">
              {result.rowErrors.slice(0, 5).map((e) => (
                <li key={e}>{e}</li>
              ))}
              {result.rowErrors.length > 5 && (
                <li>…and {result.rowErrors.length - 5} more.</li>
              )}
            </ul>
          )}
        </div>
      )}

      <p className="mt-3 text-[11px] text-muted">
        Expected columns: <code>Title</code>, <code>Cuisine</code>,{" "}
        <code>Price</code>, <code>Description</code>, <code>Rating</code>,{" "}
        <code>Reviews</code>, <code>Phone</code>, <code>WhatsApp</code>,{" "}
        <code>Instagram</code>, <code>Facebook</code>, <code>Address</code>,{" "}
        <code>Website</code>, <code>Image</code>, <code>Amenities</code>,{" "}
        <code>Latitude</code>, <code>Longitude</code>,{" "}
        <code>Google Maps Link</code>. Case-insensitive.
      </p>
    </div>
  );
}

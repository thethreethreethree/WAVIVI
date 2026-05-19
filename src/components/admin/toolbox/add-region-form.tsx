"use client";

import dynamic from "next/dynamic";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";

import { isShortMapsLink, parseCoords } from "@/lib/toolbox/parse-coords";

const MapPicker = dynamic(
  () => import("./map-picker").then((m) => m.MapPicker),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-64 w-full items-center justify-center rounded-xl bg-background ring-1 ring-border text-xs font-semibold text-muted">
        Loading map…
      </div>
    ),
  },
);

/** Collapsible card for creating a new toolbox region. */
export function AddRegionForm() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [country, setCountry] = useState("");
  const [province, setProvince] = useState("");
  const [city, setCity] = useState("");
  const [radius, setRadius] = useState(25);
  const [latStr, setLatStr] = useState("");
  const [lngStr, setLngStr] = useState("");
  const [urlInput, setUrlInput] = useState("");
  const [urlHint, setUrlHint] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Parse a pasted Google Maps link (or "lat, lng") into the coordinate.
  function handleUrl(value: string) {
    setUrlInput(value);
    if (!value.trim()) {
      setUrlHint(null);
      return;
    }
    const found = parseCoords(value);
    if (found) {
      setLatStr(found.lat.toFixed(5));
      setLngStr(found.lng.toFixed(5));
      setUrlHint(`Found ${found.lat.toFixed(5)}, ${found.lng.toFixed(5)}`);
    } else if (isShortMapsLink(value)) {
      setUrlHint(
        "Short links can't be read — open it in Google Maps and paste the full URL.",
      );
    } else {
      setUrlHint("No coordinates found in that text.");
    }
  }

  // The picked coordinate — valid only when both inputs parse to numbers
  // in range. The map picker and the manual inputs both feed these strings.
  const coord = useMemo(() => {
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180
    ) {
      return { lat, lng };
    }
    return null;
  }, [latStr, lngStr]);

  function reset() {
    setCountry("");
    setProvince("");
    setCity("");
    setRadius(25);
    setLatStr("");
    setLngStr("");
    setUrlInput("");
    setUrlHint(null);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!country.trim() || !city.trim()) {
      setError("Country and city are required.");
      return;
    }
    if (!coord) {
      setError("Set the coordinates — type them in or click the map.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/regions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          country: country.trim(),
          province: province.trim() || undefined,
          city: city.trim(),
          latitude: coord.lat,
          longitude: coord.lng,
          radius_km: radius,
        }),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `Request failed (${res.status})`);
      }
      reset();
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add region.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="rounded-2xl bg-surface shadow-card ring-1 ring-border">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-4 py-3.5 text-left"
      >
        <span className="text-sm font-bold">Add a region</span>
        <span className="rounded-full bg-sunset px-2.5 py-1 text-xs font-bold text-white">
          {open ? "Close" : "+ New"}
        </span>
      </button>

      {open && (
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-3 border-t border-border p-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <Field label="Country" required>
              <input
                value={country}
                onChange={(e) => setCountry(e.target.value)}
                className="admin-input"
                placeholder="Philippines"
              />
            </Field>
            <Field label="Province / State">
              <input
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                className="admin-input"
                placeholder="Palawan"
              />
            </Field>
            <Field label="City" required>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="admin-input"
                placeholder="El Nido"
              />
            </Field>
          </div>

          <Field label={`Radius — ${radius} km`}>
            <input
              type="range"
              min={1}
              max={100}
              step={1}
              value={radius}
              onChange={(e) => setRadius(Number(e.target.value))}
              className="w-full accent-glow"
            />
          </Field>

          {/* Paste a Google Maps link — coordinates are auto-extracted. */}
          <Field label="Google Maps link (optional)">
            <input
              value={urlInput}
              onChange={(e) => handleUrl(e.target.value)}
              className="admin-input"
              placeholder="https://www.google.com/maps/@11.2027,119.4160,14z"
            />
          </Field>
          {urlHint && (
            <p
              className={`-mt-1.5 text-[11px] font-semibold ${
                parseCoords(urlInput) ? "text-cool" : "text-muted"
              }`}
            >
              {urlHint}
            </p>
          )}

          {/* Manual coordinate entry — the reliable path. */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Latitude" required>
              <input
                type="number"
                step="any"
                value={latStr}
                onChange={(e) => setLatStr(e.target.value)}
                className="admin-input"
                placeholder="11.20270"
              />
            </Field>
            <Field label="Longitude" required>
              <input
                type="number"
                step="any"
                value={lngStr}
                onChange={(e) => setLngStr(e.target.value)}
                className="admin-input"
                placeholder="119.41600"
              />
            </Field>
          </div>

          <div>
            <p className="mb-1.5 text-xs font-bold text-muted">
              Or click the map to set coordinates
            </p>
            <MapPicker
              value={coord}
              radiusKm={radius}
              onPick={(c) => {
                setLatStr(c.lat.toFixed(5));
                setLngStr(c.lng.toFixed(5));
              }}
            />
            <p className="mt-1.5 text-[11px] text-muted">
              {coord
                ? `Selected: ${coord.lat.toFixed(5)}, ${coord.lng.toFixed(5)}`
                : "No coordinate set yet — type one above or click the map."}
            </p>
          </div>

          {error && (
            <p className="rounded-lg bg-heat/15 px-3 py-2 text-xs font-semibold text-heat">
              {error}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full bg-sunset px-4 py-2 text-sm font-bold text-white disabled:opacity-60"
            >
              {submitting ? "Adding…" : "Add region"}
            </button>
            <button
              type="button"
              onClick={() => {
                reset();
                setOpen(false);
              }}
              className="rounded-full px-4 py-2 text-sm font-bold text-muted hover:text-foreground"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-bold text-muted">
        {label}
        {required && <span className="text-heat"> *</span>}
      </span>
      {children}
    </label>
  );
}

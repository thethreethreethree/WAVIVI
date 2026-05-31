"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";

/**
 * Trip-planner destination pickers — typeahead-style fields backed by
 * the regions we've ingested.
 *
 * Why typeahead instead of a hard dropdown:
 *   - The user can still plan a trip to a country we don't have content
 *     for yet (e.g. Brazil); we just won't be able to recommend rooms
 *     and activities there until we ingest it. Forcing a dropdown
 *     blocks valid trips.
 *   - As we add cities, they appear automatically in the suggestions —
 *     no UI work needed when, say, Thailand goes live.
 *
 * Catalog cache: `/api/regions` returns the full active set today (~10s
 * of rows). We fetch once per page load and stash in module-level state
 * so the country and city pickers share one round-trip. When the table
 * grows past the threshold called out in memory
 * (`region-picker-country-filter-threshold`), the catalog endpoint
 * gains a `?country=` filter and we lazy-load per-country instead.
 */

interface RegionCatalogRow {
  id: string;
  display_name: string;
  city: string | null;
  country: string | null;
}

interface RegionCatalog {
  rows: RegionCatalogRow[];
  countries: string[];
}

let cachedCatalog: RegionCatalog | null = null;
let inflight: Promise<RegionCatalog> | null = null;

async function loadCatalog(): Promise<RegionCatalog> {
  if (cachedCatalog) return cachedCatalog;
  if (inflight) return inflight;
  inflight = fetch("/api/regions", { cache: "force-cache" })
    .then((r) => r.json())
    .then((body: { regions?: RegionCatalogRow[] }) => {
      const rows = body.regions ?? [];
      const countries = Array.from(
        new Set(
          rows
            .map((r) => (r.country ?? "").trim())
            .filter((c) => c.length > 0),
        ),
      ).sort((a, b) => a.localeCompare(b));
      cachedCatalog = { rows, countries };
      return cachedCatalog;
    })
    .catch(() => {
      cachedCatalog = { rows: [], countries: [] };
      return cachedCatalog;
    })
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

function useRegionCatalog(): RegionCatalog | null {
  const [catalog, setCatalog] = useState<RegionCatalog | null>(
    cachedCatalog,
  );
  useEffect(() => {
    if (cachedCatalog) {
      setCatalog(cachedCatalog);
      return;
    }
    let alive = true;
    loadCatalog().then((c) => {
      if (alive) setCatalog(c);
    });
    return () => {
      alive = false;
    };
  }, []);
  return catalog;
}

/** Case-insensitive prefix-or-substring rank: prefix > infix > none. */
function rank(option: string, query: string): number {
  if (!query) return 1;
  const o = option.toLowerCase();
  const q = query.toLowerCase();
  if (o === q) return 100;
  if (o.startsWith(q)) return 50;
  if (o.includes(q)) return 10;
  return 0;
}

interface AutocompleteProps {
  value: string;
  onChange: (v: string) => void;
  options: string[];
  placeholder: string;
  /** Labels the suggestions list e.g. "In our system". */
  optionsLabel?: string;
  /** When true, fields show a small "✓ Coverage available" badge once
   *  the typed value matches an option (case-insensitive). */
  showCoverageBadge?: boolean;
  /** Disable the input entirely (e.g. city picker before country chosen). */
  disabled?: boolean;
  /** Optional autofocus on mount. */
  autoFocus?: boolean;
  /** Extra hint shown below the field (small text). */
  hint?: string;
  className?: string;
}

function Autocomplete({
  value,
  onChange,
  options,
  placeholder,
  optionsLabel = "Suggestions",
  showCoverageBadge,
  disabled,
  autoFocus,
  hint,
  className,
}: AutocompleteProps) {
  const inputId = useId();
  const listId = useId();
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [open, setOpen] = useState(false);
  const [activeIdx, setActiveIdx] = useState(-1);

  const matches = useMemo(() => {
    const ranked = options
      .map((o) => ({ o, r: rank(o, value.trim()) }))
      .filter((x) => x.r > 0)
      .sort((a, b) => b.r - a.r)
      .slice(0, 8)
      .map((x) => x.o);
    // When the field is empty, show the full list capped at 8 so the
    // user can discover what's available.
    if (!value.trim()) return options.slice(0, 8);
    return ranked;
  }, [options, value]);

  const coverageMatch = useMemo(() => {
    const v = value.trim().toLowerCase();
    if (!v) return false;
    return options.some((o) => o.toLowerCase() === v);
  }, [options, value]);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, [open]);

  function pick(v: string) {
    onChange(v);
    setOpen(false);
    setActiveIdx(-1);
  }

  return (
    <div ref={wrapperRef} className={`relative ${className ?? ""}`}>
      <input
        id={inputId}
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus={autoFocus}
        disabled={disabled}
        type="text"
        autoComplete="off"
        spellCheck={false}
        role="combobox"
        aria-expanded={open}
        aria-controls={listId}
        aria-autocomplete="list"
        value={value}
        placeholder={placeholder}
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
          setActiveIdx(-1);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (!open && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
            setOpen(true);
            return;
          }
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActiveIdx((i) => Math.min(matches.length - 1, i + 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActiveIdx((i) => Math.max(-1, i - 1));
          } else if (e.key === "Enter") {
            if (activeIdx >= 0 && matches[activeIdx]) {
              e.preventDefault();
              pick(matches[activeIdx]);
            } else {
              setOpen(false);
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
        className="wtn-input"
      />

      {showCoverageBadge && coverageMatch && (
        <span
          className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-cool/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-cool"
          aria-hidden
        >
          ✓ Coverage
        </span>
      )}

      {open && matches.length > 0 && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-xl bg-surface py-1 shadow-card ring-1 ring-border"
        >
          {optionsLabel && (
            <li className="px-3 pb-1 pt-1 text-[10px] font-bold uppercase tracking-wider text-muted">
              {optionsLabel}
            </li>
          )}
          {matches.map((m, i) => (
            <li
              key={m}
              role="option"
              aria-selected={i === activeIdx}
              onMouseDown={(e) => {
                e.preventDefault();
                pick(m);
              }}
              onMouseEnter={() => setActiveIdx(i)}
              className={`cursor-pointer px-3 py-2 text-sm ${
                i === activeIdx
                  ? "bg-sunset/15 text-foreground"
                  : "text-foreground"
              }`}
            >
              {m}
            </li>
          ))}
        </ul>
      )}

      {hint && (
        <p className="mt-1 text-[11px] text-muted">{hint}</p>
      )}
    </div>
  );
}

interface CountryFieldProps {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
}

/** Country picker — typeahead over the distinct countries we currently
 *  have any region for, with free-text fallback for countries we don't
 *  cover yet. */
export function CountryField({ value, onChange, autoFocus }: CountryFieldProps) {
  const catalog = useRegionCatalog();
  const countries = catalog?.countries ?? [];

  const supportedText =
    countries.length === 0
      ? "Loading countries…"
      : countries.length === 1
        ? `In our system: ${countries[0]}. Type any other country freely.`
        : `In our system: ${countries.slice(0, 4).join(", ")}${
            countries.length > 4 ? "…" : ""
          }. Type any other country freely.`;

  return (
    <Autocomplete
      value={value}
      onChange={onChange}
      options={countries}
      placeholder="Country"
      optionsLabel="In our system"
      showCoverageBadge
      autoFocus={autoFocus}
      hint={supportedText}
    />
  );
}

interface CityFieldProps {
  value: string;
  onChange: (v: string) => void;
  country: string;
}

/** City / destination picker — filters our regions by the selected
 *  country and shows the matching city names. Free-text fallback so
 *  users can plan trips to cities we haven't ingested. */
export function CityField({ value, onChange, country }: CityFieldProps) {
  const catalog = useRegionCatalog();

  // Build the per-country city list. Match country case-insensitively
  // so "philippines" / "Philippines" both work. Dedup by city name
  // since several admin-managed regions can map to one travel city.
  const cities = useMemo(() => {
    const q = country.trim().toLowerCase();
    if (!q || !catalog) return [] as string[];
    const seen = new Set<string>();
    const out: string[] = [];
    for (const r of catalog.rows) {
      if ((r.country ?? "").toLowerCase() !== q) continue;
      const c = (r.city ?? r.display_name).trim();
      if (!c) continue;
      const k = c.toLowerCase();
      if (seen.has(k)) continue;
      seen.add(k);
      out.push(c);
    }
    return out.sort((a, b) => a.localeCompare(b));
  }, [catalog, country]);

  const countryInSystem = useMemo(() => {
    const q = country.trim().toLowerCase();
    if (!q || !catalog) return false;
    return catalog.countries.some((c) => c.toLowerCase() === q);
  }, [catalog, country]);

  let hint: string | undefined;
  if (!country.trim()) {
    hint = "Pick a country above first.";
  } else if (countryInSystem && cities.length === 0) {
    hint = `No destinations indexed in ${country.trim()} yet — type any city freely.`;
  } else if (countryInSystem) {
    hint = `${cities.length} destination${cities.length === 1 ? "" : "s"} in our system. Type any city freely.`;
  } else if (catalog) {
    hint = `${country.trim()} isn't in our system yet — type any city freely.`;
  }

  return (
    <Autocomplete
      value={value}
      onChange={onChange}
      options={cities}
      placeholder="City (optional)"
      optionsLabel="Destinations in our system"
      showCoverageBadge={countryInSystem}
      disabled={false}
      hint={hint}
      className="mt-2"
    />
  );
}

"use client";

import { useMemo, useRef, useState } from "react";

import { COUNTRIES, findCountry, type Country } from "@/lib/countries";

const MAX = 50;

/**
 * Country chip picker — intuitive multi-select that writes its current
 * selection into a hidden form input as a comma-separated list. The
 * parent form submits as usual; saveProfile already parses comma lists.
 *
 * UX:
 *  - Type to filter the dropdown (matches anywhere in the name).
 *  - Click a suggestion or hit Enter to add the highlighted one.
 *  - Each selected country shows as a removable flag chip.
 */
export function CountryPicker({
  name = "countries",
  initial = [],
}: {
  /** Hidden input name — what the parent form receives. */
  name?: string;
  /** Initial selected country names. Unknown names are still rendered. */
  initial?: string[];
}) {
  const [selected, setSelected] = useState<string[]>(
    Array.from(new Set(initial)).slice(0, MAX),
  );
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const suggestions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const taken = new Set(selected.map((s) => s.toLowerCase()));
    return COUNTRIES.filter((c) => !taken.has(c.name.toLowerCase()))
      .filter((c) => (q ? c.name.toLowerCase().includes(q) : true))
      .slice(0, 12);
  }, [query, selected]);

  function add(country: Country) {
    if (selected.length >= MAX) return;
    if (selected.some((s) => s.toLowerCase() === country.name.toLowerCase())) return;
    setSelected((prev) => [...prev, country.name]);
    setQuery("");
    inputRef.current?.focus();
  }

  function remove(name: string) {
    setSelected((prev) => prev.filter((c) => c !== name));
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      if (suggestions[0]) add(suggestions[0]);
    } else if (e.key === "Backspace" && !query && selected.length > 0) {
      // Quick-delete the last chip when the input is empty.
      remove(selected[selected.length - 1]);
    }
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Hidden field — what the form actually submits. */}
      <input type="hidden" name={name} value={selected.join(",")} />

      {/* Selected chips */}
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((country) => {
            const c = findCountry(country);
            return (
              <span
                key={country}
                className="wc-frame wc-frame-orange flex items-center gap-1.5 rounded-full pl-1.5 pr-2 py-1 text-xs font-semibold text-glow"
              >
                {c && (
                  // Native browser <img> is fine here — flagcdn cached + small.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`https://flagcdn.com/w40/${c.code}.png`}
                    alt=""
                    aria-hidden
                    className="h-4 w-4 shrink-0 rounded-full object-cover ring-1 ring-glow/40"
                  />
                )}
                <span className="truncate">{country}</span>
                <button
                  type="button"
                  onClick={() => remove(country)}
                  aria-label={`Remove ${country}`}
                  className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-heat/15 text-heat hover:bg-heat/25"
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Input + dropdown */}
      <div className="relative">
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
          onKeyDown={onKeyDown}
          placeholder={
            selected.length >= MAX
              ? "Maximum reached"
              : "Add a country you've visited…"
          }
          disabled={selected.length >= MAX}
          className="wc-frame w-full rounded-xl bg-transparent px-3.5 py-2.5 text-sm
                     outline-none transition-colors placeholder:text-muted
                     focus-visible:border-glow disabled:opacity-50"
        />

        {open && suggestions.length > 0 && (
          <ul className="absolute left-0 right-0 top-full z-20 mt-1 max-h-60 overflow-y-auto rounded-xl border border-border bg-surface-elevated shadow-card">
            {suggestions.map((c) => (
              <li key={c.code}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    e.preventDefault();
                    add(c);
                  }}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-glow/10"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={`https://flagcdn.com/w40/${c.code}.png`}
                    alt=""
                    aria-hidden
                    className="h-4 w-4 rounded-full object-cover ring-1 ring-border"
                  />
                  <span>{c.name}</span>
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-[11px] text-muted">
        {selected.length}/{MAX} · Type to search, tap to add, × to remove.
      </p>
    </div>
  );
}

"use client";

import { useMemo, useRef, useState, useTransition } from "react";

import {
  applyPartnerImport,
  type PartnerApplyResult,
} from "./actions";
import { parsePartnerCsv } from "./csv";

/** Live-preview + apply UI for the Partner Collection CSV format. */
export function PartnerImportClient() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState("");
  const [result, setResult] = useState<PartnerApplyResult | null>(null);
  const [pending, startTransition] = useTransition();

  const parsed = useMemo(() => {
    if (!csvText.trim()) return { rows: [], headerError: null };
    return parsePartnerCsv(csvText);
  }, [csvText]);

  // Per-source counts so the admin sees the routing at a glance.
  const counts = useMemo(() => {
    const c = { stays: 0, restaurants: 0, experiences: 0, invalid: 0 };
    for (const r of parsed.rows) {
      if (r.ok) c[r.source]++;
      else c.invalid++;
    }
    return c;
  }, [parsed.rows]);

  const validCount = counts.stays + counts.restaurants + counts.experiences;

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    f.text()
      .then((t) => setCsvText(t))
      .catch(() => {
        /* file read errors leave the textarea unchanged */
      });
    e.target.value = "";
  }

  function onApply() {
    setResult(null);
    startTransition(async () => {
      const res = await applyPartnerImport(csvText);
      setResult(res);
    });
  }

  function clearAll() {
    setCsvText("");
    setResult(null);
  }

  return (
    <div className="flex flex-col gap-5">
      <details className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-border">
        <summary className="cursor-pointer text-sm font-bold">
          CSV format
        </summary>
        <div className="mt-3 flex flex-col gap-3 text-xs text-muted">
          <p>
            Drop the CSV your Partner Collection extension exports straight in
            here — same shape: <code className="font-mono">Title</code>,{" "}
            <code className="font-mono">Industry</code>,{" "}
            <code className="font-mono">Pitch</code>,{" "}
            <code className="font-mono">Instagram</code>,{" "}
            <code className="font-mono">Address</code>,{" "}
            <code className="font-mono">Image</code>,{" "}
            <code className="font-mono">IG_Img_1..6</code>, etc.
          </p>
          <p>
            <strong className="text-foreground">Industry</strong> decides which
            table each row hits:
          </p>
          <ul className="ml-4 list-disc">
            <li>
              Hostel / Hotel / Resort / Inn / Guesthouse / Apartment /
              Camping / Bed &amp; breakfast → <code className="font-mono">stays</code>
            </li>
            <li>
              Restaurant / Cafe / Bar / Bakery →{" "}
              <code className="font-mono">restaurants</code>
            </li>
            <li>
              Experience / Tour / Activity / Adventure →{" "}
              <code className="font-mono">experiences</code>
            </li>
          </ul>
          <p>
            <strong className="text-foreground">Matching:</strong> each row is
            looked up in its target table by{" "}
            <code className="font-mono">Title</code> (case-insensitive). When
            two rows share a name, the importer uses the{" "}
            <code className="font-mono">Address</code> to disambiguate. Rows
            with no match are skipped — this importer doesn&apos;t insert new
            records.
          </p>
          <p>
            <strong className="text-foreground">Fields:</strong> non-empty
            cells overwrite the existing values. Blank cells are left alone.
            <code className="font-mono">IG_Img_1..6</code> are collected into{" "}
            <code className="font-mono">photo_urls</code>; the first one also
            becomes <code className="font-mono">photo_url</code> when{" "}
            <code className="font-mono">Image</code> is empty (so a missing
            primary photo gets backfilled from the IG gallery).
          </p>
        </div>
      </details>

      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv,text/csv"
            onChange={onPickFile}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="rounded-full bg-foreground/10 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-foreground/15"
          >
            Choose .csv file
          </button>
          {csvText && (
            <button
              type="button"
              onClick={clearAll}
              className="rounded-full bg-foreground/5 px-3 py-1.5 text-xs font-bold text-muted hover:bg-foreground/10"
            >
              Clear
            </button>
          )}
          <span className="text-xs text-muted">or paste below ↓</span>
        </div>
        <textarea
          value={csvText}
          onChange={(e) => setCsvText(e.target.value)}
          placeholder="Paste Partner Collection CSV here…"
          spellCheck={false}
          className="min-h-[200px] w-full rounded-xl bg-surface px-3 py-2 font-mono text-xs outline-none ring-1 ring-border focus-visible:ring-glow"
        />
      </div>

      {csvText.trim() && (
        <div className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-border">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">
            Preview
          </p>
          {parsed.headerError ? (
            <p className="mt-2 rounded-xl bg-heat/10 px-3 py-2 text-sm font-semibold text-heat">
              {parsed.headerError}
            </p>
          ) : (
            <>
              <div className="mt-2 grid grid-cols-4 gap-3 text-center text-xs">
                <Stat label="Stays" value={counts.stays} />
                <Stat label="Restaurants" value={counts.restaurants} />
                <Stat label="Experiences" value={counts.experiences} />
                <Stat label="Invalid" value={counts.invalid} tone="heat" />
              </div>
              {counts.invalid > 0 && (
                <ul className="mt-3 max-h-32 overflow-y-auto rounded-lg bg-heat/5 px-3 py-2 text-[11px] text-heat">
                  {parsed.rows
                    .filter((r) => !r.ok)
                    .slice(0, 25)
                    .map((r) => (
                      <li key={r.lineNumber}>
                        Line {r.lineNumber}: {!r.ok ? r.reason : ""}
                      </li>
                    ))}
                  {counts.invalid > 25 && (
                    <li className="italic">
                      …and {counts.invalid - 25} more.
                    </li>
                  )}
                </ul>
              )}
            </>
          )}
          <button
            type="button"
            onClick={onApply}
            disabled={
              pending || validCount === 0 || parsed.headerError != null
            }
            className="mt-3 rounded-full bg-sunset px-5 py-2 text-sm font-bold text-white shadow-card hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {pending
              ? "Applying…"
              : `Apply ${validCount} row${validCount === 1 ? "" : "s"}`}
          </button>
        </div>
      )}

      {result && (
        <div className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-border">
          <p className="text-xs font-bold uppercase tracking-wider text-muted">
            Result
          </p>
          {result.headerError ? (
            <p className="mt-2 rounded-xl bg-heat/10 px-3 py-2 text-sm font-semibold text-heat">
              {result.headerError}
            </p>
          ) : (
            <>
              <div className="mt-2 grid grid-cols-3 gap-3 text-center text-xs">
                <Stat label="Updated" value={result.updated} tone="cool" />
                <Stat label="Skipped" value={result.skipped.length} />
                <Stat
                  label="Failed"
                  value={result.failed.length}
                  tone={result.failed.length > 0 ? "heat" : undefined}
                />
              </div>
              {result.failed.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-heat">
                    Failed
                  </p>
                  <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg bg-heat/5 px-3 py-2 text-[11px] text-heat">
                    {result.failed.map((f, i) => (
                      <li key={`f-${f.lineNumber}-${i}`}>
                        Line {f.lineNumber} ({f.title}): {f.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.skipped.length > 0 && (
                <div className="mt-3">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-muted">
                    Skipped (not in DB yet)
                  </p>
                  <ul className="mt-1 max-h-40 overflow-y-auto rounded-lg bg-foreground/5 px-3 py-2 text-[11px] text-muted">
                    {result.skipped.map((s, i) => (
                      <li key={`s-${s.lineNumber}-${i}`}>
                        Line {s.lineNumber} ({s.title}): {s.reason}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  tone,
}: {
  label: string;
  value: number;
  tone?: "cool" | "heat";
}) {
  const valueClass =
    tone === "cool"
      ? "text-cool"
      : tone === "heat"
        ? "text-heat"
        : "text-foreground";
  return (
    <div>
      <p className={`text-lg font-bold ${valueClass}`}>{value}</p>
      <p className="text-[10px] text-muted">{label}</p>
    </div>
  );
}

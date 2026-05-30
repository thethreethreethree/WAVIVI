"use client";

import { useMemo, useRef, useState, useTransition } from "react";

import { applyBulkImport, type ApplyResult } from "./actions";
import { SOURCES, columnsFor, parseAndValidate } from "./csv";

/** Client-side preview + apply UI. Pure paste/upload UX:
 *
 *  1. Paste CSV text or pick a .csv file.
 *  2. Live preview shows count of valid rows + parse errors per line.
 *  3. "Apply N updates" calls the server action, which re-parses + writes.
 *  4. Result panel lists every row that succeeded / failed.
 */
export function BulkImportClient() {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [csvText, setCsvText] = useState("");
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [pending, startTransition] = useTransition();

  const parsed = useMemo(() => {
    if (!csvText.trim()) return { rows: [], headerError: null };
    return parseAndValidate(csvText);
  }, [csvText]);

  const validCount = parsed.rows.filter((r) => r.ok).length;
  const invalidCount = parsed.rows.length - validCount;

  function onPickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    f.text()
      .then((t) => setCsvText(t))
      .catch(() => {
        /* file read errors will just leave the textarea unchanged */
      });
    // Allow re-picking the same file later.
    e.target.value = "";
  }

  function onApply() {
    setResult(null);
    startTransition(async () => {
      const res = await applyBulkImport(csvText);
      setResult(res);
    });
  }

  function clearAll() {
    setCsvText("");
    setResult(null);
  }

  return (
    <div className="flex flex-col gap-5">
      {/* CSV format reference card */}
      <details className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-border">
        <summary className="cursor-pointer text-sm font-bold">
          CSV format
        </summary>
        <div className="mt-3 flex flex-col gap-3 text-xs text-muted">
          <p>
            Header row required. First column must be{" "}
            <code className="font-mono text-foreground">source</code>, second
            must be <code className="font-mono text-foreground">id</code>.
            Every column after that updates the matching field on the matching
            row.
          </p>
          <p>
            <strong className="text-foreground">Empty cell</strong> → that
            field is left unchanged.{" "}
            <strong className="text-foreground">NULL</strong> (literal,
            case-insensitive) → field is set to SQL null. Useful for clearing
            broken <code className="font-mono text-foreground">photo_url</code>
            s so the card falls back to the 🏠/🌅 emoji.
          </p>
          <pre className="overflow-x-auto rounded-lg bg-background p-3 font-mono text-[11px] text-foreground">
            {`source,id,photo_url,description,featured
stays,7c8a...,https://supabase.co/.../nipa.jpg,Sunset cottage,true
restaurants,2f1e...,NULL,,
experiences,4b3a...,,New blurb here,`}
          </pre>
          {SOURCES.map((s) => (
            <div key={s}>
              <p className="font-semibold text-foreground">
                Allowed columns for {s}:
              </p>
              <p className="mt-1 font-mono text-[10px]">
                {columnsFor(s).join(", ")}
              </p>
            </div>
          ))}
        </div>
      </details>

      {/* Input — file picker + textarea */}
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
          placeholder="Paste CSV here…"
          spellCheck={false}
          className="min-h-[200px] w-full rounded-xl bg-surface px-3 py-2 font-mono text-xs outline-none ring-1 ring-border focus-visible:ring-glow"
        />
      </div>

      {/* Live preview */}
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
              <p className="mt-2 text-sm">
                <span className="font-bold text-cool">{validCount}</span> ready
                to apply
                {invalidCount > 0 && (
                  <>
                    {" · "}
                    <span className="font-bold text-heat">{invalidCount}</span>{" "}
                    will be skipped
                  </>
                )}
              </p>
              {invalidCount > 0 && (
                <ul className="mt-2 max-h-32 overflow-y-auto rounded-lg bg-heat/5 px-3 py-2 text-[11px] text-heat">
                  {parsed.rows
                    .filter((r) => !r.ok)
                    .slice(0, 25)
                    .map((r) => (
                      <li key={r.lineNumber}>
                        Line {r.lineNumber}: {!r.ok ? r.reason : ""}
                      </li>
                    ))}
                  {invalidCount > 25 && (
                    <li className="italic">
                      …and {invalidCount - 25} more.
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
              : `Apply ${validCount} update${validCount === 1 ? "" : "s"}`}
          </button>
        </div>
      )}

      {/* Result */}
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
              <p className="mt-2 text-sm">
                <span className="font-bold text-cool">{result.updated}</span>{" "}
                updated
                {result.failed.length > 0 && (
                  <>
                    {" · "}
                    <span className="font-bold text-heat">
                      {result.failed.length}
                    </span>{" "}
                    failed
                  </>
                )}{" "}
                · {result.total} total
              </p>
              {result.failed.length > 0 && (
                <ul className="mt-2 max-h-60 overflow-y-auto rounded-lg bg-heat/5 px-3 py-2 text-[11px] text-heat">
                  {result.failed.map((f, i) => (
                    <li key={`${f.lineNumber}-${i}`}>
                      Line {f.lineNumber}
                      {f.source && f.id ? ` (${f.source} ${f.id})` : ""}:{" "}
                      {f.reason}
                    </li>
                  ))}
                </ul>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}

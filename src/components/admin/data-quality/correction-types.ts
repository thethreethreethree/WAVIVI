/**
 * Shared types for the data-quality correction-file import flow.
 *
 * Lives in a non-server module because Next "use server" files can't
 * export non-function values without tripping the Turbopack
 * ReferenceError (see memory: turbopack-use-server-type-reexport).
 */

export type CorrectionRowStatus =
  | "updated"
  | "not-found"
  | "ambiguous"
  | "skipped"
  | "failed"
  | "no-change";

export interface CorrectionRowMessage {
  lineNumber: number;
  title: string;
  status: CorrectionRowStatus;
  detail: string;
}

export interface CorrectionResult {
  ok: boolean;
  error: string | null;
  total: number;
  updated: number;
  notFound: number;
  ambiguous: number;
  skipped: number;
  failed: number;
  /** Per-row trace (capped) so the panel can render a scrollable list
   *  without overflowing memory on huge files. Counters above are over
   *  the full file. */
  rowMessages: CorrectionRowMessage[];
}

/** Per-bucket destination summary for the Wrong-Table correction flow. */
export type WrongTableBucket = "stays" | "restaurants" | "experiences";

export interface WrongTableCorrectionResult {
  ok: boolean;
  error: string | null;
  regionId: string | null;
  /** Per-bucket aggregated counts so the UI can render a small summary. */
  buckets: Record<
    WrongTableBucket,
    { parsed: number; added: number; updated: number; skipped: number }
  >;
  /** First handful of row-level parse errors surfaced from the engines. */
  rowErrors: string[];
}

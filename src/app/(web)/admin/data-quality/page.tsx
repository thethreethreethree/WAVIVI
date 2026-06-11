import Link from "next/link";

import { ClassificationSection } from "@/components/admin/data-quality/classification-section";
import { CorrectionUploadButton } from "@/components/admin/data-quality/correction-upload-button";
import { CrossTableSection } from "@/components/admin/data-quality/cross-table-section";
import { ExportDataQualityCsvButton } from "@/components/admin/data-quality/export-button";
import {
  type Source,
  SOURCE_ADMIN_ROUTE,
  SOURCE_LABEL,
  SUSPECT_FILTER,
  classifyUrl,
} from "@/components/admin/data-quality/shared";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RegionRow } from "@/types/supabase";

export const dynamic = "force-dynamic";
// Bulk Apply / Ignore from the Classification Quality section runs as a
// server action invoked from this page, so it inherits this route's
// maxDuration. Default Vercel hobby is 10s — when an admin selects all
// ~thousand utility suspects at once the chunked parallel updates fit
// well under 300s even with cold connections.
export const maxDuration = 300;

/**
 * Admin Data Quality audit — surfaces rows in `stays`, `restaurants`, and
 * `experiences` whose `photo_url` is missing or points at a known
 * placeholder. The Partner Collection ingest occasionally writes Google
 * default-marker / Street View thumbnails when a venue has no real
 * Place Photo; those URLs render as the "blue circle on Street View"
 * card we don't want on the home rail.
 *
 * Drop the list into one screen so admins can clean it row-by-row
 * (open the per-region admin page in a new tab and upload a real photo
 * or null the bad URL).
 *
 * Service-role client used so RLS doesn't truncate the audit — the
 * admin gate above (layout.tsx) already enforces access.
 */

type SuspectRow = {
  id: string;
  name: string;
  region_id: string | null;
  photo_url: string | null;
};

export default async function DataQualityPage() {
  const supabase = createAdminClient();

  const [stays, restaurants, experiences, regionsRes] = await Promise.all([
    supabase
      .from("stays")
      .select("id, name, region_id, photo_url")
      .or(SUSPECT_FILTER)
      .order("name", { ascending: true }),
    supabase
      .from("restaurants")
      .select("id, name, region_id, photo_url")
      .or(SUSPECT_FILTER)
      .order("name", { ascending: true }),
    supabase
      .from("experiences")
      .select("id, name, region_id, photo_url")
      .or(SUSPECT_FILTER)
      .order("name", { ascending: true }),
    supabase.from("regions").select("id, display_name"),
  ]);

  // Build a region label lookup so each row can show "El Nido" instead of a UUID.
  const regions = (regionsRes.data ?? []) as Pick<
    RegionRow,
    "id" | "display_name"
  >[];
  const regionLabel = new Map<string, string>(
    regions.map((r) => [r.id, r.display_name]),
  );

  const groups: { source: Source; rows: SuspectRow[]; error: string | null }[] =
    [
      {
        source: "stays",
        rows: (stays.data ?? []) as SuspectRow[],
        error: stays.error?.message ?? null,
      },
      {
        source: "restaurants",
        rows: (restaurants.data ?? []) as SuspectRow[],
        error: restaurants.error?.message ?? null,
      },
      {
        source: "experiences",
        rows: (experiences.data ?? []) as SuspectRow[],
        error: experiences.error?.message ?? null,
      },
    ];

  const totalBad = groups.reduce((acc, g) => acc + g.rows.length, 0);

  // Server-stamped date for the export filename (YYYY-MM-DD UTC). Done
  // on the server so the user gets a consistent label tied to the audit
  // they're looking at, not the moment they click Export.
  const dateLabel = new Date().toISOString().slice(0, 10);

  return (
    <div className="flex flex-col gap-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Data quality</h1>
        <p className="mt-1 text-sm text-muted">
          Three audits live here. <strong>Photo quality</strong> flags rows
          whose image is missing or a placeholder;{" "}
          <strong>Classification quality</strong> flags rows whose stored
          type/cuisine/category disagrees with what the name suggests (e.g. a
          stay labelled <code>hotel</code> whose name contains{" "}
          <code>Hostel</code>); <strong>Wrong table</strong> flags utilities
          whose name strongly suggests they belong in restaurants / stays /
          experiences instead (e.g. &ldquo;Big Bad Thai Restaurant&rdquo;
          tagged as <code>bank</code>).
        </p>
        {/* Jump buttons — anchor links straight to each audit's section
            so admins don't have to scroll a long page to get to the
            classification list at the bottom. */}
        <div className="mt-3 flex flex-wrap gap-2">
          <a
            href="#photo-quality"
            className="rounded-full bg-sunset px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
          >
            ↓ Photo quality
          </a>
          <a
            href="#classification-quality"
            className="rounded-full bg-cool px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
          >
            ↓ Classification quality
          </a>
          <a
            href="#cross-table-utilities"
            className="rounded-full bg-heat px-3 py-1.5 text-xs font-bold text-white hover:opacity-90"
          >
            ↓ Wrong table
          </a>
        </div>
      </header>

      <section
        id="photo-quality"
        className="scroll-mt-20 flex flex-col gap-4"
      >
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h2 className="text-lg font-bold tracking-tight">Photo quality</h2>
            <p className="mt-1 text-sm text-muted">
              Rows whose <code className="font-mono text-xs">photo_url</code> is
              missing or points at a known placeholder image (Google default
              avatar, Street View thumb, Unsplash stock, etc.). Fix by opening
              the row&apos;s admin page and either uploading a real photo or
              clearing the URL — a null falls back to the clean 🏠 / 🌅 brand
              glyph instead of a busted Google placeholder.
            </p>
            <p className="mt-2 text-xs text-muted">
              <strong>Faster path:</strong> click{" "}
              <strong>↓ Export CSV</strong>, drop new photo URLs into the blank{" "}
              <code className="font-mono text-[11px]">Image</code> column, then
              re-upload through{" "}
              <Link
                href="/admin/partner-import"
                className="font-bold text-glow underline-offset-2 hover:underline"
              >
                /admin/partner-import
              </Link>{" "}
              to fix the whole batch at once.
            </p>
          </div>
          {/* Export + correction-file round-trip lives side-by-side so
              the workflow (Export → edit photos → Re-upload) is one
              visual unit. Correction button is shown unconditionally
              because admins might be re-uploading from a previous
              audit's file even when the current audit is empty. */}
          <div className="flex flex-wrap items-start gap-3">
            {totalBad > 0 && (
              <ExportDataQualityCsvButton dateLabel={dateLabel} />
            )}
            <CorrectionUploadButton mode="photo" />
          </div>
        </header>

      <div className="rounded-2xl bg-sunset p-4 text-white shadow-card">
        <p className="text-xs font-bold uppercase tracking-wider text-white/80">
          Summary
        </p>
        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          <div>
            <p className="text-lg font-bold">{totalBad}</p>
            <p className="text-[10px] text-white/85">Bad photos total</p>
          </div>
          {groups.map((g) => (
            <div key={g.source}>
              <p className="text-lg font-bold">{g.rows.length}</p>
              <p className="text-[10px] text-white/85">{SOURCE_LABEL[g.source]}</p>
            </div>
          ))}
        </div>
      </div>

      {groups.map((g) => (
        <section key={g.source}>
          <h2 className="mb-2 text-sm font-bold">
            {SOURCE_LABEL[g.source]} ({g.rows.length})
          </h2>

          {g.error && (
            <p className="mb-2 rounded-xl bg-heat/10 px-3 py-2 text-xs font-semibold text-heat">
              Query failed: {g.error}
            </p>
          )}

          {g.rows.length === 0 && !g.error && (
            <p className="rounded-2xl bg-surface px-4 py-6 text-center text-sm text-muted ring-1 ring-border">
              Nothing flagged — every {g.source} row has a real-looking photo
              URL.
            </p>
          )}

          {g.rows.length > 0 && (
            <ul className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-border">
              {g.rows.map((r, i) => {
                const tag = classifyUrl(r.photo_url);
                const regionName = r.region_id
                  ? regionLabel.get(r.region_id) ?? r.region_id
                  : "—";
                const editHref = r.region_id
                  ? `${SOURCE_ADMIN_ROUTE[g.source]}/${r.region_id}`
                  : SOURCE_ADMIN_ROUTE[g.source];
                return (
                  <li
                    key={`${g.source}-${r.id}`}
                    className={`flex items-center gap-3 px-4 py-3 ${
                      i > 0 ? "border-t border-border" : ""
                    }`}
                  >
                    {/* Tiny live preview of whatever the row actually has, so
                        the admin can see the bad image at a glance. Plain
                        <img> intentionally — next/image would reject hosts
                        we haven't allow-listed and break the audit view. */}
                    {r.photo_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={r.photo_url}
                        alt=""
                        referrerPolicy="no-referrer"
                        loading="lazy"
                        className="h-12 w-12 shrink-0 rounded-lg bg-border object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden
                        className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-border"
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                          src="/icons/rustic/close_x.png"
                          alt=""
                          aria-hidden
                          className="h-6 w-6 object-contain opacity-70"
                        />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-semibold">
                        {r.name}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        {regionName} ·{" "}
                        <span className="rounded-full bg-heat/15 px-1.5 py-0.5 text-[10px] font-bold text-heat">
                          {tag}
                        </span>
                      </span>
                      {r.photo_url && (
                        <span className="mt-0.5 block truncate font-mono text-[10px] text-muted/80">
                          {r.photo_url}
                        </span>
                      )}
                    </span>
                    <Link
                      href={editHref}
                      className="shrink-0 rounded-full bg-glow/15 px-3 py-1.5 text-xs font-bold text-glow hover:bg-glow/25"
                    >
                      Open admin →
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      ))}
      </section>

      <section id="classification-quality" className="scroll-mt-20">
        <ClassificationSection />
      </section>

      <section id="cross-table-utilities" className="scroll-mt-20">
        <CrossTableSection />
      </section>
    </div>
  );
}

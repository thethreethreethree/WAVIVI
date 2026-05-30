import { PartnerImportClient } from "@/components/admin/partner-import/partner-import-client";

export const dynamic = "force-dynamic";

export default function PartnerImportPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">
          Partner Collection import
        </h1>
        <p className="mt-1 text-sm text-muted">
          Upload the CSV your Partner Collection Chrome extension exports.
          Each row is routed by its <code className="font-mono">Industry</code>
          column to the right table (stays / restaurants / experiences) and
          matched against the existing record by{" "}
          <code className="font-mono">Title</code>. Non-empty cells overwrite
          existing values — perfect for backfilling the broken photos and
          descriptions flagged on <code className="font-mono">/admin/data-quality</code>.
        </p>
        <p className="mt-2 text-xs text-muted">
          Rows that don&apos;t match an existing record are skipped; this
          importer doesn&apos;t insert (it would need lat/lng + a source_ref
          to do that safely, which partner exports usually omit). To add brand
          new venues, use the per-region admin CSV upload on{" "}
          <code className="font-mono">/admin/stays/&lt;regionId&gt;</code> etc.
        </p>
      </header>

      <PartnerImportClient />
    </div>
  );
}

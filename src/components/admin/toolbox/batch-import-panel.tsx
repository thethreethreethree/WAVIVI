import {
  BatchUtilityImportClient,
  type RegionOption,
} from "@/components/admin/batch-utility-import/batch-utility-import-client";

/**
 * Server-rendered wrapper that drops the multi-category batch utility
 * importer onto the per-region toolbox admin page
 * (/admin/toolbox/[regionId]). Same client component the standalone
 * /admin/batch-utility-import page uses, just with the region locked
 * to the page's own regionId so admins don't have to re-pick it.
 *
 * Pairs with the legacy per-category `<CsvImport />` already on the
 * page — use this one when uploading the wide CSV the scraper emits;
 * use the older one when you want to refresh a single category from
 * a per-category file.
 */
export function BatchImportPanel({
  region,
}: {
  region: RegionOption;
}) {
  return (
    <section className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-border">
      <header className="mb-3">
        <h2 className="text-sm font-bold">
          Batch utility import (multi-category)
        </h2>
        <p className="mt-0.5 text-xs text-muted">
          Upload the wide CSV from the scraper — rows are routed by the{" "}
          <code className="font-mono text-xs">Industry</code> column and
          cities are auto-created from the{" "}
          <code className="font-mono text-xs">City</code> column. Same engine
          as <code className="font-mono text-xs">/admin/batch-utility-import</code>{" "}
          but locked to this region.
        </p>
      </header>
      <BatchUtilityImportClient
        regions={[region]}
        lockedRegionId={region.id}
      />
    </section>
  );
}

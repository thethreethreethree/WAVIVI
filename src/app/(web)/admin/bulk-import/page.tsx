import Link from "next/link";

import { BulkImportClient } from "@/components/admin/bulk-import/bulk-import-client";

export const dynamic = "force-dynamic";

export default function BulkImportPage() {
  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Bulk import</h1>
        <p className="mt-1 text-sm text-muted">
          Update any editable column on existing stays / restaurants /
          experiences rows from a CSV. Paste the CSV below or upload a{" "}
          <code className="font-mono text-xs">.csv</code> file — you&apos;ll
          see a row-by-row preview before any updates are applied.
        </p>
        <p className="mt-2 text-xs text-muted">
          Use cases: bulk-fix the broken photos from{" "}
          <Link
            href="/admin/data-quality"
            className="font-bold text-glow underline-offset-2 hover:underline"
          >
            /admin/data-quality
          </Link>
          , re-write descriptions across a region, toggle Featured / Top pick
          on a batch of rows, swap region assignments, etc.
        </p>
      </header>

      <BulkImportClient />
    </div>
  );
}

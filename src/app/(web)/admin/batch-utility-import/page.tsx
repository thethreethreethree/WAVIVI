import Link from "next/link";

import {
  BatchUtilityImportClient,
  type RegionOption,
} from "@/components/admin/batch-utility-import/batch-utility-import-client";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
// Mirrors batch-city-import — chunked applies stay under the 60 s default,
// but the cache-bust + city upserts can push the whole apply into the
// minutes range for 2000-row scrapes.
export const maxDuration = 300;

/**
 * Batch utility import — admin uploads one CSV that covers every
 * category of utility (ATM, laundry, pharmacy, …) for a region. Mirrors
 * the place batch-city-import: routes by Industry column, auto-creates
 * cities from the City column, applies in chunked passes through the
 * canonical csv-import-engine so the proven 60 m proximity dedup
 * behaviour is preserved.
 */
export default async function BatchUtilityImportPage() {
  const supabase = await createClient();
  const { data } = await supabase
    .from("regions")
    .select("id, display_name, city, province, country")
    .order("country", { ascending: true })
    .order("display_name", { ascending: true });
  const regions = (data ?? []) as RegionOption[];

  return (
    <div className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">
          Batch utility import
        </h1>
        <p className="mt-1 text-sm text-muted">
          Upload one CSV that covers every utility category (ATM, laundry,
          pharmacy, scooter rental, …) for a single region. Rows are routed
          by the{" "}
          <code className="font-mono text-xs">Industry</code> column to the
          right utility category, and the{" "}
          <code className="font-mono text-xs">City</code> column auto-seeds{" "}
          <Link
            href="/admin/cities"
            className="font-bold text-glow underline-offset-2 hover:underline"
          >
            cities
          </Link>{" "}
          so utilities are bucketed the same way places are.
        </p>
        <p className="mt-2 text-xs text-muted">
          Categories the importer routes to are listed on{" "}
          <Link
            href="/admin/toolbox/categories"
            className="font-bold text-glow underline-offset-2 hover:underline"
          >
            /admin/toolbox/categories
          </Link>
          . Unknown Industry labels land in the &quot;Unrouted&quot; pile of
          the preview so you can spot them before applying.
        </p>
      </header>

      <BatchUtilityImportClient regions={regions} />
    </div>
  );
}

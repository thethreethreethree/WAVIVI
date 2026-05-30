import Link from "next/link";

import {
  BatchCityImportClient,
  type RegionOption,
} from "@/components/admin/batch-city-import/batch-city-import-client";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function BatchCityImportPage() {
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
        <h1 className="text-2xl font-bold tracking-tight">Batch city import</h1>
        <p className="mt-1 text-sm text-muted">
          Upload a single CSV that covers a city&apos;s{" "}
          <strong className="text-foreground">stays</strong>,{" "}
          <strong className="text-foreground">eats</strong>, and{" "}
          <strong className="text-foreground">things to do</strong> together —
          the kind your scraper exports per city. Rows are routed by the{" "}
          <code className="font-mono text-xs">Source Query</code> column to the
          right table (stays / restaurants / experiences) and ingested via the
          existing per-region engine, so the proven 60 m location-match
          dedup applies identically.
        </p>
        <p className="mt-2 text-xs text-muted">
          The old per-region uploaders on{" "}
          <Link
            href="/admin/stays"
            className="font-bold text-glow underline-offset-2 hover:underline"
          >
            /admin/stays
          </Link>
          ,{" "}
          <Link
            href="/admin/eat"
            className="font-bold text-glow underline-offset-2 hover:underline"
          >
            /admin/eat
          </Link>
          ,{" "}
          <Link
            href="/admin/experiences"
            className="font-bold text-glow underline-offset-2 hover:underline"
          >
            /admin/experiences
          </Link>{" "}
          still work — this is an additional path for one-shot city batches.
        </p>
      </header>

      <BatchCityImportClient regions={regions} />
    </div>
  );
}

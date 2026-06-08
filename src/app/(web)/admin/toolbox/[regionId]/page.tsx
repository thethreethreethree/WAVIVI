import Link from "next/link";
import { notFound } from "next/navigation";

import { BatchImportPanel } from "@/components/admin/toolbox/batch-import-panel";
import { CsvImport } from "@/components/admin/toolbox/csv-import";
import { ScanButton } from "@/components/admin/toolbox/scan-button";
import { humanizeTime } from "@/components/admin/toolbox/toolbox-utils";
import { UtilitiesList } from "@/components/admin/toolbox/utilities-list";
import { createClient } from "@/lib/supabase/server";
import type { RegionRow, UtilityRow } from "@/types/supabase";

export const dynamic = "force-dynamic";

export default async function RegionUtilitiesPage({
  params,
}: {
  params: Promise<{ regionId: string }>;
}) {
  const { regionId } = await params;
  const supabase = await createClient();

  const [regionRes, utilitiesRes] = await Promise.all([
    supabase.from("regions").select("*").eq("id", regionId).single(),
    supabase
      .from("traveler_utilities")
      .select("*")
      .eq("region_id", regionId)
      .order("name", { ascending: true }),
  ]);

  const region = regionRes.data as RegionRow | null;
  if (!region) notFound();

  const utilities = (utilitiesRes.data ?? []) as UtilityRow[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/toolbox"
          className="text-xs font-bold text-glow hover:underline"
        >
          ‹ All regions
        </Link>
        <div className="mt-1 flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {region.display_name}
            </h1>
            <p className="text-sm text-muted">{region.country}</p>
          </div>
          <ScanButton regionId={region.id} size="md" />
        </div>
      </div>

      {/* Region meta */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {[
          {
            label: "Coordinates",
            value: `${region.latitude.toFixed(4)}, ${region.longitude.toFixed(4)}`,
          },
          { label: "Radius", value: `${region.radius_km} km` },
          { label: "Utilities", value: String(utilities.length) },
          { label: "Last scan", value: humanizeTime(region.last_scan_at) },
        ].map((m) => (
          <div
            key={m.label}
            className="rounded-2xl bg-surface p-3.5 shadow-card ring-1 ring-border"
          >
            <p className="text-xs font-medium text-muted">{m.label}</p>
            <p className="mt-1 truncate text-sm font-bold tracking-tight">
              {m.value}
            </p>
          </div>
        ))}
      </div>

      {/* New multi-category importer — drop the scraper's wide CSV here
          to upsert every category for this region in one pass with
          city_id resolution. */}
      <BatchImportPanel
        region={{
          id: region.id,
          display_name: region.display_name,
          city: region.city,
          province: region.province,
          country: region.country,
        }}
      />

      {/* Legacy per-category importer — kept for the narrow refresh case
          (one category at a time from a per-category file). */}
      <CsvImport regionId={region.id} />

      <section>
        <h2 className="mb-2 text-sm font-bold">Utilities</h2>
        <UtilitiesList utilities={utilities} />
      </section>
    </div>
  );
}

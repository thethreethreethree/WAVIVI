import Link from "next/link";

import { AddRegionForm } from "@/components/admin/toolbox/add-region-form";
import { RegionCard } from "@/components/admin/toolbox/region-card";
import { humanizeTime } from "@/components/admin/toolbox/toolbox-utils";
import { createClient } from "@/lib/supabase/server";
import type { RegionRow } from "@/types/supabase";

export const dynamic = "force-dynamic";

export default async function ToolboxPage() {
  const supabase = await createClient();

  const [
    regionsRes,
    utilitiesCountRes,
    activeScansRes,
    lastScanRes,
    openReportsRes,
  ] = await Promise.all([
    supabase
      .from("regions")
      .select("*")
      .order("display_name", { ascending: true }),
    supabase
      .from("traveler_utilities")
      .select("*", { count: "exact", head: true }),
    supabase
      .from("scan_jobs")
      .select("*", { count: "exact", head: true })
      .in("status", ["pending", "running"]),
    supabase
      .from("scan_jobs")
      .select("completed_at")
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(1),
    supabase
      .from("traveler_reports")
      .select("*", { count: "exact", head: true })
      .eq("status", "open"),
  ]);

  const regions = (regionsRes.data ?? []) as RegionRow[];

  // Per-region utility counts.
  const utilityCounts = new Map<string, number>();
  await Promise.all(
    regions.map(async (r) => {
      const { count } = await supabase
        .from("traveler_utilities")
        .select("*", { count: "exact", head: true })
        .eq("region_id", r.id);
      utilityCounts.set(r.id, count ?? 0);
    }),
  );

  const lastScanAt =
    (lastScanRes.data?.[0]?.completed_at as string | null | undefined) ?? null;

  const tiles = [
    { label: "Regions", value: regions.length },
    { label: "Utilities", value: utilitiesCountRes.count ?? 0 },
    {
      label: "Active scans",
      value: activeScansRes.count ?? 0,
      hint: `Last scan ${humanizeTime(lastScanAt)}`,
    },
    { label: "Open reports", value: openReportsRes.count ?? 0 },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Traveler Toolbox
          </h1>
          <p className="text-sm text-muted">
            Manage scan regions, utility pins, and the discovery engine.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/admin/stays"
            className="rounded-full px-3 py-1.5 text-xs font-bold text-glow ring-1 ring-border hover:bg-glow/10"
          >
            Stays admin ›
          </Link>
          <Link
            href="/admin/toolbox/scans"
            className="rounded-full px-3 py-1.5 text-xs font-bold text-glow ring-1 ring-border hover:bg-glow/10"
          >
            Scan jobs ›
          </Link>
        </div>
      </div>

      {/* Analytics tiles */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        {tiles.map((t) => (
          <div
            key={t.label}
            className="rounded-2xl bg-surface p-3.5 shadow-card ring-1 ring-border"
          >
            <p className="text-xs font-medium text-muted">{t.label}</p>
            <p className="mt-1 text-xl font-bold tracking-tight">{t.value}</p>
            {t.hint && (
              <p className="mt-1 truncate text-[10px] text-muted">{t.hint}</p>
            )}
          </div>
        ))}
      </div>

      {/* Add region */}
      <AddRegionForm />

      {/* Region cards */}
      <section>
        <h2 className="mb-2 text-sm font-bold">
          Regions{" "}
          <span className="font-normal text-muted">({regions.length})</span>
        </h2>
        {regions.length === 0 ? (
          <p className="rounded-2xl bg-surface px-4 py-8 text-center text-sm text-muted shadow-card ring-1 ring-border">
            No regions yet — add one above to start scanning.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {regions.map((r) => (
              <RegionCard
                key={r.id}
                region={r}
                utilityCount={utilityCounts.get(r.id) ?? 0}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

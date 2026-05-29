import Link from "next/link";

import { AddRegionForm } from "@/components/admin/toolbox/add-region-form";
import { RegionCard } from "@/components/admin/toolbox/region-card";
import { createClient } from "@/lib/supabase/server";
import type { RegionRow } from "@/types/supabase";

export const dynamic = "force-dynamic";

/**
 * Dedicated Regions admin page — manage every place Wondavu operates in.
 *
 * Toolbox/Stays/Eat/Events all FK to `regions.id`, and the user-facing
 * region picker reads the same list, so this page is the single source
 * of truth for "where is Wondavu live right now". Kept separate from the
 * Toolbox tab (which is utilities + scans-focused) so adding/disabling
 * a country isn't buried under traveler-utility chrome.
 */
export default async function AdminRegionsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("regions")
    .select("*")
    .order("country", { ascending: true })
    .order("display_name", { ascending: true });
  const regions = (data ?? []) as RegionRow[];

  // Per-region utility counts so admins can see at a glance which
  // regions have toolbox data ingested and which are empty.
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

  // Group regions by country for the list — same convention as the
  // user-facing region picker, so admins build the mental model that
  // matches what travelers see.
  const groups = new Map<string, RegionRow[]>();
  for (const r of regions) {
    const k = r.country ?? "Unassigned";
    const arr = groups.get(k) ?? [];
    arr.push(r);
    groups.set(k, arr);
  }

  const activeCount = regions.filter((r) => r.active).length;

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Regions</h1>
          <p className="text-sm text-muted">
            Add and manage the places Wondavu operates in. Each region is a
            destination users can switch into from the globe picker; it
            scopes Stays, Eat, Events, Things to do, and Toolbox utilities.
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <Link
            href="/admin/toolbox"
            className="rounded-full px-3 py-1.5 text-xs font-bold text-glow ring-1 ring-border hover:bg-glow/10"
          >
            Toolbox ›
          </Link>
        </div>
      </div>

      {/* Tiles — counts at a glance. */}
      <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
        <Tile label="Total regions" value={regions.length} />
        <Tile label="Active" value={activeCount} />
        <Tile label="Countries" value={groups.size} />
        <Tile
          label="Utility pins"
          value={Array.from(utilityCounts.values()).reduce((a, b) => a + b, 0)}
        />
      </div>

      {/* Add new region */}
      <AddRegionForm />

      {/* Region list, grouped by country */}
      {regions.length === 0 ? (
        <p className="rounded-2xl bg-surface px-4 py-8 text-center text-sm text-muted shadow-card ring-1 ring-border">
          No regions yet — add your first one above.
        </p>
      ) : (
        <div className="flex flex-col gap-6">
          {Array.from(groups.entries()).map(([country, rows]) => (
            <section key={country}>
              <h2 className="mb-2 text-sm font-bold uppercase tracking-wider text-muted">
                {country}{" "}
                <span className="ml-1 font-normal normal-case">
                  ({rows.length})
                </span>
              </h2>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                {rows.map((r) => (
                  <RegionCard
                    key={r.id}
                    region={r}
                    utilityCount={utilityCounts.get(r.id) ?? 0}
                  />
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}

function Tile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-surface p-3.5 shadow-card ring-1 ring-border">
      <p className="text-xs font-medium text-muted">{label}</p>
      <p className="mt-1 text-xl font-bold tracking-tight">{value}</p>
    </div>
  );
}

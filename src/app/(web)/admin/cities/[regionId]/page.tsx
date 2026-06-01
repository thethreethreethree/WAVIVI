import Link from "next/link";
import { notFound } from "next/navigation";

import {
  CitiesList,
  type CityWithCounts,
} from "@/components/admin/cities/cities-list";
import { createClient } from "@/lib/supabase/server";
import type { CityRow, RegionRow } from "@/types/supabase";

export const dynamic = "force-dynamic";

/** Per-region cities admin — list every city in the region with place
 *  counts, plus rename / merge / delete actions. */
export default async function RegionCitiesPage({
  params,
}: {
  params: Promise<{ regionId: string }>;
}) {
  const { regionId } = await params;
  const supabase = await createClient();

  const [regionRes, citiesRes, staysRes, restaurantsRes, experiencesRes] =
    await Promise.all([
      supabase.from("regions").select("*").eq("id", regionId).single(),
      supabase
        .from("cities")
        .select("id, region_id, slug, name, created_at")
        .eq("region_id", regionId)
        .order("name", { ascending: true }),
      supabase
        .from("stays")
        .select("city_id")
        .eq("region_id", regionId)
        .not("city_id", "is", null),
      supabase
        .from("restaurants")
        .select("city_id")
        .eq("region_id", regionId)
        .not("city_id", "is", null),
      supabase
        .from("experiences")
        .select("city_id")
        .eq("region_id", regionId)
        .not("city_id", "is", null),
    ]);

  const region = regionRes.data as RegionRow | null;
  if (!region) notFound();

  const cities = (citiesRes.data ?? []) as CityRow[];

  // Tally counts per city across all three place tables in one pass each
  // — cheaper than a head-only query per (city, table) combination.
  function tally(rows: { city_id: string | null }[]): Map<string, number> {
    const m = new Map<string, number>();
    for (const r of rows) {
      if (!r.city_id) continue;
      m.set(r.city_id, (m.get(r.city_id) ?? 0) + 1);
    }
    return m;
  }
  const stayCounts = tally(staysRes.data ?? []);
  const restCounts = tally(restaurantsRes.data ?? []);
  const expCounts = tally(experiencesRes.data ?? []);

  const withCounts: CityWithCounts[] = cities.map((c) => ({
    ...c,
    stays: stayCounts.get(c.id) ?? 0,
    restaurants: restCounts.get(c.id) ?? 0,
    experiences: expCounts.get(c.id) ?? 0,
  }));

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            Cities · {region.display_name}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {[region.city, region.province, region.country]
              .filter(Boolean)
              .join(", ")}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/cities"
            className="rounded-full bg-foreground/10 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-foreground/15"
          >
            ← All regions
          </Link>
          <Link
            href={`/admin/stays/${regionId}`}
            className="rounded-full bg-foreground/10 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-foreground/15"
          >
            Stays
          </Link>
          <Link
            href={`/admin/eat/${regionId}`}
            className="rounded-full bg-foreground/10 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-foreground/15"
          >
            Eat
          </Link>
          <Link
            href={`/admin/experiences/${regionId}`}
            className="rounded-full bg-foreground/10 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-foreground/15"
          >
            Experiences
          </Link>
        </div>
      </header>

      <section className="mt-8">
        <CitiesList regionId={regionId} cities={withCounts} />
      </section>
    </div>
  );
}

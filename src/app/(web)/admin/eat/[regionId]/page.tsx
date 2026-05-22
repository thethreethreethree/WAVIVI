import Link from "next/link";
import { notFound } from "next/navigation";

import { RestaurantsCsvImport } from "@/components/admin/restaurants/csv-import";
import { createClient } from "@/lib/supabase/server";
import type { RegionRow, RestaurantRow } from "@/types/supabase";

export const dynamic = "force-dynamic";

export default async function RegionEatPage({
  params,
}: {
  params: Promise<{ regionId: string }>;
}) {
  const { regionId } = await params;
  const supabase = await createClient();

  const [regionRes, restaurantsRes] = await Promise.all([
    supabase.from("regions").select("*").eq("id", regionId).single(),
    supabase
      .from("restaurants")
      .select("*")
      .eq("region_id", regionId)
      .order("name", { ascending: true }),
  ]);

  const region = regionRes.data as RegionRow | null;
  if (!region) notFound();

  const restaurants = (restaurantsRes.data ?? []) as RestaurantRow[];

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            Where to Eat · {region.display_name}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {[region.city, region.province, region.country]
              .filter(Boolean)
              .join(", ")}
          </h1>
        </div>
        <Link
          href="/admin/eat"
          className="rounded-full bg-foreground/10 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-foreground/15"
        >
          ← All regions
        </Link>
      </header>

      <div className="mt-6">
        <RestaurantsCsvImport regionId={regionId} />
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
          Restaurants in this region
        </h2>
        {restaurants.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-surface px-4 py-8 text-center text-sm text-muted shadow-card ring-1 ring-border">
            None yet — upload a CSV above to get started.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {restaurants.map((r) => (
              <li
                key={r.id}
                className="flex items-start justify-between gap-3 rounded-2xl bg-surface p-3 shadow-card ring-1 ring-border"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{r.name}</p>
                  <p className="truncate text-xs text-muted">
                    {[r.cuisine, r.price_range].filter(Boolean).join(" · ")}
                    {r.address ? ` · ${r.address}` : ""}
                  </p>
                </div>
                <div className="shrink-0 text-right text-[11px]">
                  {r.rating != null && (
                    <p className="font-bold text-foreground">
                      ★ {r.rating.toFixed(1)}
                    </p>
                  )}
                  <p className="text-muted">{r.review_count} reviews</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

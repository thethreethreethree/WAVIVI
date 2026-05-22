import Link from "next/link";
import { notFound } from "next/navigation";

import { RestaurantsCsvImport } from "@/components/admin/restaurants/csv-import";
import { RestaurantsList } from "@/components/admin/restaurants/restaurants-list";
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
        <div className="mt-3">
          <RestaurantsList restaurants={restaurants} />
        </div>
      </section>
    </div>
  );
}

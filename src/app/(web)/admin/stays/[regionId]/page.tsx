import Link from "next/link";
import { notFound } from "next/navigation";

import { StaysCsvImport } from "@/components/admin/stays/csv-import";
import { StaysList } from "@/components/admin/stays/stays-list";
import { createClient } from "@/lib/supabase/server";
import type { RegionRow, StayRow } from "@/types/supabase";

export const dynamic = "force-dynamic";

export default async function RegionStaysPage({
  params,
}: {
  params: Promise<{ regionId: string }>;
}) {
  const { regionId } = await params;
  const supabase = await createClient();

  const [regionRes, staysRes] = await Promise.all([
    supabase.from("regions").select("*").eq("id", regionId).single(),
    supabase
      .from("stays")
      .select("*")
      .eq("region_id", regionId)
      .order("name", { ascending: true }),
  ]);

  const region = regionRes.data as RegionRow | null;
  if (!region) notFound();

  const stays = (staysRes.data ?? []) as StayRow[];

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            Stays · {region.display_name}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {[region.city, region.province, region.country]
              .filter(Boolean)
              .join(", ")}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/stays"
            className="rounded-full bg-foreground/10 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-foreground/15"
          >
            ← All regions
          </Link>
          <Link
            href={`/admin/toolbox/${regionId}`}
            className="rounded-full bg-foreground/10 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-foreground/15"
          >
            Toolbox utilities
          </Link>
        </div>
      </header>

      <div className="mt-6">
        <StaysCsvImport regionId={regionId} />
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
          Stays in this region
        </h2>
        <div className="mt-3">
          <StaysList stays={stays} />
        </div>
      </section>
    </div>
  );
}

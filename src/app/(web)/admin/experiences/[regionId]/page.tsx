import Link from "next/link";
import { notFound } from "next/navigation";

import { ExperiencesCsvImport } from "@/components/admin/experiences/csv-import";
import { ExperiencesList } from "@/components/admin/experiences/experiences-list";
import { createClient } from "@/lib/supabase/server";
import type { ExperienceRow, RegionRow } from "@/types/supabase";

export const dynamic = "force-dynamic";

export default async function RegionExperiencesPage({
  params,
}: {
  params: Promise<{ regionId: string }>;
}) {
  const { regionId } = await params;
  const supabase = await createClient();

  const [regionRes, experiencesRes] = await Promise.all([
    supabase.from("regions").select("*").eq("id", regionId).single(),
    supabase
      .from("experiences")
      .select("*")
      .eq("region_id", regionId)
      .order("name", { ascending: true }),
  ]);

  const region = regionRes.data as RegionRow | null;
  if (!region) notFound();

  const experiences = (experiencesRes.data ?? []) as ExperienceRow[];

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            Experiences · {region.display_name}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {[region.city, region.province, region.country]
              .filter(Boolean)
              .join(", ")}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/experiences"
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
        </div>
      </header>

      <div className="mt-6">
        <ExperiencesCsvImport regionId={regionId} />
      </div>

      <section className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
          Experiences in this region
        </h2>
        <div className="mt-3">
          <ExperiencesList experiences={experiences} />
        </div>
      </section>
    </div>
  );
}

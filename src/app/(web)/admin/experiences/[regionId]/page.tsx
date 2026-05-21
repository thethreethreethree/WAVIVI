import Link from "next/link";
import { notFound } from "next/navigation";

import { ExperiencesCsvImport } from "@/components/admin/experiences/csv-import";
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
        {experiences.length === 0 ? (
          <p className="mt-3 rounded-2xl bg-surface px-4 py-8 text-center text-sm text-muted shadow-card ring-1 ring-border">
            None yet — upload a CSV above to get started.
          </p>
        ) : (
          <ul className="mt-3 flex flex-col gap-2">
            {experiences.map((e) => (
              <li
                key={e.id}
                className="flex items-start justify-between gap-3 rounded-2xl bg-surface p-3 shadow-card ring-1 ring-border"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{e.name}</p>
                  <p className="truncate text-xs text-muted">
                    {e.activity_type}
                    {e.address ? ` · ${e.address}` : ""}
                  </p>
                  {e.description && (
                    <p className="mt-1 line-clamp-2 text-xs text-muted">
                      {e.description}
                    </p>
                  )}
                </div>
                <div className="shrink-0 text-right text-[11px]">
                  {e.rating != null && (
                    <p className="font-bold text-foreground">
                      ★ {e.rating.toFixed(1)}
                    </p>
                  )}
                  <p className="text-muted">{e.review_count} reviews</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

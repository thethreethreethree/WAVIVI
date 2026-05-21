import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import type { RegionRow } from "@/types/supabase";

export const dynamic = "force-dynamic";

/** Admin landing for experiences — pick a region to manage its activities. */
export default async function ExperiencesAdminLandingPage() {
  const supabase = await createClient();

  const [regionsRes, totalRes] = await Promise.all([
    supabase
      .from("regions")
      .select("*")
      .order("display_name", { ascending: true }),
    supabase.from("experiences").select("*", { count: "exact", head: true }),
  ]);

  const regions = (regionsRes.data ?? []) as RegionRow[];

  const counts = new Map<string, number>();
  await Promise.all(
    regions.map(async (r) => {
      const { count } = await supabase
        .from("experiences")
        .select("*", { count: "exact", head: true })
        .eq("region_id", r.id);
      counts.set(r.id, count ?? 0);
    }),
  );

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Experiences admin
          </h1>
          <p className="mt-1 text-sm text-muted">
            {totalRes.count ?? 0} experiences across {regions.length} regions.
          </p>
        </div>
        <Link
          href="/admin/stays"
          className="rounded-full bg-foreground/10 px-4 py-2 text-sm font-bold text-foreground hover:bg-foreground/15"
        >
          Stays admin →
        </Link>
      </header>

      <section className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
          Regions
        </h2>
        <p className="mt-1 text-xs text-muted">
          Regions are managed under{" "}
          <Link href="/admin/toolbox" className="text-glow underline">
            Toolbox admin
          </Link>
          . Pick one to manage its experiences.
        </p>

        {regions.length === 0 ? (
          <p className="mt-6 rounded-2xl bg-surface px-4 py-8 text-center text-sm text-muted shadow-card ring-1 ring-border">
            No regions yet — create one in Toolbox admin first.
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {regions.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/admin/experiences/${r.id}`}
                  className="block rounded-2xl bg-surface p-4 shadow-card ring-1 ring-border transition-colors hover:ring-glow/50"
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-bold">
                        {r.display_name}
                      </p>
                      <p className="truncate text-xs text-muted">
                        {[r.city, r.province, r.country]
                          .filter(Boolean)
                          .join(", ")}
                      </p>
                    </div>
                    <span className="shrink-0 rounded-full bg-glow/15 px-3 py-1 text-xs font-bold text-glow">
                      {counts.get(r.id) ?? 0} experiences
                    </span>
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

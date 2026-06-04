import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import type { RegionRow } from "@/types/supabase";

export const dynamic = "force-dynamic";

/** Admin landing for the Travelers Feed — pick a region to manage
 *  its hand-curated posts. Mirrors /admin/stays / /admin/eat /
 *  /admin/experiences for consistency. */
export default async function FeedAdminLandingPage() {
  const supabase = await createClient();

  const [regionsRes, feedCountRes] = await Promise.all([
    supabase
      .from("regions")
      .select("*")
      .order("display_name", { ascending: true }),
    supabase.from("feed_posts").select("*", { count: "exact", head: true }),
  ]);

  const regions = (regionsRes.data ?? []) as RegionRow[];

  // Per-region post count — one tiny query per region; admin-only,
  // small tables, fine to fan out.
  const counts = new Map<string, number>();
  await Promise.all(
    regions.map(async (r) => {
      const { count } = await supabase
        .from("feed_posts")
        .select("*", { count: "exact", head: true })
        .eq("region_id", r.id);
      counts.set(r.id, count ?? 0);
    }),
  );

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Feed admin</h1>
        <p className="mt-1 text-sm text-muted">
          {feedCountRes.count ?? 0} posts across {regions.length} regions.
          Paste IG post URLs + handles to populate the Travelers Feed on
          /feed. Photos are mirrored to Supabase Storage so IG CDN
          rotation can&apos;t break them.
        </p>
      </header>

      <section className="mt-8">
        <h2 className="text-sm font-bold uppercase tracking-wide text-muted">
          Regions
        </h2>
        {regions.length === 0 ? (
          <p className="mt-6 rounded-2xl bg-surface px-4 py-8 text-center text-sm text-muted shadow-card ring-1 ring-border">
            No regions yet — create one in{" "}
            <Link href="/admin/toolbox" className="text-glow underline">
              Toolbox admin
            </Link>
            .
          </p>
        ) : (
          <ul className="mt-4 grid gap-3 sm:grid-cols-2">
            {regions.map((r) => (
              <li key={r.id}>
                <Link
                  href={`/admin/feed/${r.id}`}
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
                      {counts.get(r.id) ?? 0} posts
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

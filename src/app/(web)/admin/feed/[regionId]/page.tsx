import Link from "next/link";
import { notFound } from "next/navigation";

import { FeedAdminClient } from "@/components/admin/feed/feed-admin-client";
import { createClient } from "@/lib/supabase/server";
import type { FeedPostRow, RegionRow } from "@/types/supabase";

export const dynamic = "force-dynamic";

/** Per-region Feed admin — paste-a-post compose form on top and a
 *  list of existing posts beneath, with delete + pin-order controls. */
export default async function RegionFeedAdminPage({
  params,
}: {
  params: Promise<{ regionId: string }>;
}) {
  const { regionId } = await params;
  const supabase = await createClient();

  const [regionRes, postsRes] = await Promise.all([
    supabase.from("regions").select("*").eq("id", regionId).single(),
    supabase
      .from("feed_posts")
      .select("*")
      .eq("region_id", regionId)
      .order("display_order", { ascending: true, nullsFirst: false })
      .order("created_at", { ascending: false }),
  ]);

  const region = regionRes.data as RegionRow | null;
  if (!region) notFound();

  const posts = (postsRes.data ?? []) as FeedPostRow[];

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            Feed · {region.display_name}
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {[region.city, region.province, region.country]
              .filter(Boolean)
              .join(", ")}
          </h1>
        </div>
        <Link
          href="/admin/feed"
          className="rounded-full bg-foreground/10 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-foreground/15"
        >
          ← All regions
        </Link>
      </header>

      <section className="mt-6">
        <FeedAdminClient regionId={regionId} posts={posts} />
      </section>
    </div>
  );
}

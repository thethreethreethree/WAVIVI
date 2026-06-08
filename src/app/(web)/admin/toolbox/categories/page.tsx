import { CategoriesAdmin } from "@/components/admin/toolbox/categories/categories-admin";
import { createClient } from "@/lib/supabase/server";
import type { UtilityCategoryRow } from "@/types/supabase";

export const dynamic = "force-dynamic";

/**
 * Utility categories admin (migration 0059).
 *
 * Source of truth for "which utility buckets exist" — the table backs
 * the FK on traveler_utilities.category. Mirrors the cities-admin shape
 * but for categories: add / edit / hide / delete, with utility counts
 * per category surfaced so admins can spot which categories are still
 * in use.
 */
export default async function UtilityCategoriesAdminPage() {
  const supabase = await createClient();

  const [{ data: catRows }, { data: utilRows }] = await Promise.all([
    supabase
      .from("utility_categories")
      .select("*")
      .order("active", { ascending: false })
      .order("sort_order", { ascending: true })
      .order("label", { ascending: true }),
    supabase.from("traveler_utilities").select("category"),
  ]);

  const categories = (catRows ?? []) as UtilityCategoryRow[];

  const utilityCountById: Record<string, number> = {};
  for (const row of utilRows ?? []) {
    const k = (row as { category: string | null }).category;
    if (!k) continue;
    utilityCountById[k] = (utilityCountById[k] ?? 0) + 1;
  }

  const totalUtilities = Object.values(utilityCountById).reduce(
    (a, b) => a + b,
    0,
  );

  return (
    <div className="mx-auto max-w-5xl px-5 py-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">
          Utility categories
        </h1>
        <p className="mt-1 text-sm text-muted">
          {categories.length} categor{categories.length === 1 ? "y" : "ies"} ·{" "}
          {categories.filter((c) => c.active).length} active ·{" "}
          {totalUtilities} utility row{totalUtilities === 1 ? "" : "s"} tagged
          across them. Add a new category here to register it in the DB so
          utilities can be assigned to it via CSV import or the per-utility
          editor.
        </p>
        <p className="mt-2 text-xs text-muted">
          To make a new category <strong className="text-foreground">scannable</strong> by the
          OSM Overpass engine, an engineer also has to mirror it into{" "}
          <code className="font-mono">src/lib/toolbox/categories.ts</code> with
          its OSM filters — the scan engine reads the static TS list at
          runtime. CSV / manual entry works for any category here without
          the code mirror.
        </p>
      </header>

      <section className="mt-8">
        <CategoriesAdmin
          categories={categories}
          utilityCountById={utilityCountById}
        />
      </section>
    </div>
  );
}

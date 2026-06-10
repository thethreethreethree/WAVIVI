import "server-only";

import {
  classifyActivityType,
  classifyCategory,
} from "@/lib/experiences/csv-import";
import { classifyCuisine } from "@/lib/restaurants/csv-import";
import { classifyStayFromText } from "@/lib/stays/classify";
import { createAdminClient } from "@/lib/supabase/admin";
import { classifyUtilityFromText } from "@/lib/toolbox/classify-utility";

/** Source table the suspect came from. The admin UI uses this to
 *  route the Apply action to the right server endpoint and to label
 *  the section heading. */
export type ClassificationSource =
  | "stays"
  | "restaurants"
  | "experiences"
  | "utilities";

export interface ClassificationSuspect {
  source: ClassificationSource;
  id: string;
  name: string;
  region_id: string | null;
  /** What's stored on the row today. */
  current: string;
  /** What the classifier thinks based on name + description. */
  proposed: string;
  /** "high" → keyword in the name is itself a stay-type/cuisine/activity
   *  noun. "medium" → softer signal (description-only, or a generic word
   *  like "lodge"). Sorted-by-confidence in the UI so admins burn down
   *  the obvious mis-labels first. */
  confidence: "high" | "medium";
  /** Human reason — surfaced on the row so admins don't have to guess
   *  why the classifier disagrees. */
  reason: string;
  /** For experiences we may also propose a category change. Surfaced
   *  in the row's secondary line so the apply step rewrites both. */
  proposedCategory?: string;
}

/** Compute the cross-table audit. Server-only — uses the admin
 *  client so RLS doesn't truncate the result mid-audit (the admin
 *  gate at the layout level already enforces who can read this).
 *
 *  Filtering rules:
 *  - `active=true` only (archived rows are out of scope).
 *  - `admin_edited` rows are NEVER surfaced. Hand-curated rows are
 *    the source of truth; auditing them would re-create work the
 *    admin already finished. Apply / Ignore both flip admin_edited
 *    on so a single decision is permanent. */
export async function loadClassificationSuspects(): Promise<
  ClassificationSuspect[]
> {
  const supabase = createAdminClient();
  const out: ClassificationSuspect[] = [];

  // Pagination — Supabase enforces db-max-rows (1,000 by default)
  // server-side, so a single big .range() is silently capped. See
  // cross-table-audit.ts for the full discovery story
  // (2026-06-10 debug probe).
  const PAGE_SIZE = 1000;
  const MAX_OFFSET = 100_000;

  // Generic paginator. Re-runs the same select with successive
  // .range() windows until a short page comes back (or we hit the
  // safety brake). Returns the concatenated rows. The fetch chain
  // is per-table because each table's select shape differs; can't
  // be hoisted further without losing type safety on the returned
  // rows.
  async function paginate<T>(
    runOne: (offset: number, end: number) => Promise<{ data: T[] | null; error: { message: string } | null }>,
  ): Promise<T[]> {
    const all: T[] = [];
    for (let offset = 0; offset <= MAX_OFFSET; offset += PAGE_SIZE) {
      const res = await runOne(offset, offset + PAGE_SIZE - 1);
      if (res.error) throw new Error(res.error.message);
      const page = res.data ?? [];
      all.push(...page);
      if (page.length < PAGE_SIZE) break;
    }
    return all;
  }

  type StayPick = {
    id: string;
    name: string;
    region_id: string | null;
    description: string | null;
    stay_type: string;
    admin_edited: boolean;
  };
  type RestPick = {
    id: string;
    name: string;
    region_id: string | null;
    description: string | null;
    cuisine: string | null;
    admin_edited: boolean;
  };
  type ExpPick = {
    id: string;
    name: string;
    region_id: string | null;
    description: string | null;
    activity_type: string;
    category: string | null;
    admin_edited: boolean;
  };
  type UtilPick = {
    id: string;
    name: string;
    region_id: string | null;
    description: string | null;
    category: string;
    admin_edited: boolean;
  };

  const [staysRows, restaurantsRows, experiencesRows, utilitiesRows] =
    await Promise.all([
      paginate<StayPick>(async (from, to) => {
        const res = await supabase
          .from("stays")
          .select("id, name, region_id, description, stay_type, admin_edited")
          .eq("active", true)
          .eq("admin_edited", false)
          .order("name", { ascending: true })
          .range(from, to)
          .returns<StayPick[]>();
        return { data: res.data, error: res.error };
      }),
      paginate<RestPick>(async (from, to) => {
        const res = await supabase
          .from("restaurants")
          .select("id, name, region_id, description, cuisine, admin_edited")
          .eq("active", true)
          .eq("admin_edited", false)
          .order("name", { ascending: true })
          .range(from, to)
          .returns<RestPick[]>();
        return { data: res.data, error: res.error };
      }),
      paginate<ExpPick>(async (from, to) => {
        const res = await supabase
          .from("experiences")
          .select(
            "id, name, region_id, description, activity_type, category, admin_edited",
          )
          .eq("active", true)
          .eq("admin_edited", false)
          .order("name", { ascending: true })
          .range(from, to)
          .returns<ExpPick[]>();
        return { data: res.data, error: res.error };
      }),
      // Utilities don't carry an `active` column — every row in
      // traveler_utilities is currently considered live. The
      // admin_edited filter still applies for idempotence.
      paginate<UtilPick>(async (from, to) => {
        const res = await supabase
          .from("traveler_utilities")
          .select(
            "id, name, region_id, description, category, admin_edited",
          )
          .eq("admin_edited", false)
          .order("name", { ascending: true })
          .range(from, to)
          .returns<UtilPick[]>();
        return { data: res.data, error: res.error };
      }),
    ]);

  // Wrap the paginated row arrays in the same .data shape the
  // original Promise.all destructure expected, so downstream loops
  // don't have to change.
  const staysRes = { data: staysRows };
  const restaurantsRes = { data: restaurantsRows };
  const experiencesRes = { data: experiencesRows };
  const utilitiesRes = { data: utilitiesRows };

  for (const s of staysRes.data ?? []) {
    const guess = classifyStayFromText(s.name, s.description);
    if (!guess) continue;
    if (guess.proposed === s.stay_type) continue;
    out.push({
      source: "stays",
      id: s.id,
      name: s.name,
      region_id: s.region_id,
      current: s.stay_type,
      proposed: guess.proposed,
      confidence: guess.confidence,
      reason: guess.reason,
    });
  }

  // For restaurants we feed the existing classifier `""` as the cell so
  // it falls straight to the name+description backstop — exactly the
  // path admins would hit if they re-imported a CSV with the cuisine
  // column blank. A disagreement against the stored value is the
  // suspect signal.
  for (const r of restaurantsRes.data ?? []) {
    const proposed = classifyCuisine("", r.name, r.description, "auto");
    if (!proposed || proposed === "other") continue;
    if (proposed === r.cuisine) continue;
    out.push({
      source: "restaurants",
      id: r.id,
      name: r.name,
      region_id: r.region_id,
      current: r.cuisine ?? "—",
      proposed,
      // Cuisine keywords are tighter than stay-type ones (whole-word
      // match on a small vocabulary) so a fire here is high-confidence
      // by definition. No medium tier.
      confidence: "high",
      reason: `name/description matches "${proposed}" keywords`,
    });
  }

  // Experiences carry two interlocking labels (activity_type drives the
  // sub-category, then a broad category for the filter chips). Both
  // can drift independently of the source data, so we re-derive both
  // and surface the suspect when either disagrees.
  for (const e of experiencesRes.data ?? []) {
    const proposedType = classifyActivityType(
      "",
      e.name,
      e.description,
      "auto",
    );
    const proposedCategory = classifyCategory(
      proposedType,
      e.name,
      e.description,
    );
    const typeDiffers = proposedType !== e.activity_type && proposedType !== "other";
    const catDiffers =
      proposedCategory !== e.category && proposedCategory !== "other";
    if (!typeDiffers && !catDiffers) continue;
    out.push({
      source: "experiences",
      id: e.id,
      name: e.name,
      region_id: e.region_id,
      current: typeDiffers ? e.activity_type : (e.category ?? "—"),
      proposed: typeDiffers ? proposedType : proposedCategory,
      confidence: "high",
      reason: typeDiffers
        ? `name/description matches "${proposedType}" keywords`
        : `category should be "${proposedCategory}" given the activity type`,
      proposedCategory: catDiffers ? proposedCategory : undefined,
    });
  }

  // Utilities — same shape as stays. Re-derive the category from the
  // name + description and surface rows whose stored category differs.
  // We skip rows where the classifier has no opinion (no keyword hits)
  // because the audit can't propose a better label in that case.
  for (const u of utilitiesRes.data ?? []) {
    const guess = classifyUtilityFromText(u.name, u.description);
    if (!guess) continue;
    if (guess.proposed === u.category) continue;
    out.push({
      source: "utilities",
      id: u.id,
      name: u.name,
      region_id: u.region_id,
      current: u.category,
      proposed: guess.proposed,
      confidence: guess.confidence,
      reason: guess.reason,
    });
  }

  // High-confidence rows first so the admin's first 10 clicks fix the
  // obvious ones. Within a confidence tier, sort by source then name
  // so the list is stable across reloads.
  out.sort((a, b) => {
    if (a.confidence !== b.confidence) {
      return a.confidence === "high" ? -1 : 1;
    }
    if (a.source !== b.source) return a.source.localeCompare(b.source);
    return a.name.localeCompare(b.name);
  });

  return out;
}

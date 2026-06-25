import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { createAdminClient } from "@/lib/supabase/admin";

import { type Language } from "./dictionary";

/**
 * Place-content translation overlay.
 *
 * Phase 3 of the i18n rollout. English names/descriptions live on the
 * source tables (stays / restaurants / experiences / traveler_utilities);
 * non-English locales overlay through `place_translations`. The loader
 * here is read-only — the translator script (scripts/translate-places.mjs)
 * is the only writer.
 *
 * Two-step flow on a server-rendered page:
 *
 *   const rows = await supabase.from("stays").select(...).…;
 *   const translated = await applyPlaceTranslations(
 *     rows, "stays", lang
 *   );
 *
 * `applyPlaceTranslations` is a no-op when lang === "en" so existing
 * English flows are untouched. For non-English locales:
 *   1. Pulls every translation row for (source_table, ids, lang)
 *      in one Supabase round-trip.
 *   2. Merges name + description onto each input row, falling back
 *      to the source English when a row hasn't been translated yet.
 */

export type TranslatableSource =
  | "stays"
  | "restaurants"
  | "experiences"
  | "traveler_utilities";

export interface PlaceTranslationRow {
  source_table: TranslatableSource;
  place_id: string;
  language: Language;
  name: string | null;
  description: string | null;
}

function loose(supabase: ReturnType<typeof createAdminClient>): SupabaseClient {
  return supabase as unknown as SupabaseClient;
}

/** Load cached translations for a batch of place ids. Returns a Map
 *  keyed by place_id → { name, description } so the caller can merge
 *  in one pass.
 *
 *  Pagination: `.in("place_id", ids)` accepts ~1000-ish ids per call
 *  (PostgREST URL length cap kicks in beyond that). We chunk at 500
 *  to stay well under, matching the established pattern across the
 *  audit modules.
 */
export async function loadTranslations(
  table: TranslatableSource,
  ids: string[],
  language: Language,
): Promise<Map<string, { name: string | null; description: string | null }>> {
  const out = new Map<
    string,
    { name: string | null; description: string | null }
  >();
  if (ids.length === 0 || language === "en") return out;
  const supabase = createAdminClient();
  const sb = loose(supabase);
  const CHUNK = 500;
  for (let i = 0; i < ids.length; i += CHUNK) {
    const slice = ids.slice(i, i + CHUNK);
    const { data, error } = await sb
      .from("place_translations")
      .select("place_id, name, description")
      .eq("source_table", table)
      .eq("language", language)
      .in("place_id", slice);
    if (error) {
      console.warn(`[i18n] loadTranslations ${table}: ${error.message}`);
      continue; // soft-fail: surface English rather than blank-out the page
    }
    for (const r of (data ?? []) as unknown as {
      place_id: string;
      name: string | null;
      description: string | null;
    }[]) {
      out.set(r.place_id, { name: r.name, description: r.description });
    }
  }
  return out;
}

/** Shape required to merge translations onto a row — every source
 *  table happens to expose at least these three fields, so we can
 *  type-check the helper without per-table generics. */
export interface TranslatableRow {
  id: string;
  name: string;
  description: string | null;
}

/** Merge cached translations into a row list. No-op when lang='en'
 *  (returns the input unchanged) so existing English flows are
 *  byte-identical to before Phase 3. When a row has no translation
 *  cached yet, it falls back to the source English — the page never
 *  renders blank cards while the translator script catches up. */
export async function applyPlaceTranslations<T extends TranslatableRow>(
  rows: T[],
  table: TranslatableSource,
  language: Language,
): Promise<T[]> {
  if (language === "en" || rows.length === 0) return rows;
  const translations = await loadTranslations(
    table,
    rows.map((r) => r.id),
    language,
  );
  if (translations.size === 0) return rows;
  return rows.map((r) => {
    const t = translations.get(r.id);
    if (!t) return r;
    return {
      ...r,
      name: t.name ?? r.name,
      description: t.description ?? r.description,
    };
  });
}

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";

// `susen_dev_notes` lives in the DB but isn't in the generated Database types,
// so reach it through an untyped client. (Regenerate types to make it typed.)
function devNotesClient(): SupabaseClient {
  return createAdminClient() as unknown as SupabaseClient;
}

/**
 * Susen tuning — lets the Wondavu team shape Susen's behaviour from chat.
 *
 * - An admin's turns are captured to `susen_dev_notes` (a development log).
 * - Instruction-like turns ("always…", "never…", "from now on…") are flagged.
 * - Active flagged instructions are injected into the system prompt as live
 *   "operator guidance", so they steer her replies immediately — for everyone,
 *   not just the admin.
 *
 * Reuses the existing `susen_dev_notes` table (already populated), so prior
 * instructions take effect the moment this ships.
 */

/** Identities whose chats tune Susen. Sourced from serverEnv.susenAdmins
 *  (CSV of emails/handles, parsed + lowercased once at module load). */
const ADMINS = new Set(serverEnv.susenAdmins);

export function isSusenAdmin(author?: string | null): boolean {
  if (!author) return false;
  return ADMINS.has(author.trim().toLowerCase());
}

// What counts as a LIVE tuning instruction (injected as operator guidance
// for EVERY traveller) is deliberately narrow. The admin is also the primary
// tester, so most admin turns are ordinary traveller queries ("cafe", "I want
// chicken", "is there a hostel?"). The old detector scanned for ~30 loose
// words (i want / only / should / prefer …) and mis-flagged that chatter as
// instructions — "I want chicken" got injected as guidance and Susen steered
// every vague query toward chicken for everyone. So an admin turn only
// becomes guidance when it is UNAMBIGUOUSLY a directive:
//
//   1. It carries an explicit tuning prefix the admin types on purpose
//      ("Susen, …", "rule: …", "tune: …", "directive: …"), OR
//   2. It OPENS with a behaviour directive ("always …", "never …", "from now
//      on …", "stop saying …", "don't ever …", "make sure you …").
//
// Anchoring the directive to the START is what keeps traveller phrasing out:
// "I want chicken", "is there always a crowd?", "find me a cafe" never open
// with a directive, so they're logged but never injected. Every turn is still
// captured to susen_dev_notes for the development log — only the
// is_instruction flag (which drives injection) is conservative.
const EXPLICIT_TUNING_PREFIX =
  /^\s*(susen\s*[,:]\s*|rule\s*:\s*|tune\s*:\s*|directive\s*:\s*|note to self\s*:\s*)/i;

const DIRECTIVE_OPENER =
  /^\s*(please\s+)?(always|never|from now on|going forward|no longer|stop (saying|doing|recommending|mentioning|suggesting|pushing)|do ?n'?t ever|do ?n'?t (say|mention|recommend|suggest|push)|make sure (you|to)|be sure to|as a rule|you (should|must) (always|never))\b/i;

export function looksLikeInstruction(text: string): boolean {
  const t = text.trim();
  if (!t) return false;
  return EXPLICIT_TUNING_PREFIX.test(t) || DIRECTIVE_OPENER.test(t);
}

/** Active admin instructions (newest first) to inject as live guidance.
 *  Legacy variant kept for any caller that doesn't have scope context;
 *  the respond route uses {@link loadGuidanceForScope} which filters by
 *  the resolved country / region / city + the user's query. */
export async function loadActiveGuidance(limit = 25): Promise<string[]> {
  try {
    const supabase = devNotesClient();
    const { data } = await supabase
      .from("susen_dev_notes")
      .select("message")
      .eq("is_instruction", true)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<{ message: string }[]>();
    return (data ?? []).map((r) => r.message).filter(Boolean);
  } catch (err) {
    console.warn("[susen] guidance load failed:", err);
    return [];
  }
}

/** Scope a guidance load is targeting. Any combination of fields can be
 *  null — the loader pulls general rules unconditionally and the rest
 *  by whichever scope columns resolved. */
export interface GuidanceScope {
  /** Country name as stored on regions.country (e.g. "Philippines"). */
  country: string | null;
  /** Region slug-id (e.g. "el_nido_palawan_philippines"). */
  regionId: string | null;
  /** cities.id UUID. */
  cityId: string | null;
  /** The user's incoming message — used to filter rules with explicit
   *  `triggers`. Blank-triggers rules ignore this. */
  query: string;
}

/** Guidance grouped by scope so the prompt can label each section with
 *  its authority level. Inside one scope, newer rules are listed first
 *  so a freshly authored rule wins on conflict. */
export interface ScopedGuidance {
  general: string[];
  country: string[];
  region: string[];
  city: string[];
}

/** True iff at least one rule fired across any scope — lets the caller
 *  skip the "OPERATIONAL RULES" prompt block entirely when nothing
 *  matched (e.g. a global query in a region with zero authored rules). */
export function hasAnyGuidance(g: ScopedGuidance): boolean {
  return (
    g.general.length > 0 ||
    g.country.length > 0 ||
    g.region.length > 0 ||
    g.city.length > 0
  );
}

/** Active admin instructions filtered by scope (general + country +
 *  region + city) and trigger keywords (a rule with non-empty `triggers`
 *  fires only when the query contains one as a substring; blank
 *  `triggers` always fire in scope). Returned grouped so callers can
 *  label each section in the system prompt; within each group, newest
 *  rules come first. */
export async function loadGuidanceForScope(
  scope: GuidanceScope,
  limit = 40,
): Promise<ScopedGuidance> {
  try {
    const supabase = devNotesClient();
    // Build the OR filter once. Each predicate is an AND within a single
    // group; the .or() string joins groups with OR.
    //   - scope_type=general (no other field has to match)
    //   - scope_type=country AND country=<value>
    //   - scope_type=region AND region_id=<value>
    //   - scope_type=city AND city_id=<value>
    // PostgREST OR syntax: or="(p1,p2),(p3,p4)" — each group is AND-ed.
    const orParts: string[] = ["scope_type.eq.general"];
    if (scope.country) {
      // Escape commas in the country name for PostgREST OR syntax.
      const safe = scope.country.replace(/,/g, "");
      orParts.push(
        `and(scope_type.eq.country,country.eq.${safe})`,
      );
    }
    if (scope.regionId) {
      orParts.push(
        `and(scope_type.eq.region,region_id.eq.${scope.regionId})`,
      );
    }
    if (scope.cityId) {
      orParts.push(
        `and(scope_type.eq.city,city_id.eq.${scope.cityId})`,
      );
    }
    const orFilter = orParts.join(",");

    const { data } = await supabase
      .from("susen_dev_notes")
      .select("message, scope_type, triggers, created_at")
      .eq("is_instruction", true)
      .eq("active", true)
      .or(orFilter)
      .limit(limit)
      .returns<
        {
          message: string;
          scope_type: ScopeType;
          triggers: string[] | null;
          created_at: string;
        }[]
      >();

    const rows = (data ?? []).filter((r) => r.message);
    // Trigger gate: a rule with non-empty `triggers` fires only when the
    // query contains one as a case-insensitive substring. Empty / null
    // triggers fire unconditionally.
    const q = scope.query.toLowerCase();
    const fired = rows.filter((r) => {
      const trigs = (r.triggers ?? [])
        .map((t) => (t ?? "").trim().toLowerCase())
        .filter(Boolean);
      if (trigs.length === 0) return true;
      return trigs.some((t) => q.includes(t));
    });

    // Newer first inside each bucket so a freshly authored rule wins
    // on conflict against an older same-scope rule.
    fired.sort((a, b) => b.created_at.localeCompare(a.created_at));

    const grouped: ScopedGuidance = {
      general: [],
      country: [],
      region: [],
      city: [],
    };
    for (const r of fired) {
      const list = grouped[r.scope_type];
      if (!list) continue;
      list.push(r.message);
    }
    return grouped;
  } catch (err) {
    console.warn("[susen] scoped guidance load failed:", err);
    return { general: [], country: [], region: [], city: [] };
  }
}

/** Scope levels — narrower than the previous string union so the
 *  validator at the form / DB boundary matches the migration's CHECK. */
export type ScopeType = "general" | "country" | "region" | "city";

/** DeepSeek's per-response token counts (the fields we persist). */
export interface SusenTurnUsage {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
  prompt_cache_hit_tokens?: number;
}

// Encode real token counts as namespaced tags on the dev-note row so we get
// per-message usage without a schema migration. The admin console parses
// these back (see tokensFromTags in SusenTuning):
//   tok:<total>  in:<prompt>  out:<completion>  cache:<prompt_cache_hit>
function usageToTags(usage?: SusenTurnUsage | null): string[] {
  if (!usage) return [];
  const tags: string[] = [];
  if (typeof usage.total_tokens === "number") tags.push(`tok:${usage.total_tokens}`);
  if (typeof usage.prompt_tokens === "number") tags.push(`in:${usage.prompt_tokens}`);
  if (typeof usage.completion_tokens === "number")
    tags.push(`out:${usage.completion_tokens}`);
  if (typeof usage.prompt_cache_hit_tokens === "number")
    tags.push(`cache:${usage.prompt_cache_hit_tokens}`);
  return tags;
}

/** Persist one admin turn so instructions are captured for development.
 *  Stores DeepSeek's real token usage in `tags` for the admin log. */
export async function captureAdminTurn(args: {
  author: string;
  source?: string | null;
  regionId?: string | null;
  message: string;
  reply: string;
  usage?: SusenTurnUsage | null;
}): Promise<void> {
  try {
    const supabase = devNotesClient();
    await supabase.from("susen_dev_notes").insert({
      author: args.author,
      source: args.source ?? "app",
      region_id: args.regionId ?? null,
      message: args.message,
      susen_reply: args.reply,
      is_instruction: looksLikeInstruction(args.message),
      tags: usageToTags(args.usage),
    });
  } catch (err) {
    console.warn("[susen] capture failed:", err);
  }
}

// ---------------------------------------------------------------------------
// Admin console (/admin/susen) — review, retire, promote, and hand-write the
// live tuning rules. A "live rule" is a row with is_instruction && active —
// exactly what loadActiveGuidance() injects. Retiring one (active=false) stops
// the injection on her very next reply, no deploy. These helpers gate nothing
// themselves; the calling API route enforces requireAdmin().
// ---------------------------------------------------------------------------

/** One row of the development log / tuning store. */
export interface SusenDevNote {
  id: string;
  created_at: string;
  author: string | null;
  source: string | null;
  channel: string | null;
  region_id: string | null;
  message: string;
  susen_reply: string | null;
  is_instruction: boolean;
  active: boolean;
  applied: boolean;
  tags: string[] | null;
  /** Scope columns — added by migration 0066. Old rows default to
   *  'general' with the other three null, so injection behaviour
   *  matches what was happening pre-migration. */
  scope_type: ScopeType;
  country: string | null;
  city_id: string | null;
  triggers: string[] | null;
}

const NOTE_COLS =
  "id, created_at, author, source, channel, region_id, message, susen_reply, is_instruction, active, applied, tags, scope_type, country, city_id, triggers";

/** The rules currently steering her replies (is_instruction && active),
 *  newest first. Fetched without a row cap so an older-but-active rule can't
 *  be hidden below a recent-notes window. */
export async function listLiveRules(): Promise<SusenDevNote[]> {
  try {
    const supabase = devNotesClient();
    const { data } = await supabase
      .from("susen_dev_notes")
      .select(NOTE_COLS)
      .eq("is_instruction", true)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .returns<SusenDevNote[]>();
    return data ?? [];
  } catch (err) {
    console.warn("[susen] listLiveRules failed:", err);
    return [];
  }
}

/** Recent development-log entries (every captured turn), newest first. */
export async function listDevNotes(limit = 60): Promise<SusenDevNote[]> {
  try {
    const supabase = devNotesClient();
    const { data } = await supabase
      .from("susen_dev_notes")
      .select(NOTE_COLS)
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<SusenDevNote[]>();
    return data ?? [];
  } catch (err) {
    console.warn("[susen] listDevNotes failed:", err);
    return [];
  }
}

/** Toggle the steering flags on one note. `active` drives injection;
 *  `applied` is a bookkeeping flag for "baked into the persona". */
export async function setNoteFlags(
  id: string,
  flags: { active?: boolean; is_instruction?: boolean; applied?: boolean },
): Promise<{ error: string | null }> {
  const updates: Record<string, boolean> = {};
  if (typeof flags.active === "boolean") updates.active = flags.active;
  if (typeof flags.is_instruction === "boolean")
    updates.is_instruction = flags.is_instruction;
  if (typeof flags.applied === "boolean") updates.applied = flags.applied;
  if (Object.keys(updates).length === 0) return { error: "Nothing to update." };
  try {
    const supabase = devNotesClient();
    const { error } = await supabase
      .from("susen_dev_notes")
      .update(updates)
      .eq("id", id);
    return { error: error?.message ?? null };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

/** Remove one dev note entirely. */
export async function deleteDevNote(id: string): Promise<{ error: string | null }> {
  try {
    const supabase = devNotesClient();
    const { error } = await supabase
      .from("susen_dev_notes")
      .delete()
      .eq("id", id);
    return { error: error?.message ?? null };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

/** Args for {@link addRule}. Scope columns are validated at the form
 *  layer: country requires `country`, region requires `regionId`, city
 *  requires both `cityId` and (for the engine's scope-resolution
 *  fallback) the parent `regionId`. General requires nothing. */
export interface AddRuleArgs {
  author: string;
  message: string;
  scope: ScopeType;
  country?: string | null;
  regionId?: string | null;
  cityId?: string | null;
  /** Optional trigger keywords — blank = always fire in scope. */
  triggers?: string[] | null;
}

/** Hand-write a new live rule from the admin console (skips the chat
 *  detector — an explicit admin action is always treated as a directive).
 *  Scope columns are persisted so {@link loadGuidanceForScope} can pick
 *  only the rules matching the user's resolved location at reply time. */
export async function addRule(
  args: AddRuleArgs,
): Promise<{ note: SusenDevNote | null; error: string | null }> {
  const { scope } = args;
  // Cheap validation — defence in depth against a form bug shipping a
  // half-filled rule. The DB CHECK constraint catches scope_type
  // typos; this catches "city scope with no city_id" before the round
  // trip.
  if (scope === "country" && !args.country) {
    return { note: null, error: "Country scope requires a country name." };
  }
  if (scope === "region" && !args.regionId) {
    return { note: null, error: "Region scope requires a region." };
  }
  if (scope === "city" && (!args.cityId || !args.regionId)) {
    return {
      note: null,
      error: "City scope requires a city (and its parent region).",
    };
  }

  const cleanTriggers = (args.triggers ?? [])
    .map((t) => (t ?? "").trim().toLowerCase())
    .filter((t) => t.length > 0);

  try {
    const supabase = devNotesClient();
    const { data, error } = await supabase
      .from("susen_dev_notes")
      .insert({
        author: args.author,
        source: "admin",
        channel: "admin",
        message: args.message,
        is_instruction: true,
        active: true,
        scope_type: scope,
        country: scope === "country" || scope === "region" || scope === "city"
          ? args.country ?? null
          : null,
        region_id:
          scope === "region" || scope === "city" ? args.regionId ?? null : null,
        city_id: scope === "city" ? args.cityId ?? null : null,
        triggers: cleanTriggers.length > 0 ? cleanTriggers : null,
      })
      .select(NOTE_COLS)
      .single()
      .returns<SusenDevNote>();
    return { note: data ?? null, error: error?.message ?? null };
  } catch (err) {
    return { note: null, error: (err as Error).message };
  }
}

// ---------------------------------------------------------------------------
// Review markers — let an admin tag a turn from chat while testing Susen:
//   • "flag" (alone)        → mark the previous turn for later review (🚩)
//   • "fire response susen" → mark the previous response as great quality (🔥)
// Stored as plain tags ("flag" / "fire") alongside the token tags, so no
// schema change. The /admin/susen filter buttons read them back. Only an
// admin triggers these (the respond route gates on isSusenAdmin), and they
// short-circuit before DeepSeek — travellers and normal admin chat are
// untouched.
// ---------------------------------------------------------------------------
export type ReviewMarker = "flag" | "fire";

/** Detect a deliberate review command. Tight on purpose so ordinary content
 *  like "Flag Frendz hostel has a pool" or "fire up the grill" never trips it
 *  — only the bare command phrases do. */
export function detectReviewCommand(text: string): ReviewMarker | null {
  const t = text.trim().toLowerCase().replace(/[.!?]+$/, "");
  if (/^fire(\s+this)?\s+response(\s+susen)?$/.test(t)) return "fire";
  if (/^flag(\s+(this|that|it|this one|that one|response|reply|message|msg))?$/.test(t))
    return "flag";
  return null;
}

/** Add a review marker to the admin's most recent prior captured turn — the
 *  message/response they're reacting to. Returns false when there's no turn
 *  to mark yet (e.g. the command was the first thing said). */
export async function markPreviousTurn(
  author: string,
  marker: ReviewMarker,
): Promise<boolean> {
  try {
    const supabase = devNotesClient();
    const { data } = await supabase
      .from("susen_dev_notes")
      .select("id, tags")
      .eq("author", author)
      .order("created_at", { ascending: false })
      .limit(1)
      .returns<{ id: string; tags: string[] | null }[]>();
    const row = data?.[0];
    if (!row) return false;
    const tags = Array.from(new Set([...(row.tags ?? []), marker]));
    await supabase.from("susen_dev_notes").update({ tags }).eq("id", row.id);
    return true;
  } catch (err) {
    console.warn("[susen] markPreviousTurn failed:", err);
    return false;
  }
}

/** Notes carrying a given review marker (🚩 flagged / 🔥 fire), newest first. */
export async function listNotesByMarker(
  marker: ReviewMarker,
  limit = 100,
): Promise<SusenDevNote[]> {
  try {
    const supabase = devNotesClient();
    const { data } = await supabase
      .from("susen_dev_notes")
      .select(NOTE_COLS)
      .contains("tags", [marker])
      .order("created_at", { ascending: false })
      .limit(limit)
      .returns<SusenDevNote[]>();
    return data ?? [];
  } catch (err) {
    console.warn("[susen] listNotesByMarker failed:", err);
    return [];
  }
}

/** Clear a review marker from one note (e.g. after the admin has reviewed it),
 *  preserving any other tags (including the token counts). */
export async function clearNoteMarker(
  id: string,
  marker: ReviewMarker,
): Promise<{ error: string | null }> {
  try {
    const supabase = devNotesClient();
    const { data } = await supabase
      .from("susen_dev_notes")
      .select("tags")
      .eq("id", id)
      .maybeSingle<{ tags: string[] | null }>();
    const tags = (data?.tags ?? []).filter((t) => t !== marker);
    const { error } = await supabase
      .from("susen_dev_notes")
      .update({ tags })
      .eq("id", id);
    return { error: error?.message ?? null };
  } catch (err) {
    return { error: (err as Error).message };
  }
}

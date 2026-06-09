import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";
import { normaliseForMatch } from "@/lib/utils/text-match";
import {
  AUTO_INVITE_THRESHOLD,
  type MatchScore,
  type PlanForMatching,
  bucketScores,
  scorePair,
} from "@/lib/where-to-next/matching";
import type {
  ChatGroupInsert,
  ChatInviteLogInsert,
  TravelPlanRow,
} from "@/types/supabase";

/**
 * Spec implementation for "When a plan is saved (and openToMeetOthers =
 * true)": find candidates, score them, route ≥0.65 scorers into a single
 * shared chat (existing one if it fits, otherwise auto-create), and
 * record every auto-invite in chat_invite_log so the user can see why.
 *
 * Runs with the service role because the matcher needs to read other
 * users' plans — RLS on travel_plans is owner-only by design.
 */

export interface MatchSummary {
  /** Candidates that scored ≥0.65 — auto-invited. */
  autoInvite: { plan: TravelPlanRow; score: MatchScore }[];
  /** Candidates that scored 0.45–0.65 — surfaced as soft suggestions. */
  suggested: { plan: TravelPlanRow; score: MatchScore }[];
  /** The chat the source traveler was routed into, if any. */
  chat: { id: string; name: string; isNew: boolean } | null;
}

/**
 * Score candidates for a plan without any side effects (no chat
 * creation, no membership writes). Used by the plan-detail page to
 * render the "suggested matches" panel on every load — runMatching()
 * is reserved for save / explicit rematch flows.
 */
export async function scoreCandidatesForPlan(
  plan: TravelPlanRow,
): Promise<{
  autoInvite: { plan: TravelPlanRow; score: MatchScore }[];
  suggested: { plan: TravelPlanRow; score: MatchScore }[];
}> {
  if (!plan.open_to_meet_others || plan.destination_countries.length === 0) {
    return { autoInvite: [], suggested: [] };
  }
  const supabase = createAdminClient();
  const { data: candidates } = await supabase
    .from("travel_plans")
    .select("*")
    .overlaps("destination_countries", plan.destination_countries)
    .lte("start_date", plan.end_date)
    .gte("end_date", plan.start_date)
    .eq("open_to_meet_others", true)
    .neq("user_id", plan.user_id)
    .limit(200);

  const pool = (candidates ?? []) as TravelPlanRow[];
  const source: PlanForMatching = {
    user_id: plan.user_id,
    destination_countries: plan.destination_countries,
    start_date: plan.start_date,
    end_date: plan.end_date,
    activities: plan.activities,
    vibe_tags: plan.vibe_tags,
    budget: plan.budget,
  };
  const scored = pool.map((c) => ({
    candidate: c,
    score: scorePair(source, {
      user_id: c.user_id,
      destination_countries: c.destination_countries,
      start_date: c.start_date,
      end_date: c.end_date,
      activities: c.activities,
      vibe_tags: c.vibe_tags,
      budget: c.budget,
    }),
  }));
  const { autoInvite, suggested } = bucketScores(scored);
  return {
    autoInvite: autoInvite.map(({ candidate, score }) => ({
      plan: candidate,
      score,
    })),
    suggested: suggested.map(({ candidate, score }) => ({
      plan: candidate,
      score,
    })),
  };
}

const CHAT_ID_PREFIX = "wtn-";

function generateChatId(): string {
  // Stay under the 64-char text PK cap from migration 0008.
  return `${CHAT_ID_PREFIX}${crypto.randomUUID().slice(0, 32)}`;
}

function topVibe(plan: TravelPlanRow): string {
  return plan.vibe_tags[0] ?? "Travelers";
}

function fmtCountry(plan: TravelPlanRow): string {
  return plan.destinations[0]?.country ?? plan.destination_countries[0] ?? "Trip";
}

/**
 * Look for an open auto-generated chat for the same country whose window
 * overlaps the plan and that shares at least one theme tag. Returns the
 * chat row or null.
 */
async function findExistingChat(
  plan: TravelPlanRow,
): Promise<{ id: string; name: string } | null> {
  const supabase = createAdminClient();
  const country = fmtCountry(plan);
  const themes = plan.vibe_tags.length > 0 ? plan.vibe_tags : null;

  // ilike (no wildcards) is case-insensitive equality — "philippines"
  // ilike "Philippines" matches, "PH" still won't (we'd need to
  // normalise both sides for that, but country abbreviations aren't
  // a real risk here because fmtCountry already returns the long form).
  let query = supabase
    .from("chat_groups")
    .select("id, name, window_start, window_end, theme_tags, destination_country")
    .ilike("destination_country", country)
    .eq("is_auto_generated", true);
  if (themes && themes.length > 0) {
    query = query.overlaps("theme_tags", themes);
  }
  const { data } = await query.limit(20);
  if (!data || data.length === 0) return null;
  // Belt-and-suspenders: also accept rows whose country normalises to
  // the same form as the plan's country. Catches an admin who typed
  // ".Philippines" or "philippines " on an old auto-generated row.
  const wantCountry = normaliseForMatch(country);
  const eligible = data.filter(
    (c) => normaliseForMatch(c.destination_country) === wantCountry,
  );
  if (eligible.length === 0) return null;

  // Filter for window overlap in JS (cheaper than a daterange GIST setup).
  const fit = eligible.find((c) => {
    if (!c.window_start || !c.window_end) return false;
    return c.window_start <= plan.end_date && c.window_end >= plan.start_date;
  });
  return fit ? { id: fit.id, name: fit.name } : null;
}

/**
 * Create a brand-new auto-generated chat for this plan. Caller is
 * responsible for adding members + invite-log rows.
 */
async function createChatForPlan(
  plan: TravelPlanRow,
): Promise<{ id: string; name: string }> {
  const supabase = createAdminClient();
  const country = fmtCountry(plan);
  const vibe = topVibe(plan);
  const id = generateChatId();
  const name = `${country} • ${vibe} crew`.slice(0, 80);

  const insert: ChatGroupInsert = {
    id,
    name,
    description: `Auto-created for travelers heading to ${country}.`,
    category: "travel-plan",
    created_by: plan.user_id,
    destination_country: country,
    destination_city: plan.destinations[0]?.city ?? null,
    window_start: plan.start_date,
    window_end: plan.end_date,
    theme_tags: plan.vibe_tags,
    is_auto_generated: true,
  };

  const { error } = await supabase.from("chat_groups").insert(insert);
  if (error) throw error;
  return { id, name };
}

/**
 * Ensure a user is a member of the chat and log the invite. Idempotent —
 * if the membership row already exists, the upsert no-ops and we still
 * write the invite-log row (so re-runs of `rematch` keep a history).
 */
async function inviteMember(opts: {
  chatId: string;
  inviteeId: string;
  sourcePlanId: string | null;
  score: number | null;
  reason: string | null;
}) {
  const supabase = createAdminClient();

  const { error: memberError } = await supabase
    .from("chat_group_members")
    .upsert(
      { group_id: opts.chatId, user_id: opts.inviteeId },
      { onConflict: "group_id,user_id" },
    );
  if (memberError) throw memberError;

  const logRow: ChatInviteLogInsert = {
    group_id: opts.chatId,
    invitee_id: opts.inviteeId,
    source_plan_id: opts.sourcePlanId,
    match_score: opts.score,
    reason: opts.reason,
  };
  await supabase.from("chat_invite_log").insert(logRow);
}

/** Append a chat id to a plan's saved_chats array if not already present. */
async function pinChatToPlan(planId: string, chatId: string) {
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("travel_plans")
    .select("saved_chats")
    .eq("id", planId)
    .maybeSingle();
  if (!data) return;
  const current = data.saved_chats ?? [];
  if (current.includes(chatId)) return;
  await supabase
    .from("travel_plans")
    .update({ saved_chats: [...current, chatId] })
    .eq("id", planId);
}

/**
 * Run matching for a freshly-saved (or just-edited) plan.
 *
 * Returns the bucketed results so the caller can render a "Here's who's
 * around and the chat you've been added to" panel.
 */
export async function runMatching(
  plan: TravelPlanRow,
): Promise<MatchSummary> {
  if (!plan.open_to_meet_others) {
    return { autoInvite: [], suggested: [], chat: null };
  }
  if (plan.destination_countries.length === 0) {
    return { autoInvite: [], suggested: [], chat: null };
  }

  const supabase = createAdminClient();

  // Cross-user query — needs the service role since travel_plans RLS is
  // owner-only. We pre-filter by country overlap + window overlap +
  // open_to_meet_others to keep the candidate pool small.
  const { data: candidates } = await supabase
    .from("travel_plans")
    .select("*")
    .overlaps("destination_countries", plan.destination_countries)
    .lte("start_date", plan.end_date)
    .gte("end_date", plan.start_date)
    .eq("open_to_meet_others", true)
    .neq("user_id", plan.user_id)
    .limit(200);

  const pool = (candidates ?? []) as TravelPlanRow[];

  const source: PlanForMatching = {
    user_id: plan.user_id,
    destination_countries: plan.destination_countries,
    start_date: plan.start_date,
    end_date: plan.end_date,
    activities: plan.activities,
    vibe_tags: plan.vibe_tags,
    budget: plan.budget,
  };

  const scored = pool.map((c) => ({
    candidate: c,
    score: scorePair(source, {
      user_id: c.user_id,
      destination_countries: c.destination_countries,
      start_date: c.start_date,
      end_date: c.end_date,
      activities: c.activities,
      vibe_tags: c.vibe_tags,
      budget: c.budget,
    }),
  }));

  const { autoInvite, suggested } = bucketScores(scored);

  let chat: { id: string; name: string; isNew: boolean } | null = null;

  if (autoInvite.length > 0) {
    // Find-or-create one shared chat for this trip.
    const existing = await findExistingChat(plan);
    if (existing) {
      chat = { ...existing, isNew: false };
    } else {
      const created = await createChatForPlan(plan);
      chat = { ...created, isNew: true };
    }

    // Add the source traveler.
    await inviteMember({
      chatId: chat.id,
      inviteeId: plan.user_id,
      sourcePlanId: plan.id,
      score: null,
      reason: chat.isNew ? "Created for your trip" : "Added to a matching trip chat",
    });
    await pinChatToPlan(plan.id, chat.id);

    // Add every ≥0.65 scorer + pin the chat onto their plan too.
    for (const { candidate, score } of autoInvite) {
      await inviteMember({
        chatId: chat.id,
        inviteeId: candidate.user_id,
        sourcePlanId: plan.id,
        score: score.total,
        reason: `Trip overlaps with ${plan.user_id.slice(0, 8)} (${(
          score.total * 100
        ).toFixed(0)}% match)`,
      });
      await pinChatToPlan(candidate.id, chat.id);
    }
  }

  return {
    autoInvite: autoInvite.map(({ candidate, score }) => ({
      plan: candidate,
      score,
    })),
    suggested: suggested.map(({ candidate, score }) => ({
      plan: candidate,
      score,
    })),
    chat,
  };
}

export { AUTO_INVITE_THRESHOLD };

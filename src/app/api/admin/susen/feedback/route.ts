import { type NextRequest, NextResponse } from "next/server";

import {
  promoteFeedbackToRule,
  rejectFeedback,
} from "@/lib/susen/feedback";
import { type ScopeType } from "@/lib/susen/tuning";
import { requireAdmin } from "@/lib/toolbox/admin";

/**
 * POST /api/admin/susen/feedback — admin action on one feedback row.
 *
 * Body shape:
 *   {
 *     action: 'promote' | 'reject',
 *     feedbackId: string,
 *     // when action='promote':
 *     scope: 'general'|'country'|'region'|'city',
 *     message: string,            // the (possibly edited) rule body
 *     country?: string,
 *     regionId?: string,
 *     cityId?: string,
 *     topic?: string,
 *     priority?: number,
 *     triggers?: string[],
 *   }
 *
 * Two actions on one route because both are simple state transitions
 * on the same target row; keeping them together avoids a second route
 * file for one verb each.
 */
export const runtime = "nodejs";

const VALID_SCOPES = new Set<ScopeType>([
  "general",
  "country",
  "region",
  "city",
]);

export async function POST(req: NextRequest) {
  const { user, isAdmin } = await requireAdmin();
  if (!isAdmin || !user) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    action?: unknown;
    feedbackId?: unknown;
    scope?: unknown;
    message?: unknown;
    country?: unknown;
    regionId?: unknown;
    cityId?: unknown;
    topic?: unknown;
    priority?: unknown;
    triggers?: unknown;
  } | null;

  const action = typeof body?.action === "string" ? body.action : "";
  const feedbackId =
    typeof body?.feedbackId === "string" ? body.feedbackId.trim() : "";
  if (!feedbackId) {
    return NextResponse.json(
      { error: "feedbackId is required." },
      { status: 400 },
    );
  }

  if (action === "reject") {
    const { error } = await rejectFeedback({
      feedbackId,
      reviewerId: user.id,
    });
    if (error) return NextResponse.json({ error }, { status: 400 });
    return NextResponse.json({ ok: true });
  }

  if (action === "promote") {
    const scope =
      typeof body?.scope === "string" && VALID_SCOPES.has(body.scope as ScopeType)
        ? (body.scope as ScopeType)
        : null;
    if (!scope) {
      return NextResponse.json(
        { error: `scope must be one of: ${Array.from(VALID_SCOPES).join(", ")}` },
        { status: 400 },
      );
    }
    const message =
      typeof body?.message === "string" ? body.message.trim() : "";
    if (!message) {
      return NextResponse.json(
        { error: "message is required." },
        { status: 400 },
      );
    }
    if (message.length > 2000) {
      return NextResponse.json(
        { error: "Keep a rule under 2000 characters." },
        { status: 400 },
      );
    }
    const country =
      typeof body?.country === "string" ? body.country.trim() : null;
    const regionId =
      typeof body?.regionId === "string" ? body.regionId.trim() : null;
    const cityId =
      typeof body?.cityId === "string" ? body.cityId.trim() : null;
    const topic = typeof body?.topic === "string" ? body.topic.trim() : null;
    const priority =
      typeof body?.priority === "number" && Number.isFinite(body.priority)
        ? Math.round(body.priority)
        : 0;
    const triggers = Array.isArray(body?.triggers)
      ? body.triggers
          .filter((t): t is string => typeof t === "string")
          .map((t) => t.trim())
          .filter(Boolean)
      : null;

    const { noteId, error } = await promoteFeedbackToRule({
      feedbackId,
      reviewerId: user.id,
      reviewerEmail: user.email ?? "admin",
      scope,
      country: country || null,
      regionId: regionId || null,
      cityId: cityId || null,
      topic,
      priority,
      triggers,
      message,
    });
    if (error || !noteId) {
      return NextResponse.json(
        { error: error ?? "Promotion failed." },
        { status: 400 },
      );
    }
    return NextResponse.json({ noteId });
  }

  return NextResponse.json(
    { error: `Unknown action: ${action}` },
    { status: 400 },
  );
}

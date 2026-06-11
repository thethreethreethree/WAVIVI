import { type NextRequest, NextResponse } from "next/server";

import { addRule, type ScopeType } from "@/lib/susen/tuning";
import { requireAdmin } from "@/lib/toolbox/admin";

/**
 * POST /api/admin/susen/notes — hand-write a new live tuning rule from the
 * /admin/susen console. Inserts an is_instruction && active row so it starts
 * steering Susen's replies on her next message. Admin-only.
 *
 * Body shape (all optional except message + scope):
 *   {
 *     message: string,            // the rule body (≤2000 chars)
 *     scope: 'general'|'country'|'region'|'city',
 *     country?: string,           // required when scope='country'
 *     regionId?: string,          // required when scope='region'|'city'
 *     cityId?: string,            // required when scope='city'
 *     triggers?: string[],        // optional keyword gate; blank = always
 *   }
 */

export const runtime = "nodejs";

const VALID_SCOPES = new Set<ScopeType>(["general", "country", "region", "city"]);

export async function POST(req: NextRequest) {
  const { user, isAdmin } = await requireAdmin();
  if (!isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    message?: unknown;
    scope?: unknown;
    country?: unknown;
    regionId?: unknown;
    cityId?: unknown;
    triggers?: unknown;
  } | null;

  const message =
    typeof body?.message === "string" ? body.message.trim() : "";
  if (!message) {
    return NextResponse.json({ error: "message is required." }, { status: 400 });
  }
  // Rule bodies can be long (the El Nido nightlife example runs ~600
  // chars); 2000 still keeps any single prompt injection well below
  // DeepSeek's stable-prefix budget while letting the admin write a
  // proper paragraph.
  if (message.length > 2000) {
    return NextResponse.json(
      { error: "Keep a rule under 2000 characters." },
      { status: 400 },
    );
  }

  const scopeRaw = typeof body?.scope === "string" ? body.scope : "general";
  if (!VALID_SCOPES.has(scopeRaw as ScopeType)) {
    return NextResponse.json(
      { error: `scope must be one of: ${Array.from(VALID_SCOPES).join(", ")}` },
      { status: 400 },
    );
  }
  const scope = scopeRaw as ScopeType;

  const country =
    typeof body?.country === "string" ? body.country.trim() : null;
  const regionId =
    typeof body?.regionId === "string" ? body.regionId.trim() : null;
  const cityId =
    typeof body?.cityId === "string" ? body.cityId.trim() : null;
  const triggers = Array.isArray(body?.triggers)
    ? body.triggers
        .filter((t): t is string => typeof t === "string")
        .map((t) => t.trim())
        .filter(Boolean)
    : null;

  const { note, error } = await addRule({
    author: user?.email ?? "admin",
    message,
    scope,
    country: country || null,
    regionId: regionId || null,
    cityId: cityId || null,
    triggers,
  });
  if (error) {
    return NextResponse.json({ error }, { status: 400 });
  }
  return NextResponse.json({ note });
}

import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";
import type { ReportType } from "@/types/supabase";

/**
 * POST /api/reports
 * body: { utility_id: string, report_type: ReportType, note?: string }
 *
 * Files a traveler report against a utility (offline ATM, bad wifi, etc.).
 */

const REPORT_TYPES: ReportType[] = [
  "offline",
  "bad_service",
  "temp_closure",
  "moved",
  "incorrect_info",
  "other",
];

export async function POST(req: NextRequest) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: "Sign in to report an issue." },
      { status: 401 },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    utility_id?: string;
    report_type?: string;
    note?: string;
  } | null;

  if (!body?.utility_id) {
    return NextResponse.json(
      { error: "utility_id is required." },
      { status: 400 },
    );
  }
  if (!body.report_type || !REPORT_TYPES.includes(body.report_type as ReportType)) {
    return NextResponse.json(
      { error: `report_type must be one of: ${REPORT_TYPES.join(", ")}` },
      { status: 400 },
    );
  }
  const note = (body.note ?? "").trim().slice(0, 500) || null;

  const { error } = await supabase.from("traveler_reports").insert({
    utility_id: body.utility_id,
    reporter_id: user.id,
    report_type: body.report_type as ReportType,
    note,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

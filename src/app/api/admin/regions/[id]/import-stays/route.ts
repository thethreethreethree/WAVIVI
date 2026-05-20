import { type NextRequest, NextResponse } from "next/server";

import { parseStaysCsv } from "@/lib/stays/csv-import";
import { importStaysCsv } from "@/lib/stays/csv-import-engine";
import { requireAdmin } from "@/lib/toolbox/admin";
import type { StayType } from "@/types/supabase";

/**
 * POST /api/admin/regions/[id]/import-stays  — import a stays CSV (admin).
 *   body: { stayType: StayType, csv: string }
 *
 * Rows match existing stays in the same region by location (60 m). Matches
 * refresh rating / reviews / contacts / photo; new rows are inserted.
 */

export const maxDuration = 120;

const STAY_TYPES: StayType[] = [
  "hostel",
  "hotel",
  "guesthouse",
  "resort",
  "apartment",
  "bnb",
  "camping",
  "other",
];

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  const { id } = await params;
  const { user, isAdmin } = await requireAdmin();
  if (!user) {
    return NextResponse.json(
      { error: "Not signed in — log in with your admin account first." },
      { status: 401 },
    );
  }
  if (!isAdmin) {
    return NextResponse.json(
      { error: "This account is not an admin." },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    stayType?: string;
    csv?: string;
  } | null;

  const stayType = body?.stayType as StayType | undefined;
  if (!stayType || !STAY_TYPES.includes(stayType)) {
    return NextResponse.json(
      { error: "A valid stay type is required." },
      { status: 400 },
    );
  }
  if (!body?.csv || body.csv.trim().length === 0) {
    return NextResponse.json(
      { error: "The CSV file is empty." },
      { status: 400 },
    );
  }

  const { rows, errors } = parseStaysCsv(body.csv);
  if (rows.length === 0) {
    return NextResponse.json(
      { error: errors[0] ?? "No valid rows found in the CSV." },
      { status: 400 },
    );
  }

  const result = await importStaysCsv(id, stayType, rows);

  return NextResponse.json({
    ...result,
    parsed: rows.length,
    rowErrors: errors,
  });
}

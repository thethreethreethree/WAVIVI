import { type NextRequest, NextResponse } from "next/server";

import { parseExperiencesCsv } from "@/lib/experiences/csv-import";
import { importExperiencesCsv } from "@/lib/experiences/csv-import-engine";
import { requireAdmin } from "@/lib/toolbox/admin";

/**
 * POST /api/admin/regions/[id]/import-experiences  — import an
 * experiences CSV (admin only).
 *   body: { activityType: string, csv: string }
 *
 * Rows match existing experiences in the same region by location (60 m).
 * Matches refresh rating / reviews / contacts / photo / amenities; new
 * rows are inserted.
 */

export const maxDuration = 120;

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
    activityType?: string;
    csv?: string;
  } | null;

  const activityType = body?.activityType?.trim() || "other";
  if (!body?.csv || body.csv.trim().length === 0) {
    return NextResponse.json(
      { error: "The CSV file is empty." },
      { status: 400 },
    );
  }

  const { rows, errors } = parseExperiencesCsv(body.csv);
  if (rows.length === 0) {
    return NextResponse.json(
      { error: errors[0] ?? "No valid rows found in the CSV." },
      { status: 400 },
    );
  }

  const result = await importExperiencesCsv(id, activityType, rows);

  return NextResponse.json({
    ...result,
    parsed: rows.length,
    rowErrors: errors,
  });
}

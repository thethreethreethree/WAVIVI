import { type NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/toolbox/admin";
import { isCategoryId } from "@/lib/toolbox/categories";
import { parseToolboxCsv } from "@/lib/toolbox/csv-import";
import { importCsvRows } from "@/lib/toolbox/csv-import-engine";

/**
 * POST /api/admin/regions/[id]/import   — import a category CSV (admin).
 *   body: { category: CategoryId, csv: string }
 *
 * Matches CSV rows to existing pins by location: a match updates rating,
 * reviews and location; no match inserts a new pin.
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
    category?: string;
    csv?: string;
  } | null;

  if (!body?.category || !isCategoryId(body.category)) {
    return NextResponse.json(
      { error: "A valid category is required." },
      { status: 400 },
    );
  }
  if (!body.csv || body.csv.trim().length === 0) {
    return NextResponse.json(
      { error: "The CSV file is empty." },
      { status: 400 },
    );
  }

  const { rows, errors } = parseToolboxCsv(body.csv);
  if (rows.length === 0) {
    return NextResponse.json(
      { error: errors[0] ?? "No valid rows found in the CSV." },
      { status: 400 },
    );
  }

  const result = await importCsvRows(id, body.category, rows);

  return NextResponse.json({
    ...result,
    parsed: rows.length,
    rowErrors: errors,
  });
}

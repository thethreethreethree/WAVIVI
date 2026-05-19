import { type NextRequest, NextResponse } from "next/server";

import { requireAdmin } from "@/lib/toolbox/admin";
import { isCategoryId } from "@/lib/toolbox/categories";
import { scanRegion, scanRegionCategory } from "@/lib/toolbox/scan-engine";

/**
 * POST /api/admin/regions/[id]/scan   — trigger a scan (admin).
 *   body: { category?: CategoryId }   — omit to scan all 12 categories.
 *
 * Runs synchronously; a full-region scan touches the Overpass API 12 times.
 */

// Toolbox scans are long-running — extend the serverless limit.
export const maxDuration = 300;

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
      {
        error:
          "Signed in, but this account lacks the admin flag. " +
          `(user: ${user.email ?? user.id})`,
      },
      { status: 403 },
    );
  }

  const body = (await req.json().catch(() => null)) as {
    category?: string;
  } | null;

  if (body?.category) {
    if (!isCategoryId(body.category)) {
      return NextResponse.json(
        { error: `Unknown category: ${body.category}` },
        { status: 400 },
      );
    }
    const result = await scanRegionCategory(id, body.category);
    return NextResponse.json({ results: [result] });
  }

  const results = await scanRegion(id);
  const totalSaved = results.reduce((s, r) => s + r.saved, 0);
  return NextResponse.json({ results, totalSaved });
}

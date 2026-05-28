import { type NextRequest, NextResponse } from "next/server";

import { serverEnv } from "@/lib/env";
import { createAdminClient } from "@/lib/supabase/admin";
import { rowToStayInsert, type IngestRow } from "@/lib/toolbox/ingest-stay";
import { mapConcurrent, mirrorPhoto } from "@/lib/toolbox/mirror-photo";

/**
 * POST /api/admin/stays/ingest
 *
 * Endpoint for the Partner Collection browser extension to push scraped
 * Google Maps rows into the `stays` table.
 *
 * Auth: shared secret in `Authorization: Bearer <INGEST_TOKEN>`. The
 * route uses the service-role client, so RLS is bypassed — the token IS
 * the access gate. Rows always land with `needs_review = true` and
 * appear in /admin/stays/pending for staff approval.
 *
 * Body:
 *   {
 *     "rows": IngestRow[],            // see lib/toolbox/ingest-stay.ts
 *     "region_id"?: string | null     // optional, attached to every row
 *   }
 *
 * Response:
 *   {
 *     accepted: number,               // rows written (inserted + updated)
 *     skipped:  number,               // missing name / coords / source_ref
 *     errors:   { index: number, message: string }[]
 *   }
 */
export async function POST(req: NextRequest) {
  const expected = serverEnv.ingestToken;
  if (!expected) {
    return NextResponse.json(
      { error: "Ingest endpoint disabled (INGEST_TOKEN not set)." },
      { status: 503 },
    );
  }
  const auth = req.headers.get("authorization") ?? "";
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match || match[1] !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as {
    rows?: IngestRow[];
    region_id?: string | null;
  } | null;
  if (!body || !Array.isArray(body.rows)) {
    return NextResponse.json(
      { error: "Body must be { rows: IngestRow[] }." },
      { status: 400 },
    );
  }
  if (body.rows.length === 0) {
    return NextResponse.json({ accepted: 0, skipped: 0, errors: [] });
  }
  if (body.rows.length > 500) {
    return NextResponse.json(
      { error: "Batch too large; send at most 500 rows per request." },
      { status: 413 },
    );
  }

  const inserts = [];
  const errors: { index: number; message: string }[] = [];
  let skipped = 0;

  for (let i = 0; i < body.rows.length; i++) {
    const mapped = rowToStayInsert(body.rows[i], { regionId: body.region_id });
    if (!mapped) {
      skipped++;
      continue;
    }
    inserts.push(mapped);
  }

  if (inserts.length === 0) {
    return NextResponse.json({ accepted: 0, skipped, errors });
  }

  const supabase = createAdminClient();

  // Mirror Google-hosted photos into our own Storage bucket so we don't
  // depend on rotating googleusercontent URLs. Failures fall back to the
  // original URL — never block the whole ingest on photo issues.
  await mapConcurrent(inserts, 6, async (ins) => {
    const original = ins.photo_url ?? null;
    if (!original) return;
    const mirrored = await mirrorPhoto(supabase, ins.source_ref, original);
    if (mirrored && mirrored !== original) {
      ins.photo_url = mirrored;
      ins.metadata_json = {
        ...(ins.metadata_json ?? {}),
        source_photo_url: original,
      };
    }
  });

  const { data, error } = await supabase
    .from("stays")
    .upsert(inserts, {
      onConflict: "source,source_ref",
      ignoreDuplicates: false,
    })
    .select("id");

  if (error) {
    return NextResponse.json(
      { error: error.message, accepted: 0, skipped, errors },
      { status: 500 },
    );
  }

  return NextResponse.json({
    accepted: data?.length ?? inserts.length,
    skipped,
    errors,
  });
}

import { type NextRequest, NextResponse } from "next/server";

import { createClient } from "@/lib/supabase/server";

/**
 * GET /api/users/search?q=…
 *
 * Returns up to 8 matching profiles. Matches across:
 *  • Wondavu username — ILIKE
 *  • Instagram handle — ILIKE (we surface the verified flag in the result)
 *  • WhatsApp number — digits-only equality/contains (the
 *    `whatsapp_digits` generated column normalises formatting)
 *
 * Used by the Meet Travelers search bar.
 */
export async function GET(req: NextRequest) {
  const q = (req.nextUrl.searchParams.get("q") ?? "").trim();
  if (q.length < 2) {
    return NextResponse.json({ results: [] });
  }

  // Strip a leading @ so "@marcus" matches "marcus".
  const cleaned = q.replace(/^@/, "");
  const digits = cleaned.replace(/[^0-9]/g, "");

  const supabase = await createClient();

  // PostgREST escape: commas + parentheses break the .or() filter syntax.
  // We strip them defensively — none of our match targets contain those.
  const safe = cleaned.replace(/[(),]/g, "");

  const filters: string[] = [
    `username.ilike.%${safe}%`,
    `instagram_username.ilike.%${safe}%`,
  ];
  // Only add the phone clause when the query looks like a phone search;
  // otherwise the wildcard against an empty digits string explodes results.
  if (digits.length >= 4) {
    filters.push(`whatsapp_digits.ilike.%${digits}%`);
  }

  const { data, error } = await supabase
    .from("profiles")
    .select(
      "id, username, display_name, avatar_url, home_country, bio, instagram_username, instagram_verified",
    )
    .or(filters.join(","))
    .limit(8);

  if (error) {
    return NextResponse.json({ results: [], error: error.message });
  }

  return NextResponse.json({ results: data ?? [] });
}

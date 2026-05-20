"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { StayUpdate } from "@/types/supabase";

/**
 * Fields a partner is allowed to edit on their own stay listing. The
 * server-side allowlist mirrors what RLS would let them write anyway —
 * having it explicit means we never accidentally proxy admin-only fields
 * (rating, backpack_rating, claimed_by, source, region_id) through.
 */
const PARTNER_EDITABLE: (keyof StayUpdate)[] = [
  "name",
  "address",
  "phone",
  "whatsapp",
  "instagram",
  "facebook",
  "email",
  "website",
  "photo_url",
  "description",
  "price_per_night_usd",
  "check_in_time",
  "check_out_time",
  "amenities",
];

export type PartnerSaveResult = { error: string | null };

/**
 * Update the stay the signed-in user owns. RLS gates this — the policy
 * "Partners update their stay" only allows rows where `claimed_by =
 * auth.uid()`, so even if a malicious client passes a different id the
 * write fails server-side.
 */
export async function updateClaimedStay(
  stayId: string,
  patch: Partial<StayUpdate>,
): Promise<PartnerSaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in." };

  const updates: Record<string, unknown> = {};
  for (const key of PARTNER_EDITABLE) {
    if (key in patch) updates[key] = patch[key];
  }
  if (Object.keys(updates).length === 0) {
    return { error: "Nothing to update." };
  }

  const { error } = await supabase
    .from("stays")
    .update(updates as StayUpdate)
    .eq("id", stayId)
    .eq("claimed_by", user.id);
  if (error) return { error: error.message };

  revalidatePath("/partner");
  revalidatePath(`/partner/stays/${stayId}`);
  return { error: null };
}

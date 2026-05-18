import "server-only";

import { createClient } from "@/lib/supabase/server";

/**
 * Admin guard for API routes.
 *
 * Resolves the current user and whether they carry the `is_admin` flag in
 * their JWT app-metadata. RLS enforces this at the database level too —
 * this is the route-level gate for a clean 403.
 */
export async function requireAdmin() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const isAdmin = Boolean(
    (user?.app_metadata as { is_admin?: boolean } | undefined)?.is_admin,
  );
  return { user, isAdmin, supabase };
}

/** Build a stable region id slug, e.g. "el_nido_palawan_philippines". */
export function slugifyRegion(
  country: string,
  province: string | null,
  city: string,
): string {
  return [city, province, country]
    .filter((p): p is string => Boolean(p && p.trim()))
    .join("_")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

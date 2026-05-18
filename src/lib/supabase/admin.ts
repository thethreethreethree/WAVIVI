import "server-only";

import { createClient } from "@supabase/supabase-js";

import { publicEnv, serverEnv } from "@/lib/env";
import type { Database } from "@/types/supabase";

/**
 * Service-role Supabase client — bypasses Row-Level Security.
 *
 * Used by the scan engine and other trusted server-side jobs that write
 * across tables. SERVER-ONLY: the service role key must never reach the
 * browser. Do not import this into Client Components.
 */
export function createAdminClient() {
  return createClient<Database>(
    publicEnv.supabaseUrl,
    serverEnv.supabaseServiceRoleKey,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
}

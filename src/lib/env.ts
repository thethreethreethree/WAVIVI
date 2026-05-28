/**
 * Centralised environment-variable access.
 *
 * Public values (NEXT_PUBLIC_*) are safe to read on the client.
 * Server-only secrets must never be imported into client components.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

/** Values safe to use in the browser. */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  /** Wondavu Pet system is still in development. Set
   *  `NEXT_PUBLIC_PET_ENABLED=1` in dev to expose `/pet` and activate
   *  reward hooks. Unset / anything else → /pet returns 404 and reward
   *  calls are silent no-ops. */
  petEnabled: process.env.NEXT_PUBLIC_PET_ENABLED === "1",
};

/** Server-only secrets. Throws if accessed without being configured. */
export const serverEnv = {
  get supabaseServiceRoleKey() {
    return required(
      "SUPABASE_SERVICE_ROLE_KEY",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
  },
  /** Optional shared secret for /api/cron/scan. When set, the route
   *  requires `Authorization: Bearer <secret>` (Vercel Cron sends this
   *  automatically). Empty string disables the check. */
  cronSecret: process.env.CRON_SECRET ?? "",
  /** Optional Cloudflare Worker that proxies Instagram public-profile
   *  fetches — used because Vercel data-center IPs are routinely
   *  rate-limited / login-walled by IG. Empty string disables it. */
  instagramProxyUrl: process.env.INSTAGRAM_PROXY_URL ?? "",
  /** Shared secret the Worker checks (header: x-wavivi-proxy-secret).
   *  Empty string skips the header — useful for an open Worker in dev. */
  instagramProxySecret: process.env.INSTAGRAM_PROXY_SECRET ?? "",
  /** Shared secret the Partner Collection extension sends to
   *  /api/admin/stays/ingest (header: Authorization: Bearer <token>).
   *  Empty string disables ingestion. */
  ingestToken: process.env.INGEST_TOKEN ?? "",
};

/**
 * True when Supabase is configured — the app then runs against the real
 * backend instead of mock data. The map uses keyless Leaflet/CARTO tiles,
 * so a Mapbox token is not required here.
 */
export const isConfigured =
  publicEnv.supabaseUrl !== "" && publicEnv.supabaseAnonKey !== "";

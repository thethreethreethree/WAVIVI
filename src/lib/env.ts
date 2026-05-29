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

/** Resolve the canonical site URL with the least possible config.
 *
 *  1. `NEXT_PUBLIC_SITE_URL` — explicit override, wins if set (use this to
 *     pin a custom domain like https://wondavu.com once we have one).
 *  2. `VERCEL_PROJECT_PRODUCTION_URL` — Vercel auto-injects this on every
 *     deploy; it points at the project's stable production alias
 *     (e.g. `wondavu.vercel.app`). Right for prod email links.
 *  3. `VERCEL_URL` — Vercel auto-injects this too; per-deployment URL
 *     (e.g. `wondavu-git-feature-x.vercel.app`). Right for preview
 *     deploys so confirmation links return to the same preview.
 *  4. `http://localhost:3000` — local-dev fallback.
 *
 *  This is read server-side only (sitemap/robots/layout metadata/auth
 *  actions), so VERCEL_* env vars — which are not NEXT_PUBLIC and thus
 *  not exposed to the browser — work fine. If a client component ever
 *  needs the canonical URL, it must come through NEXT_PUBLIC_SITE_URL. */
function resolveSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_PROJECT_PRODUCTION_URL) {
    return `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`;
  }
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  return "http://localhost:3000";
}

/** Values safe to use in the browser. */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
  siteUrl: resolveSiteUrl(),
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

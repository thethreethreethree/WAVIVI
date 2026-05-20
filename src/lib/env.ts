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
};

/** Server-only secrets. Throws if accessed without being configured. */
export const serverEnv = {
  get supabaseServiceRoleKey() {
    return required(
      "SUPABASE_SERVICE_ROLE_KEY",
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    );
  },
  /** Optional Cloudflare Worker that proxies Instagram public-profile
   *  fetches — used because Vercel data-center IPs are routinely
   *  rate-limited / login-walled by IG. Empty string disables it. */
  instagramProxyUrl: process.env.INSTAGRAM_PROXY_URL ?? "",
  /** Shared secret the Worker checks (header: x-wavivi-proxy-secret).
   *  Empty string skips the header — useful for an open Worker in dev. */
  instagramProxySecret: process.env.INSTAGRAM_PROXY_SECRET ?? "",
};

/**
 * True when Supabase is configured — the app then runs against the real
 * backend instead of mock data. The map uses keyless Leaflet/CARTO tiles,
 * so a Mapbox token is not required here.
 */
export const isConfigured =
  publicEnv.supabaseUrl !== "" && publicEnv.supabaseAnonKey !== "";

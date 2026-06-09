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
 *  1. `NEXT_PUBLIC_SITE_URL` — explicit override, wins if set.
 *  2. `VERCEL_ENV === "production"` → `https://wondavu.com`. The custom
 *     domain is the canonical home; sitemap.xml / robots.txt / OG URLs
 *     all need to point here so search engines and OG-card consumers
 *     find a stable host. Without this, Vercel's auto-injected
 *     `VERCEL_PROJECT_PRODUCTION_URL` resolves to `*.vercel.app` and
 *     Google indexes the wrong domain.
 *  3. `VERCEL_PROJECT_PRODUCTION_URL` — Vercel auto-injects on every
 *     deploy. Used for non-production envs (preview / staging branches
 *     that don't have a custom domain).
 *  4. `VERCEL_URL` — per-deployment URL. Right for preview deploys so
 *     auth-confirmation links return to the same preview.
 *  5. `http://localhost:3000` — local-dev fallback.
 *
 *  This is read server-side only (sitemap/robots/layout metadata/auth
 *  actions), so VERCEL_* env vars — which are not NEXT_PUBLIC and thus
 *  not exposed to the browser — work fine. If a client component ever
 *  needs the canonical URL, it must come through NEXT_PUBLIC_SITE_URL. */
function resolveSiteUrl(): string {
  if (process.env.NEXT_PUBLIC_SITE_URL) return process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.VERCEL_ENV === "production") return "https://wondavu.com";
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
  /** VAPID public key — needed by the browser to subscribe to web push.
   *  Half of a key pair; the matching private key lives server-only in
   *  `serverEnv.vapidPrivateKey`. Generate a pair via:
   *    npx web-push generate-vapid-keys
   *  Leave empty to disable push entirely (Layer 2 self-disables: the
   *  client opt-in surface hides, the createNotification push fanout
   *  becomes a no-op). */
  vapidPublicKey: process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
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
  /** Instagram DM verification — the brand IG handle users send
   *  the token to. Surfaced in the UI ("DM @wondavu_official ..."). */
  instagramBrandHandle: process.env.INSTAGRAM_BRAND_HANDLE ?? "",
  /** Random opaque string we pick + paste into the Meta App webhook
   *  setup. Meta echoes it back on the GET verification handshake;
   *  we compare and return the challenge only when it matches. */
  instagramWebhookVerifyToken:
    process.env.INSTAGRAM_WEBHOOK_VERIFY_TOKEN ?? "",
  /** Meta App Secret — used to verify the X-Hub-Signature-256 HMAC
   *  on every incoming POST so we don't accept spoofed events. */
  instagramAppSecret: process.env.INSTAGRAM_APP_SECRET ?? "",
  /** Shared secret the Partner Collection extension sends to
   *  /api/admin/stays/ingest (header: Authorization: Bearer <token>).
   *  Empty string disables ingestion. */
  ingestToken: process.env.INGEST_TOKEN ?? "",
  /** DeepSeek API key for the Susen chat backend. The /api/susen/respond
   *  route handler reads this and proxies to DeepSeek server-side so the
   *  key never ships to the browser. Throws on access if missing — the
   *  client's retry path then falls through to the offline rule engine
   *  so the app never breaks. */
  get deepseekApiKey() {
    return required("DEEPSEEK_API_KEY", process.env.DEEPSEEK_API_KEY);
  },
  /** Override the DeepSeek model. Defaults to `deepseek-chat` — the
   *  cheap/fast general-purpose chat model. Set to `deepseek-reasoner`
   *  for the chain-of-thought-trained variant (slower, smarter, more
   *  expensive). */
  susenModel: process.env.SUSEN_MODEL ?? "deepseek-chat",
  /** CSV of identities (emails or short handles) whose Susen chats are
   *  captured as tuning notes + flagged for live OPERATOR GUIDANCE
   *  injection. See `isSusenAdmin()` in lib/susen/tuning.ts.
   *
   *  Defaults to the founder's identity so dev environments without
   *  the env var still attribute tuning to a single person rather
   *  than silently capturing nothing. Override in production via the
   *  Vercel env var. */
  susenAdmins: (process.env.SUSEN_ADMINS ?? "johnsyramos@gmail.com,@john,john")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean),
  /** VAPID private key — the server-side half of the push key pair.
   *  Together with the public key (`publicEnv.vapidPublicKey`) it signs
   *  every push payload so the browser will accept the delivery.
   *  Empty disables push (Layer 2 self-disables — see publicEnv).
   *  Generate via `npx web-push generate-vapid-keys`. */
  vapidPrivateKey: process.env.VAPID_PRIVATE_KEY ?? "",
  /** mailto: contact address VAPID requires so push relays can reach
   *  out about delivery problems. Defaults to support@ to keep delivery
   *  unblocked while the team chooses a long-term address. */
  vapidSubject:
    process.env.VAPID_SUBJECT ?? "mailto:support@wondavu.com",
};

/**
 * True when Supabase is configured — the app then runs against the real
 * backend instead of mock data. The map uses keyless Leaflet/CARTO tiles,
 * so a Mapbox token is not required here.
 */
export const isConfigured =
  publicEnv.supabaseUrl !== "" && publicEnv.supabaseAnonKey !== "";

# WAVIVI

A live social map for travelers — discover nearby travelers, join group chats,
find events, and feel the vibe of every place. Installable PWA.

## Tech stack

- Next.js 16 (App Router) · React 19 · TypeScript
- Tailwind CSS v4
- Supabase (Postgres · Auth · Realtime · Storage)
- Leaflet (keyless CARTO tiles) for the Vibe Map
- DeepSeek (Susen, the in-app travel concierge)

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in Supabase + DeepSeek keys
npm run dev
```

Open http://localhost:3000.

See [CLAUDE.md](CLAUDE.md) for project conventions, [AGENTS.md](AGENTS.md)
for the Next.js 16 caveats, and [CLAUDE-problem-solving.md](CLAUDE-problem-solving.md)
for the reasoning discipline this repo follows.

## Roadmap

| Phase | Goal                      |
| ----- | ------------------------- |
| 1     | Foundation & Architecture |
| 2     | Authentication & Profiles |
| 3     | Live Map System           |
| 4     | Traveler Discovery        |
| 5     | Group Chat Ecosystem      |
| 6     | Events & Meetups          |
| 7     | Vibe/Heat System          |
| 8     | AI Recommendation Layer   |
| 9     | Partner/Venue System      |
| 10    | PWA Optimization          |
| 11    | Safety & Verification     |
| 12    | Scaling & Optimization    |

See `src/config/phases.ts` for live status.

---

## Ops runbook

Operational reference for the production deployment. Production lives at
**wondavu.com** (custom domain on Vercel). The `main` branch auto-deploys.

### Environment variables (Vercel → Settings → Environment Variables)

Set every required variable on the **Production** environment. Preview
and Development inherit from Production unless explicitly overridden.

**Required**

| Variable                       | Source                                | Purpose                                                                  |
| ------------------------------ | ------------------------------------- | ------------------------------------------------------------------------ |
| `NEXT_PUBLIC_SUPABASE_URL`     | Supabase → Project Settings → API     | Browser + server client                                                  |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY`| Supabase → Project Settings → API     | Browser + server client                                                  |
| `SUPABASE_SERVICE_ROLE_KEY`    | Supabase → Project Settings → API     | Admin dashboard aggregates, ingestion, mirroring. SERVER ONLY.           |
| `DEEPSEEK_API_KEY`             | platform.deepseek.com                 | Powers `/api/susen/respond`. Without it Susen silently falls back to the offline engine. |

**Optional**

| Variable                       | Default                               | Purpose                                                                  |
| ------------------------------ | ------------------------------------- | ------------------------------------------------------------------------ |
| `SUSEN_MODEL`                  | `deepseek-chat`                       | Set to `deepseek-reasoner` for slower/smarter responses.                 |
| `SUSEN_ADMINS`                 | `johnsyramos@gmail.com,@john,john`    | CSV of identities whose chats get tuning capture + live operator guidance. |
| `CRON_SECRET`                  | (empty = disabled)                    | Bearer token for `/api/cron/scan`. Vercel Cron sets this automatically.  |
| `INGEST_TOKEN`                 | (empty = endpoint off)                | Bearer for the Partner Collection extension hitting `/api/admin/stays/ingest`. |
| `INSTAGRAM_PROXY_URL`          | (empty = direct fetch)                | Cloudflare Worker that proxies IG public-profile fetches.                |
| `INSTAGRAM_PROXY_SECRET`       | (empty = no header)                   | Shared secret the Worker checks.                                         |
| `NEXT_PUBLIC_PET_ENABLED`      | (off)                                 | Set to `1` to expose `/pet` and activate reward hooks. Leave OFF in prod. |
| `NEXT_PUBLIC_SITE_URL`         | (auto-resolved to wondavu.com in prod)| Override only if running on a non-Vercel host.                           |

After changing any env var: **Vercel → Deployments → Redeploy** the latest
commit. Env updates do not retroactively apply to existing deploys.

### Supabase project

- **Project**: linked to wondavu.com production.
- **Auth → URL Configuration**:
  - Site URL: `https://wondavu.com`
  - Redirect URLs (allowlist must include all four):
    - `https://wondavu.com/auth/callback`
    - `https://wondavu.com/auth/callback?**`
    - `http://localhost:3000/auth/callback`
    - `http://localhost:3000/auth/callback?**`

  If a "Google OAuth loops back to /login" symptom recurs, see the
  [2026-05-30 postmortem](docs/postmortems/2026-05-30-google-oauth-loop.md) —
  the redirect allowlist is the first place to look, not the cookie code.

- **Storage buckets** (created via Supabase dashboard or first-write):
  - `stays-photos` — public read. Used by stays, restaurants, experiences,
    AND the feed (under the `feed/` prefix; see `src/lib/feed/mirror.ts`).
  - `chat-photos` — public read. Used by group chat image attachments.

### Database migrations

Migrations are SQL files in `supabase/migrations/`, numbered sequentially.
They are NOT auto-applied by Vercel — run them by hand in the
**Supabase SQL Editor** after merging the corresponding commit.

Every migration is idempotent (`drop policy if exists` before `create
policy`, `add column if not exists`, etc.) so re-running a migration is
safe if you're unsure whether it ran.

To find pending migrations after a `git pull`:

```bash
ls supabase/migrations/ | tail -5
```

Compare against the highest-numbered migration you've actually run on
the production database. Everything above that number is pending.

### Rate limits

Two layers in play:

1. **Supabase project-level**: built-in caps on auth endpoints (sign-up,
   sign-in, password reset). Configure under **Supabase → Auth →
   Rate Limits**.
2. **Application-level** (migration 0053 + `lib/rate-limit/check.ts`):
   per-user sliding-window limits backed by `rate_limit_counters` +
   the `rate_limit_consume()` RPC. Applied today to:
   - `POST /api/susen/respond` — 20/min and 300/hour. Returns 429 with
     a `retry-after` header when crossed.
   - `chat.sendMessage`, `chat.sendChatImage`, `chat.sendChatLocation`
     — shared 30/min limit so swapping to images doesn't dodge the meter.

When adding a new high-cost endpoint, define a `RateLimitSpec` in
[lib/rate-limit/check.ts](src/lib/rate-limit/check.ts) and call
`checkRateLimit(userId, spec)` at the top of the handler.

### Analytics (Vercel)

`@vercel/analytics` and `@vercel/speed-insights` are mounted in the root
layout — they're inert outside Vercel and emit no cookies by default
(consent-free for basic web analytics). To see the data: **Vercel →
Project → Analytics → Enable** (and **Speed Insights → Enable**). Both
have free tiers that cover early-stage traffic.

### Cron jobs (Vercel)

Configured in [vercel.json](vercel.json). All routes are guarded by
`CRON_SECRET` (Vercel Cron supplies the bearer header automatically).
Schedule + status: **Vercel → Project → Cron Jobs**.

- `/api/cron/scan?mode=full` — weekly Mon 03:00 UTC. Re-scans every active region.
- `/api/cron/scan?mode=refresh` — daily 04:00 UTC. Refreshes regions not scanned in ~20h.
- `/api/cron/purge-deletions` — daily 03:30 UTC. Hard-deletes auth users whose
  `profiles.deletion_requested_at` is older than 30 days. The route response
  is the run summary (`considered / purged / failed`) so the dashboard
  surfaces the numbers without log-diving. Cascade FKs handle the
  downstream rows.

### Cache busting (PWA / service worker)

The service worker caches the app shell. When shipping a fix that needs
to land on already-installed PWAs immediately, bump the cache name in
the service-worker file (e.g. `v5 → v6`). Precedent:
[commit 30e6234](https://github.com/thethreethreethree/WAVIVI/commit/30e6234).
Without the bump, users on installed PWAs serve the stale shell until
their cache invalidates naturally.

### When something breaks

The Constitution lives in [CLAUDE-problem-solving.md](CLAUDE-problem-solving.md).
Short version: **probe before patch.** If a bug is silent (loop, blank
UI, no error toast) and attempt #1 doesn't move the symptom, do NOT
ship attempt #2 against the same mental model. Build a probe first —
a `/auth/debug` page took 5 minutes to write and revealed what 3 wrong
OAuth patches couldn't. See [CLAUDE.md § Debugging](CLAUDE.md#debugging--probe-before-patch).

### Error logging

All errors flow through `reportError()` in
[src/lib/observability/log.ts](src/lib/observability/log.ts), which emits
structured JSON lines prefixed `[wv-error]`. Search Vercel logs with that
prefix to filter. The same file holds the vendor-SDK hook spot — when a
real error tracker (Sentry, Highlight, PostHog) is added, the integration
lives there and lights up every existing call site automatically.

When the same bug burns ≥3 patches, write a postmortem under
`docs/postmortems/YYYY-MM-DD-slug.md` following
[the template](docs/postmortems/_TEMPLATE.md). Index entries land in
[CLAUDE.md § Postmortems log](CLAUDE.md#postmortems-log).

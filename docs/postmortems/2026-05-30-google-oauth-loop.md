# Postmortem: Google OAuth infinite sign-in loop

**Date:** 2026-05-30
**Commit range:** `b4f4554` → `a4cd934` (real fix), `59c9e14` (CLAUDE.md rule)
**Time to fix:** 4 wrong attempts / 6 commits before the cause was identified
**Authors / agents involved:** Claude Opus 4.7 + user

## Symptom

After enabling "Continue with Google" on `/login` and `/signup`, the
flow looked superficially successful: user tapped the button, went
through Google consent, and was redirected back to the app. But every
protected page (`/profile`, `/where-to-next`, others) then redirected
them back to `/login` as if they were never signed in. Tapping Google
again recreated the same state. The user described it as "infinite
sign-in loop."

No error toast was shown. No console error appeared in our handlers.
The URL bar quietly landed on `/login` with no `?error=` query, which
hid the failure mode. The only visible signal was the loop itself.

## Wrong hypotheses (and why each was wrong)

The unifying mistake: every attempt assumed *the user got signed in
and then the session was lost.* The actual failure was *the session
never existed in the first place.* None of the attempts read auth
state from the loop — they all built on a guessed mental model.

- **Attempt 1 — `b4f4554`** — Hypothesis: "the OAuth callback writes
  cookies via `next/headers` cookieStore, which doesn't reliably attach
  to `NextResponse.redirect()` inside a Route Handler. The shared
  server client's try/catch swallows the failed cookie writes silently."
  Fix: rewrote the callback to construct `createServerClient` inline
  with `setAll` writing directly to the response's cookie jar.
  Why it didn't work: the callback was never reached, so its cookie
  writes were irrelevant. No evidence was checked for whether the
  exchange even ran.

- **Attempt 2 — `472828e`** — Hypothesis: "supabase-ssr's PKCE flow
  needs a `code_verifier` cookie set when `signInWithOAuth` runs.
  From a Server Action that ends in `redirect()`, those cookie writes
  don't reliably arrive in the browser before the navigation away —
  so the verifier is missing in the callback." Fix: moved the OAuth
  trigger to a client component (`GoogleButton`) so `signInWithOAuth`
  runs in the browser and writes the verifier cookie synchronously
  via `document.cookie` before the redirect. Why it didn't work: the
  verifier cookie *was* present (later confirmed by `/auth/debug`).
  The fix solved a real-but-unrelated subtle bug; it did not solve
  the loop.

- **Attempt 3 — `2574049`** — Hypothesis: "the loop is gated on
  `getCurrentProfile()` returning null. The `handle_new_user` trigger
  may miss profile creation for OAuth signups, so the user is auth'd
  but profile is missing and `/profile`/`/where-to-next` redirect to
  `/login`." Fix: made `getCurrentProfile()` self-heal by inserting a
  profile row if the user is signed in but no row exists. Why it
  didn't work: the user was *not* signed in — `auth.getUser()` returned
  null — so the self-heal path never ran. The hypothesis was internally
  coherent but disconnected from the actual auth state.

All three patches lived in the same wrong mental model: "auth
succeeded somewhere and then we lose it." The user's repeated
"same problem" was the signal to stop and probe.

## How we eventually found the real cause

After the third failed patch, built `/auth/debug`
([commit `17887a5`](../../src/app/(app)/auth/debug/page.tsx)), a
server page that dumps everything: every cookie name, supabase-related
cookie lengths, `supabase.auth.getUser()` result + error,
`supabase.auth.getSession()` result + error, and the matching
`profiles` row. No redirects. The user visited it after the loop
happened and shared the JSON.

The data showed only 4 cookies present, the only Supabase-related
one being `sb-<project>-auth-token-code-verifier`. No
`sb-<project>-auth-token` (session). `auth.getUser()` returned null
with `"Auth session missing!"`. The session cookie had never been
written.

Because the cause could still have been "callback ran but cookie
writes failed" vs "callback never ran at all," a trace cookie was
added to the callback ([`9d06c74`](../../src/app/(app)/auth/callback/route.ts))
that recorded each step (`callback_hit`, `exchange_done`) into an
`auth_callback_trace` cookie, displayed by `/auth/debug`. The user
ran the flow again and shared the second debug dump:

```json
"callback_trace": { "present": false, "parsed": null, "parse_error": null }
```

**The trace cookie was absent. The callback was never invoked.**

That eliminated every cookie-persistence and PKCE-timing hypothesis at
once. The Google round-trip was completing but the user wasn't
landing on `/auth/callback` — they were landing somewhere else with
the `?code=` query that no handler picked up.

## Root cause

Supabase's OAuth handler honours the `redirectTo` query passed to
`signInWithOAuth` **only if** that URL matches the project's
**Redirect URLs allowlist** under Authentication → URL Configuration.
The project had been configured with Site URL set but Redirect URLs
empty (or only the bare origin). Our `redirectTo` was
`https://<app>/auth/callback?next=/profile`, which was not allowlisted.
When Supabase's `/auth/v1/callback` rejected the redirect, it
silently fell back to the project's Site URL (`https://<app>`) and
appended the `?code=` query.

The user therefore landed on `/` (or `/welcome` via our middleware
WELCOMED redirect) with a fresh PKCE code in the URL that no route
handler processed. The code expired unused, no session was created,
and every protected page bounced them to `/login` because the
auth state was still empty.

## Fix

Two parts, both required:

1. **Supabase dashboard configuration (user-side, outside the codebase).**
   Authentication → URL Configuration:
   - **Site URL:** `https://<vercel-production-domain>`
   - **Redirect URLs:** add `https://<vercel-production-domain>/auth/callback`
     and `https://<vercel-production-domain>/**` for wildcard so the
     `?next=` variants all match. Save.

2. **Middleware `?code=` recovery — defensive permanent guardrail
   ([commit `a4cd934`](../../src/lib/supabase/proxy.ts)).** If any
   path other than `/auth/callback` arrives carrying a `?code=` query,
   the middleware rewrites the navigation to
   `/auth/callback?code=<code>&next=<landed-path>` so the exchange
   still runs. This means even if the dashboard config drifts or a
   new redirect URL slips through, the loop cannot recur.

## Permanent guardrails kept

- **`?code=` middleware recovery** ([`src/lib/supabase/proxy.ts`](../../src/lib/supabase/proxy.ts)) —
  catches any OAuth code on any path and forwards to `/auth/callback`.
  Costs nothing on normal navigations (cheap query check), prevents
  the entire class of "Supabase fell back to Site URL" regressions.
- **Self-healing profile row in `getCurrentProfile()`**
  ([`src/lib/profiles.ts`](../../src/lib/profiles.ts)) — landed in
  attempt #3 (`2574049`). Wasn't the root cause but is genuinely
  defensive: any auth user without a profile row gets one created
  inline. Kept.
- **Client-side `signInWithOAuth` in `<GoogleButton>`**
  ([`src/features/auth/components/google-button.tsx`](../../src/features/auth/components/google-button.tsx)) —
  landed in attempt #2 (`472828e`). Also not the root cause but
  genuinely simpler/cleaner than the Server Action equivalent for
  PKCE. Kept.
- **Inline cookie writes in `/auth/callback`**
  ([`src/app/(app)/auth/callback/route.ts`](../../src/app/(app)/auth/callback/route.ts)) —
  landed in attempt #1 (`b4f4554`). Same — not the root cause but the
  canonical supabase-ssr Route Handler pattern, worth keeping.

The diagnostic surface (`/auth/debug` page, `auth_callback_trace`
cookie writes) is scaffolding and will be removed in a cleanup pass
when the user gives the word.

## Lessons & rule changes

- **CLAUDE.md "Debugging — probe before patch"** ([commit `59c9e14`](../../CLAUDE.md))
  codifies the rule: if attempt #1 doesn't move the symptom, build a
  probe before attempt #2. Includes the failure-shape → probe-shape
  table, the one-question probes to ask the user, and the
  famous-community-bug pattern-match trap.
- **CLAUDE.md "The three-attempt rule — write a postmortem"** (same
  commit) requires a postmortem whenever a bug takes >3 attempts.
  This file is the first entry.
- **Memory:** `feedback-probe-before-patching.md` (user memory) +
  existing `feedback-diagnose-before-fixing.md` updated to cross-link.
- **The biggest single lesson:** "auth cookies don't persist" is the
  loudest community bug for Supabase-SSR. We pattern-matched to it
  three times in a row even though no evidence supported it. The
  next time the symptom looks like a famous bug, *check the symptom's
  signature against the famous bug's signature* (in this case: does
  the user actually have any auth cookies at all? a 5-second devtools
  check) before patching.

## References

- Commits:
  - `b4f4554` — Attempt 1: callback writes cookies to response
  - `472828e` — Attempt 2: client-side Google trigger for PKCE
  - `2574049` — Attempt 3: self-healing profile row
  - `17887a5` — `/auth/debug` page
  - `9d06c74` — callback trace cookie
  - `a4cd934` — middleware `?code=` recovery (real fix, code side)
  - `59c9e14` — CLAUDE.md rule additions
- Files (final state):
  - [`src/app/(app)/auth/callback/route.ts`](../../src/app/(app)/auth/callback/route.ts)
  - [`src/app/(app)/auth/debug/page.tsx`](../../src/app/(app)/auth/debug/page.tsx) (scaffolding)
  - [`src/features/auth/components/google-button.tsx`](../../src/features/auth/components/google-button.tsx)
  - [`src/lib/profiles.ts`](../../src/lib/profiles.ts)
  - [`src/lib/supabase/proxy.ts`](../../src/lib/supabase/proxy.ts)
- External:
  - Supabase Authentication → URL Configuration (project dashboard)
  - supabase-ssr Next.js OAuth route handler example

# WAVIVI

A live social map for travelers — discover nearby travelers, join group chats,
find events, and feel the "vibe" of every place. Built as an installable PWA.

@AGENTS.md

@CLAUDE-problem-solving.md

## Stack

- **Framework:** Next.js 16 (App Router) + React 19 + TypeScript
- **Styling:** Tailwind CSS v4 (tokens defined in `src/app/globals.css`)
- **Backend:** Supabase (Postgres, Auth, Realtime, Storage)
- **Maps:** Leaflet with keyless CARTO tiles (the Vibe Map)

## Project structure

```
src/
  app/            Next.js routes, layout, global styles
  components/ui/  Shared, cross-cutting UI primitives
  config/         Static config (site metadata, roadmap phases)
  features/       Feature modules, one per roadmap phase (see features/README.md)
  hooks/          Shared React hooks
  lib/
    env.ts        Centralised environment-variable access
    supabase/     Browser, server, and middleware Supabase clients
    utils/        Generic helpers
  types/          Shared TypeScript types (incl. generated Supabase types)
  middleware.ts   Refreshes the Supabase auth session per request
```

## Conventions

- Import via the `@/*` alias, not relative paths across folders.
- Features must not import from each other — share through `lib/`.
- All env access goes through `src/lib/env.ts`; never read `process.env`
  directly elsewhere. Server secrets must never reach client components.
- Use Supabase clients from `lib/supabase/`: `client.ts` in Client Components,
  `server.ts` in Server Components / Route Handlers / Server Actions.

## Setup

1. `npm install`
2. Copy `.env.example` to `.env.local` and fill in the Supabase keys.
3. `npm run dev`

## Typography

The app uses **two fonts only**:

- **Reenie Beanie** (`var(--font-handwriting)`) — traveler's handwriting voice.
  Used for character moments only: display titles, journal entries, pull
  quotes, decorative accents. Never for body, UI, buttons, or forms.
- **Quicksand** (`var(--font-body)`) — everything else: body, headings, UI,
  buttons, labels, navigation, forms.

(Permanent Marker is reserved for the brand wordmark + a handful of marker
headings inside `.font-hand-app`. Space Grotesk is the YumYumPo partner-page
font. Geist Mono is for inline code only.)

**How to render text:** import from `@/components/text` and use the named
components. Never hardcode `font-family`, `font-size`, `line-height`, or use
raw Tailwind sizes like `text-3xl` / `text-sm` — they bypass the type system.

```tsx
import { Heading, BodyText, JournalText, Caption, ButtonText } from "@/components/text";

<Heading level={1}>Discover Palawan</Heading>
<BodyText>Hidden lagoons and limestone cliffs await.</BodyText>
<JournalText>Day three. The water is so clear it doesn&apos;t look real.</JournalText>
<Caption>Posted 2h ago</Caption>
```

When you need a one-off style: add it to `src/design/typography.ts` with a
semantic name (`hero`, `pageSubtitle`, not `text20Bold`), add a matching
utility class to `globals.css`, add a convenience component to
`src/components/text/Text.tsx`, then use it everywhere — never inline.

**Reenie Beanie rule of thumb:** if you find yourself reaching for it more
than ~10% of the time, you're overusing it. Guest voice, not default.

## Roadmap

Build order is tracked in `src/config/phases.ts`. All 12 phases are
feature-complete against mock data. Remaining production work: wire up a live
Supabase project (auth, profiles, realtime chat), then swap the rule-based
recommendation engine for a real AI call when desired.

## Approach quality is the user's time

The way an agent approaches a problem determines how many hours of the
user's day the resolution costs. An ineffective approach produces
ineffective solution attempts — every wrong patch ships, the user has
to re-test, Vercel has to redeploy, context drifts, and the actual
bug stays hidden behind layers of false fixes. The cost is not paid
in agent output tokens. It's paid in hours of the user's life.

**Documented precedent: the 2026-05-30 Google OAuth loop
([postmortem](docs/postmortems/2026-05-30-google-oauth-loop.md))
cost the user approximately three hours.** Three patches were shipped
against the same wrong hypothesis ("session cookies aren't persisting")
before a five-minute debug page revealed the actual cause (Supabase
silently fell back to the project's Site URL because the redirect URL
wasn't allowlisted, so our callback was never invoked). All three
patches were sincere attempts, each one looked like ~20 minutes of
work, and together they erased an entire afternoon of progress.

**Why ineffective approaches compound, instead of merely adding:**

- A wrong patch is not the same as no patch — it lands in the
  codebase, alters behaviour in related paths, and the next patch
  has to reason about that altered state too.
- Each round costs the user a re-test cycle (clear cache, sign in
  again, navigate to the failing page) on top of agent time. Three
  rounds = three full re-tests.
- The agent's mental real estate stays occupied by the wrong model.
  Each subsequent patch is generated under the same flawed framing
  and inherits the same blind spots.
- The user's frustration is a real cost. "Same problem bro" three
  times in a row is a signal that progress has stopped, not that
  the next patch will be the one.

**Effective approaches feel slower per attempt and cost less in total.**
After attempt #1 doesn't move the symptom: stop. Ask one cheap
diagnostic question or build one probe. Get one piece of real
evidence. Then write one targeted fix. Total wall-clock for the
same bug, done right: under an hour.

Every section below — probe before patch, the three-attempt rule,
the postmortems log — exists because of this trade. They are not
process for process's sake. They are the operational mechanics that
keep an agent from spending the user's afternoon patching the wrong
hypothesis.

## Debugging — probe before patch

A bug is **silent** when there's no error toast, no console log, no broken
UI text — just "loops back to login," "page is blank," "save doesn't
stick," "icons stay on the wrong theme." Silent bugs lie. Most of the
visible symptom is consistent with three or four different root causes,
and patching the wrong one feels indistinguishable from progress until
the user comes back with "same problem."

**Rule:** if attempt #1 doesn't move the symptom, do NOT ship attempt
#2 against the same mental model. Stop and build a probe first.

Why this rule exists: we burned three commits on the Google-OAuth loop
(`b4f4554`, `472828e`, `2574049`) all assuming "session cookies aren't
persisting." The actual bug was that the OAuth callback was never
reached — Supabase silently fell back to the project's Site URL because
our `/auth/callback?next=...` wasn't in the **Redirect URLs** allowlist.
A 5-minute `/auth/debug` page (commit `17887a5` → `9d06c74`) dumped the
auth state and the answer was instant. The three patches before it
were all the same wrong hypothesis in slightly different clothes.

### The probe pattern

Match the probe shape to the failure shape:

| Failure | Probe |
|---|---|
| Auth / cookie / session bug | `/auth/debug` page that dumps `cookies()`, `supabase.auth.getUser()`, `getSession()`, and the relevant DB row |
| Redirect chain bug | A trace cookie written at each hop carrying `{ step, ok, detail }` entries, displayed by the debug page |
| Server-side silent failure | `console.error` with a stable prefix the user can pull from Vercel logs |
| Client-side state bug | A `?debug=1` toggle that overlays the relevant React state as JSON in a fixed corner |
| "It worked, now it doesn't" | `git bisect` is the probe — narrow to the commit before guessing |

### What to ask the user

The cheapest probe is a single question. Before any code change on a
silent bug, ask one of:

- "Screenshot the URL bar when the symptom happens."
- "Open devtools → Application → Cookies and screenshot the list."
- "What's the full error / network response if you open devtools?"
- "Does it happen on a hard refresh / clean profile / incognito?"

One turn, often resolves the case.

### The trap to avoid

Pattern-matching to the **loudest community bug** (the famous Supabase-SSR
cookie bug, the React strict-mode double-render, the Next.js hydration
mismatch). Those are loud because they're common, not because they're
*this* bug. Read the evidence in front of you first. If the user's
symptom doesn't include the famous bug's signature, it isn't the famous
bug.

### Cleanup

Probes are scaffolding. After the real fix lands, delete the debug
page, remove the trace cookie writes, and keep only the production
guardrails (e.g. the `?code=` middleware recovery from `a4cd934` — it's
permanent because it costs nothing and prevents a regression). Don't
let the probe rot into the codebase.

### The three-attempt rule — write a postmortem

When a single bug takes **more than three attempts** to resolve, the
agent (or me) **MUST** write a postmortem immediately after the real
fix lands — no asking, no waiting. The cost of NOT writing it is that
the same wrong mental model trips the next agent / future-me on a
similar bug six months later.

Trigger criteria — write the postmortem if **any** of these hold:
- ≥4 commits chased the bug before the symptom moved
- ≥2 of those commits patched the same hypothesis in different clothes
- The user said "same problem" two or more times in a row
- The root cause was outside the suspected subsystem (e.g. the symptom
  looked like an auth bug but the cause was a dashboard config)
- A diagnostic probe (debug page, trace cookie, devtools session) was
  what finally revealed the cause

Format and location:

1. Short bullet entry in the **Postmortems log** below — one entry per
   incident, ≤6 lines, with a link to the full writeup.
2. Full writeup at `docs/postmortems/YYYY-MM-DD-slug.md` following the
   template in [docs/postmortems/_TEMPLATE.md](docs/postmortems/_TEMPLATE.md).
3. If the incident exposed a missing project rule, also update the
   relevant section of this file (CLAUDE.md) so the rule applies
   project-wide, not just to one agent.

The postmortem doesn't blame anyone. It captures: what we saw, what
we thought, why that was wrong, what was actually true, how we found
out, what we changed, and what rule keeps the same trap from biting
next time. Don't write a novel — short, structured, scannable.

## Postmortems log

Entries are reverse-chronological. Each links to a full writeup.

- **2026-05-30 — Google OAuth infinite sign-in loop**
  [`docs/postmortems/2026-05-30-google-oauth-loop.md`](docs/postmortems/2026-05-30-google-oauth-loop.md).
  Symptom: every protected page bounced signed-in users back to /login.
  Wrong hypothesis (3 patches): "session cookies aren't persisting after auth succeeds."
  Real cause: Supabase Redirect URLs allowlist was missing `/auth/callback`,
  so Supabase silently fell back to Site URL and our callback was never
  invoked. Found by a `/auth/debug` page + trace cookie. Lesson encoded:
  the "probe before patch" rule above + the `?code=` recovery in
  middleware (`a4cd934`) as a permanent guardrail.

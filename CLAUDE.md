# WAVIVI

A live social map for travelers — discover nearby travelers, join group chats,
find events, and feel the "vibe" of every place. Built as an installable PWA.

@AGENTS.md

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

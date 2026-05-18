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

## Roadmap

Build order is tracked in `src/config/phases.ts`. All 12 phases are
feature-complete against mock data. Remaining production work: wire up a live
Supabase project (auth, profiles, realtime chat), then swap the rule-based
recommendation engine for a real AI call when desired.

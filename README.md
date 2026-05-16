# WAVIVI

A live social map for travelers — discover nearby travelers, join group chats,
find events, and feel the vibe of every place. Installable PWA.

## Tech stack

- Next.js 16 (App Router) · React 19 · TypeScript
- Tailwind CSS v4
- Supabase (Postgres · Auth · Realtime · Storage)
- Mapbox GL JS

## Getting started

```bash
npm install
cp .env.example .env.local   # then fill in Supabase + Mapbox keys
npm run dev
```

Open http://localhost:3000.

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

See `src/config/phases.ts` for live status and `CLAUDE.md` for architecture.

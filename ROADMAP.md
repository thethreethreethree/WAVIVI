# WAVIVI / Travejor — Build Checklist

Living plan. Items move from 🟥/🟧/🟨/🌱 → ✅ as we ship them.

---

## 📊 Release readiness

```
Toward demo-able beta (mock data):  ████████████████░░░░  85%
Toward production launch (v1):      █████████████████░░░  87%
```

### Per-track completion

| Track                              | Done | Status |
|------------------------------------|-----:|--------|
| Foundation (stack, proxy, PWA)     | 95 % | ✅ ready |
| Design system + themes (4-way)     | 90 % | ✅ ready, polishing |
| Maps (Vibe + Toolbox)              | 85 % | ✅ ready, needs real Vibe data |
| Toolbox backend + admin            | 93 % | ⏳ seed pending |
| App pages (against mock data)      | 85 % | ⏳ wire to real data |
| Auth (end-to-end signup → session) | 90 % | ✅ live, only email-confirm test left |
| Profiles (read/write real)         | 85 % | ✅ identity + countries + IG + thumbs live |
| Group chat (Realtime)              | 75 % | ✅ live; members page still mock |
| Traveler notes / events / RSVPs    | 10 % | 🟧 P1 |
| Push notifications                 |  0 % | 🟧 P1 |
| Instagram (real, not mock)         | 95 % | ✅ verify + auto-seed + real thumbnails, live |
| Susen AI (real Claude call)        | 25 % | 🟨 P2 |
| A11y, i18n, observability          | 10 % | 🟨 P2 |
| Native wrapper / monetization      |  0 % | 🌱 P3 |

**How the overall numbers are derived:** the *beta* meter weights what makes
the app demoable against mock data (foundation, design, UI, maps).
The *launch* meter weights what makes it a real product real users can
trust (auth, real data, chat, notifications, observability).

---

## ✅ Done

### Foundation
- [x] Next.js 16 (App Router) + React 19 + TS + Tailwind v4
- [x] Route groups: `(app)` mobile shell, `(web)` partner site, `(web)/(site)` public marketing
- [x] Device proxy — desktop → `/discover`, phones → app; `?app=1` override
- [x] Supabase clients (browser / server / proxy)
- [x] Centralised env via `lib/env.ts`
- [x] PWA — manifest, service worker (network-first, auto-update)

### Design system
- [x] Watercolor frames + edge SVG filters (`wc-frame`, `wc-edge`, `wc-torn`)
- [x] Four themes: **Light · Dark · Cute · FUEGO!** with 4-way toggle
- [x] Hand-painted icon sets (`cute-v2`, `orange`) with theme-aware swap
- [x] Bottom nav (floating, animated label, oversized Home)
- [x] Susen orb with bob animation
- [x] Settings gear (spinning)

### Maps
- [x] Vibe Map (CARTO Voyager + Leaflet)
- [x] Toolbox Map (`tb-pin` markers, torn-paper clip)
- [x] Default zoom 13 (≈5 km radius) / Near-me zoom 16 (≈1 km)
- [x] Region selector + category filter chips

### Toolbox backend
- [x] Migrations 0003–0006: regions, utilities, backpack/CSV columns, **contact channels**
- [x] OpenStreetMap Overpass scan engine
- [x] Region admin UI (CRUD + scan trigger)
- [x] CSV import (per-category)
- [x] Backpack rating + community 👍 / 👎
- [x] Per-utility admin editor
- [x] Admin filters: min rating + has-IG/FB/WhatsApp/email/phone/website
- [x] Scheduled scans (Vercel Cron — weekly full + daily refresh)

### Pages built (mock data)
- [x] Home / radial hub
- [x] Tools grid → Toolbox Map
- [x] Vibe Map
- [x] Meet (group cards) → group detail → members → chat
- [x] Other-user profile `/u/[username]` (Instagram-linked mockup)
- [x] Feed (redesigned as watercolor card stack)
- [x] Susen chat
- [x] Notes
- [x] Profile / Settings / Edit profile
- [x] Auth screens (login / signup)
- [x] Admin web header with admin-only button

### Health & perf
- [x] TypeScript + ESLint + production build all clean
- [x] Public images optimized: **71 MB → 10 MB** (–87 %)
- [x] `npm run optimize:images` script for future re-runs

---

## 🔥 P0 — Launch blockers (do next)

### Production data wiring
- [x] **Run migration `0006_utility_contacts.sql`** on the live Supabase ✅ done 2026-05-20
- [ ] Seed real regions (start with 1–3 destinations the team uses)
- [ ] Run a real toolbox scan on each seeded region; spot-check the pins
- [ ] Set `CRON_SECRET` env var on Vercel; verify cron hits succeed
- [ ] Confirm Supabase env vars on Vercel (`URL`, `ANON_KEY`, `SERVICE_ROLE`)

### Auth that actually signs people in
- [x] End-to-end signup → profile-created flow (RLS verified) ✅ 2026-05-20
- [x] Migration 0007 (robust profile-creation trigger) run on live ✅ 2026-05-20
- [ ] Email-confirm + magic-link or password reset flow
- [x] Sign-out from `/settings` (server-action button) ✅ 2026-05-20
- [x] Session refresh works across server / client / middleware ✅ (was already wired)
- [x] Admin Console entry in /settings gated to admins ✅ 2026-05-20
- [x] /settings now in protected routes ✅ 2026-05-20

### Profiles (replace mock members for self)
- [ ] `/profile/edit` writes display_name, bio, status, country
- [ ] Avatar upload to Supabase Storage
- [ ] `/u/[username]` reads real profile when one exists (fallback to mock — already wired)

### Other-user profile redesign
- [ ] Marked-up screenshot from you → iterate on the restored layout
- [ ] Decide which sections survive: IG showcase, IG feed, notes, countries

---

## 🟧 P1 — Beta-quality features

### Group chat (the heart of the app)
- [x] Migration `0008_chat.sql`: chat_groups + chat_group_members + chat_messages + RLS + realtime + seed ✅ 2026-05-20
- [x] Supabase Realtime subscription in `chat-thread.tsx` ✅ 2026-05-20
- [x] Join / leave group server actions + UI CTA ✅ 2026-05-20
- [ ] Members page reads real group_members (still on mock roster)
- [ ] Typing indicator + read receipts (optional v1.1)

### Traveler notes (trust signals)
- [ ] Migration: `traveler_notes` table + RLS (one note per pair)
- [ ] Write-a-note flow from another user's profile
- [ ] Show on `/u/[username]` and `/notes`

### Vibe map → real data
- [ ] Migration: `vibe_spots` table (or derive from utilities + events)
- [ ] Replace `lib/travejor/vibe.ts` mock with Supabase fetch
- [ ] Compute "vibe score" from check-ins + recent activity

### Events
- [ ] Migration: `events` table (host, location, time, capacity, rsvp)
- [ ] Replace mock events; wire up RSVP button
- [ ] Surface on map + `/events` page

### Push notifications
- [ ] Web Push subscription on install
- [ ] Server: send on new chat message, friend request, event reminder
- [ ] Notification preferences in `/settings`

---

## 🟨 P2 — Polish & quality

### Instagram integration (real, not mock)
- [ ] Decide: oEmbed-only (no API key) vs. Instagram Basic Display API
- [ ] Replace `members.ts` `instagram` mock with stored identity per profile
- [ ] Verify badge needs a real claim flow (post-with-token-in-bio)

### Susen AI
- [ ] Wire `lib/susen/engine.ts` to a real Anthropic Claude call
- [ ] Pull user context (location, joined groups, prefs) into the prompt
- [ ] Streaming responses

### Accessibility & i18n
- [ ] Keyboard navigation pass (focus rings, skip links)
- [ ] Screen-reader audit on the radial hub, bottom nav, map markers
- [ ] aria-live for chat messages
- [ ] Pluck strings into a dictionary; pilot one second language

### Performance & resilience
- [ ] Lighthouse pass on mobile (target ≥ 90 perf, 100 a11y)
- [ ] Real-device test (iPhone 15, mid-tier Android)
- [ ] Offline page for chat / map fallbacks
- [ ] Map marker virtualization if a region returns 500+ utilities

### Observability
- [ ] Sentry (errors) + Plausible/Umami (privacy-friendly analytics)
- [ ] Server logs structured (request id, user id, route)
- [ ] Cron run history visible in admin

### Admin polish
- [ ] Surface contact channels on traveler-facing toolbox cards (tap → open IG / WhatsApp)
- [ ] Bulk edit utilities (multi-select → set rating / status)
- [ ] Region health dashboard (last scan, pin count by category, stale data)

---

## 🌱 P3 — Post-launch / future

- [ ] iOS / Android wrappers (Capacitor) for App Store presence
- [ ] Stripe — premium "Top Pick" badges for partners
- [ ] Booking handoff (YumYumPo / Booking.com affiliate links)
- [ ] Multi-region search ("show me Bali AND Lombok")
- [ ] Friend graph + "travelers you know nearby"
- [ ] Story-style 24h photo posts in feed
- [ ] Translation of chat messages on the fly
- [ ] Backpack-rating ML tuning from community signal

---

## Working principles

- **Structural / layout / spacing changes** apply across all four themes.
- **Colors / specific icon swaps** are scoped to a single theme unless called out.
- Pin server secrets behind `lib/env.ts`; never read `process.env` outside it.
- Features must not import from each other — share via `lib/`.
- Every schema change is a numbered migration in `supabase/migrations/`.
- Run `npm run optimize:images` whenever you drop new PNGs into `public/`.

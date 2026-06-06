# Tamagotchi-Style Travel Pet System — Build Contract

> **Source:** distilled from the Wondavu Pet system implementation
> ([supabase/migrations/0034_pet_core.sql](supabase/migrations/0034_pet_core.sql),
> [src/features/pet/](src/features/pet/), [src/lib/pet.ts](src/lib/pet.ts)).
>
> **Use this file** as a self-contained brief to rebuild the system in
> another project. Save as `PET_SYSTEM_CONTRACT.md` at the root of the
> target repo, or paste the entire body as a one-shot prompt to a
> fresh Claude Code session in that project.

---

You are building a virtual pet / travel companion subsystem inside an
existing app. The user will reward the pet by completing real actions
in the broader app (joining a chat, visiting a place, writing a note,
daily login, etc.). The pet has stats that decay over time, a currency
the user earns and can spend in a shop, and stage progression as the
pet matures.

This brief is the contract — schema, module shape, public API, locked
design decisions, integration seams, traps. Read all of it before
writing code. Every locked decision below was paid for by avoiding a
trap I either hit or steered around in the reference implementation;
ignoring one without an explicit reason will cost the same time again.

If your stack matches the reference (Next.js App Router + Supabase),
the code shapes are verbatim-usable. If your stack differs (Express +
Postgres, Django + Postgres, Phoenix + Postgres, etc.), the
**architectural patterns** below survive the swap; you just translate
the route-handler / server-action / RLS idioms into your stack's
equivalents.

---

## 0. Locked design decisions (do not relitigate)

These were paid for. Override one only with a stated reason.

1. **One pet per user.** Primary key on the pet table = user_id. No
   secondary pet "slots." Keeps the data model and UI simple; no
   cross-pet conflict resolution.

2. **No permadeath.** When stats stay below a floor for ≥48 hours, the
   pet's status flips to `dormant` instead of dying. The user can
   wake it back up by interacting. Permadeath felt punitive for an
   app users only open intermittently while travelling.

3. **Earned-only currency.** No in-app purchase, no buy-coins surface,
   no spend-to-skip mechanics. Rewards come exclusively from real
   in-app actions. Avoids gambling-tier psychology and removes
   payment plumbing from MVP scope.

4. **Decay is lazy (computed on read).** No cron jobs. When code reads
   the pet, it diffs `last_tick_at` against now and applies the
   accumulated decay before returning. Simpler ops; trade is that a
   pet only "feels" decayed when the user opens its surface.

5. **Reward idempotency via composite uniqueness.** The ledger table
   has `UNIQUE (user_id, reason, source_kind, source_id)`. Means
   calling the reward function twice for the same source row is a
   silent no-op. Hooks anywhere in the app are safe to retry.

6. **Feature-flag gated from day one.** A boolean env var
   (`PET_ENABLED` or similar) makes the reward function a no-op when
   off. Lets you wire reward hooks throughout the app immediately
   without exposing an incomplete pet UI to users.

7. **Reward rules are DATA, not code.** A `reward_rule` table holds
   the per-action XP / token / stat-bump values. Tuning balance =
   one SQL update, no deploy. Hardcoded values means designers ping
   engineers for every tweak.

8. **Pet is publicly readable.** The pet row visibility policy is
   "anyone may SELECT," so the pet can render on the user's public
   profile page. Update / delete still owner-only.

9. **Stage list is open for growth, species list is closed.** The
   schema's CHECK constraints list ALL stages (`egg`, `hatchling`,
   `pup`, `explorer`, `wayfarer`, `elder`) up front even though MVP
   only ships `egg` and `hatchling` transitions. Species list starts
   with just one — easier to add a CHECK constraint value later
   than to deal with a species_id FK proliferation.

10. **Decay rates and stat list live in code constants, not the DB.**
    Different from reward rules — decay rates change rarely and are
    tied to game-feel, which engineers tune via A/B tests, not
    designers via SQL.

---

## 1. Database schema

Six tables. Idempotent migration shape (create-if-not-exists, drop-
if-exists policies, insert-on-conflict-update for seeds). Verbatim
Postgres-flavoured SQL below; translate the `now()`, `jsonb`, and
trigger-function idioms into your DB if not Postgres.

### 1.1 pet — one row per user

```sql
create table if not exists public.pet (
  user_id        uuid primary key references public.profiles (id) on delete cascade,
  species        text not null default 'wanderling'
                   check (species in ('wanderling')),  -- expand cautiously
  name           text not null default 'Egg'
                   check (char_length(name) between 1 and 24),
  stage          text not null default 'egg'
                   check (stage in ('egg','hatchling','pup','explorer','wayfarer','elder')),
  branch         text
                   check (branch is null
                          or branch in ('explorer','social','foodie','homebody','adventurer')),
  xp             integer not null default 0 check (xp >= 0),
  -- Stats: 0–100 with sensible defaults
  hunger         smallint not null default 80 check (hunger between 0 and 100),
  happiness      smallint not null default 80 check (happiness between 0 and 100),
  energy         smallint not null default 80 check (energy between 0 and 100),
  cleanliness    smallint not null default 80 check (cleanliness between 0 and 100),
  wanderlust     smallint not null default 50 check (wanderlust between 0 and 100),
  bond           smallint not null default 0 check (bond between 0 and 100),
  status         text not null default 'healthy'
                   check (status in ('healthy','sick','dormant')),
  wc_balance     integer not null default 0 check (wc_balance >= 0),
  last_tick_at   timestamptz not null default now(),
  hatched_at     timestamptz,
  created_at     timestamptz not null default now()
);
```

### 1.2 pet_item — shop catalog

```sql
create table if not exists public.pet_item (
  slug           text primary key,
  category       text not null
                   check (category in ('food','toy','hat','body','background','boost','special')),
  name           text not null,
  description    text,
  price_wc       integer not null check (price_wc >= 0),
  effect         jsonb not null default '{}'::jsonb,  -- e.g. {"happiness":+10}
  region         text,                                 -- optional regional item
  sprite         text not null,                        -- /assets/pet/items/X.svg
  unlock_stage   text,                                 -- gate by pet stage
  active         boolean not null default true,
  created_at     timestamptz not null default now()
);
```

### 1.3 pet_inventory — owned items

```sql
create table if not exists public.pet_inventory (
  user_id        uuid not null references public.profiles (id) on delete cascade,
  item_slug      text not null references public.pet_item (slug) on delete restrict,
  qty            integer not null default 0 check (qty >= 0),
  equipped       boolean not null default false,
  acquired_at    timestamptz not null default now(),
  primary key (user_id, item_slug)
);
```

### 1.4 pet_token_ledger — append-only Wondacoin movements

```sql
create table if not exists public.pet_token_ledger (
  id             bigserial primary key,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  delta          integer not null,                      -- +earn / −spend
  balance_after  integer not null check (balance_after >= 0),
  reason         text not null,                          -- e.g. 'visit_new_place'
  source_kind    text,                                   -- e.g. 'stay'
  source_id      text,                                   -- e.g. stay-uuid
  meta           jsonb not null default '{}'::jsonb,
  created_at     timestamptz not null default now(),
  -- THIS is the idempotency guard. Calling the reward function twice
  -- for the same (user, reason, source_kind, source_id) is a silent
  -- no-op. Don't drop this; reward hooks WILL fire twice in real
  -- traffic and you need them to be safe.
  unique (user_id, reason, source_kind, source_id)
);

create index if not exists pet_token_ledger_user_time_idx
  on public.pet_token_ledger (user_id, created_at desc);
```

### 1.5 pet_reward_rule — tunable rule book

```sql
create table if not exists public.pet_reward_rule (
  action_kind    text primary key,
  xp             integer not null default 0,
  tokens         integer not null default 0,
  stat_bumps     jsonb not null default '{}'::jsonb,  -- {"happiness":+10,"bond":+5}
  cap_per_day    integer,                              -- null = no cap
  one_time       boolean not null default false,       -- one-time per source
  active         boolean not null default true,
  updated_at     timestamptz not null default now()
);
```

Seed values (insert-on-conflict-update so re-running the migration is
safe; tune these for game feel):

```sql
insert into public.pet_reward_rule (action_kind, xp, tokens, stat_bumps, cap_per_day, one_time)
values
  ('visit_new_place', 15, 10, '{"wanderlust":15,"happiness":5}'::jsonb, null, true),
  ('join_group',      10, 15, '{"happiness":10}'::jsonb,                null, true),
  ('mutual_note',     20, 20, '{"happiness":15,"bond":5}'::jsonb,       null, true),
  ('write_note',      10, 10, '{"bond":5}'::jsonb,                      null, true),
  ('daily_login',      2,  5, '{"bond":1}'::jsonb,                      1,    false)
on conflict (action_kind) do update set
  xp = excluded.xp,
  tokens = excluded.tokens,
  stat_bumps = excluded.stat_bumps,
  cap_per_day = excluded.cap_per_day,
  one_time = excluded.one_time,
  active = true,
  updated_at = now();
```

### 1.6 pet_event — audit log

```sql
create table if not exists public.pet_event (
  id             bigserial primary key,
  user_id        uuid not null references public.profiles (id) on delete cascade,
  kind           text not null,                          -- 'stage_change','reward','care_feed',…
  meta           jsonb not null default '{}'::jsonb,
  at             timestamptz not null default now()
);

create index if not exists pet_event_user_time_idx
  on public.pet_event (user_id, at desc);
```

### 1.7 Row-Level Security

If your DB has RLS (Supabase / Postgres RLS), here's the matrix.
If not (Express on Postgres without RLS), enforce these as
authorisation checks in your server code instead.

| Table              | SELECT                     | INSERT                  | UPDATE                  | DELETE                  |
|--------------------|----------------------------|-------------------------|-------------------------|-------------------------|
| pet                | public (anyone)            | trigger-only            | owner                   | trigger-only            |
| pet_item           | public                     | admin only              | admin only              | admin only              |
| pet_inventory      | owner                      | owner                   | owner                   | owner                   |
| pet_token_ledger   | owner                      | owner                   | none                    | none                    |
| pet_reward_rule    | public (for displaying)    | admin only              | admin only              | admin only              |
| pet_event          | owner                      | owner                   | none                    | none                    |

### 1.8 Sign-up trigger

Extend your existing handle_new_user (or equivalent post-signup hook)
to insert a fresh pet row on every new account. Wrap the insert in a
try/catch — pet creation failing must NEVER block signup itself.

For Postgres + Supabase, the trigger function shape is well-defined.
For other stacks, do this in your post-signup application code.

### 1.9 Back-fill

Insert pet rows for every existing user so `/pet` doesn't 404 for
current accounts.

```sql
insert into public.pet (user_id)
select p.id from public.profiles p
on conflict (user_id) do nothing;
```

---

## 2. Code module structure

Single feature module, internal sub-folders. The DEPENDENCY DIRECTION
matters — other features should NOT import directly from
`features/pet/`. Create a thin re-export module at `lib/pet.ts` (or
your stack's equivalent of a cross-feature seam) so other features
call through that.

```
features/pet/
  index.ts                # Public barrel — only what's reusable
  types.ts                # Feature-local types + constants
  api/
    award-reward.ts       # The single most important function — see §3
    care.ts               # feed / play / sleep / bathe actions
    get-pet.ts            # getMyPet / getPetForUser (applies decay on read)
    rename.ts             # User renames the pet
  components/
    pet-page.tsx          # The /pet route's main UI
    pet-badge.tsx         # Embeddable sprite for app shell + profile
    stat-bar.tsx          # Reusable stat-progress component
    hatch-modal.tsx       # First-hatch flow (Egg → Hatchling)
  hooks/
    use-pet.ts            # React hook wrapping fetch + realtime
  lib/
    decay.ts              # tickPet(petRow): apply hours-of-decay
    stages.ts             # XP thresholds + stage transitions
    sprites.ts            # Maps (stage, status) → sprite path
    time.ts               # todayUtcKey() + tick math helpers

lib/pet.ts                # Cross-feature seam — see §3.1
```

The `lib/` sub-folder inside `features/pet/` holds internal utilities
(decay, stage math). The TOP-LEVEL `lib/pet.ts` is the seam other
features import through. Keeping these separate enforces the rule
"features cannot import from features."

---

## 3. Public API contract

### 3.1 The seam (`lib/pet.ts`)

```typescript
// lib/pet.ts — the only thing OTHER features should import.
export { awardPetReward } from "@/features/pet/api/award-reward";
export { getMyPet, getPetForUser } from "@/features/pet/api/get-pet";
export { todayUtcKey } from "@/features/pet/lib/time";
export type { AwardResult, RewardKind } from "@/features/pet/types";
```

### 3.2 `awardPetReward(userId, actionKind, sourceKind, sourceId)`

The single most important function in the system. Other features call
this when the user completes a rewarded action.

```typescript
async function awardPetReward(
  userId: string,
  actionKind: RewardKind,
  sourceKind: string | null,
  sourceId: string | null,
): Promise<AwardResult>;

type RewardKind =
  | "visit_new_place"
  | "join_group"
  | "mutual_note"
  | "write_note"
  | "daily_login";

type AwardResult = {
  awarded: boolean;
  reason?: string;                                              // 'pet disabled' / 'already awarded' / etc.
  delta_wc?: number;
  delta_xp?: number;
  stage_changed?: { from: PetStage; to: PetStage };
};
```

**Contract guarantees:**

- **Idempotent.** Calling with the same `(userId, actionKind, sourceKind, sourceId)` twice is a silent no-op — the second call returns `{ awarded: false, reason: 'duplicate' }`.
- **Feature-flag-aware.** When `PET_ENABLED` is false, returns
  `{ awarded: false, reason: 'pet disabled' }` without touching DB.
- **Non-throwing.** Reward fanout failures must NEVER bubble up to
  the caller. Reward is a side effect of the user's primary action
  (sending a chat, writing a note); a pet bug must not break the
  primary action.
- **Auth-context independent.** Caller passes a user_id, function
  trusts it. Caller is responsible for resolving the auth user before
  calling.

**Inside the function (algorithm):**

1. Check feature flag → return early if off.
2. Look up rule for `actionKind` in `pet_reward_rule` → return early
   if rule inactive.
3. Check `cap_per_day` against today's ledger entries for this user +
   action — return early if cap hit.
4. Read the pet, apply decay (`tickPet()`), capture pre-update state.
5. Apply XP + token + stat bumps.
6. Compute new stage from new XP — if changed, record `stage_changed`.
7. UPDATE pet row + INSERT pet_token_ledger row (with the unique key)
   + INSERT pet_event row. Race-tolerant: the ledger's UNIQUE
   constraint catches duplicate inserts even if you don't transact.
8. Return AwardResult.

### 3.3 `getMyPet()` / `getPetForUser(userId)`

Returns the user's pet, applying lazy decay on read. The act of
reading the pet writes its updated stats back (it's "ticking" the
pet).

### 3.4 Care actions (`feed`, `play`, `sleep`, `bathe`)

Each is a server action that:
1. Reads the pet (applies decay).
2. Bumps the matching stat by a fixed amount.
3. Possibly consumes an inventory item (food specifically).
4. Records a `pet_event` row.

---

## 4. Stage progression + decay

### 4.1 Stage thresholds (in `lib/stages.ts`)

```
egg       0 XP — until user hatches manually
hatchling 0+ XP after hatch
pup       100 XP
explorer  300 XP
wayfarer  700 XP
elder     1500 XP
```

The transition from `egg` to `hatchling` is user-initiated (the hatch
modal). Everything past that is XP-threshold based.

### 4.2 Decay rates per hour (in `lib/decay.ts`)

```typescript
const DECAY_PER_HOUR = {
  hunger: 2,
  happiness: 1,
  energy: 1,
  cleanliness: 0.5,
  wanderlust: 0.125,  // ≈ 3/day
};
// bond NEVER decays — it's the "trust" stat.
```

### 4.3 The tick function

```typescript
function tickPet(pet: PetRow): PetRow {
  const hours = (Date.now() - new Date(pet.last_tick_at).getTime()) / 3_600_000;
  if (hours < 0.05) return pet;  // <3min, skip
  // Apply each stat's decay rate, clamp to [0, 100]
  // Update last_tick_at
  // Return the new shape — caller WRITES this back to the DB
}
```

### 4.4 Sick / dormant status logic

- If any non-bond stat is at 0 → mark as `sick`.
- If pet has been `sick` for 48 consecutive hours → flip to `dormant`.
- Interaction by user (feed/play/bathe) takes pet back to `healthy`.

---

## 5. Reward trigger integration (the actual work)

The schema and module are scaffolding. The trigger wiring is where
the system comes alive. For each `RewardKind`, identify the call
site in the broader app and fire `awardPetReward()` after the
primary action succeeds.

| RewardKind        | Where to fire from                          | sourceKind / sourceId   |
|-------------------|---------------------------------------------|--------------------------|
| `write_note`      | Note-creation action, on insert success     | 'note' / note_id         |
| `mutual_note`     | Note-creation, if the OTHER user also has a note on YOU | 'mutual_note' / pair_id |
| `visit_new_place` | Check-in action / first stay-page-view per place per user | 'place' / place_id |
| `join_group`      | Group-join action, on membership insert success | 'group' / group_id   |
| `daily_login`     | Session-start middleware, once per UTC day  | 'day' / todayUtcKey()    |

**Critical pattern**: each call site fires reward AFTER the primary
action's DB write succeeds, fire-and-forget (`void awardPetReward(...)`).

---

## 6. Beyond MVP — what to leave hooks for

1. **Notifications.** Stage changes, sick warnings, dormant alerts.
   Wire these into your notification system by creating a new
   notification type and firing it from inside `awardPetReward()` when
   `stage_changed` returns non-null, and from a daily cron when status
   flips to `sick` / `dormant`.
2. **Shop.** Schema is ready; seed `pet_item` rows + build the shop UI.
3. **Sprites + animations.** Each (stage, status) combo needs a sprite.
   `sprites.ts` maps these to file paths.
4. **Public profile embedding.** The `PetBadge` component embeds in
   `/u/[username]` (or your equivalent). Pet is public-read.
5. **Branch selection.** After `hatchling`, the pet gains a `branch`
   (explorer / social / foodie / homebody / adventurer) computed from
   the dominant reward category. Logic lives in `stages.ts`.

---

## 7. Pitfalls / known traps

1. **Don't make `awardPetReward` transactional.** Race conditions on
   `balance_after` produce slightly stale ledger rows; the truth lives
   in `pet.wc_balance`. The ledger is for audit, not source-of-truth.
   Transactions add lock contention without proportional benefit.
2. **Don't drop the ledger uniqueness constraint.** Reward hooks WILL
   fire twice in production (page reloads, network retries, double-
   clicks). The unique key is the only thing making that safe.
3. **Don't compute decay eagerly via cron.** A million users × 12
   decay-tick cron jobs/day = a million unnecessary writes. Lazy
   decay on read is the right cost shape.
4. **Don't expose the feature flag as a user setting.** It's an
   ops kill-switch, not a preference. Users either see pet or not,
   set globally.
5. **Don't let pet-system bugs surface as primary-action errors.**
   Every call site of `awardPetReward` should be `void`ed (fire-and-
   forget). A pet bug should never break sending a chat message.
6. **Don't hardcode rewards.** Designers WILL want to retune
   balance once real users are interacting. Keep it in
   `pet_reward_rule` from day one.

---

## 8. Implementation order

Do not try to ship all this at once. Order:

1. **Schema migration** — all six tables, RLS, seed reward rules,
   sign-up trigger extension. Run against staging, smoke-test that
   sign-up creates a pet row.
2. **`getMyPet` + tick decay** — read path with lazy decay. Verify
   the math by reading a pet after 1h, 6h, 24h sim-time.
3. **`awardPetReward`** — idempotent reward fanout. Test by calling
   twice with the same source — second call should no-op.
4. **`/pet` page + sprites** — render whatever stats / stage the
   pet has. Behind the feature flag (default off).
5. **Care actions** — feed / play / sleep / bathe. Each bumps a stat.
6. **Wire first reward trigger** — pick the easiest call site in
   your app (probably a note-write or a profile-update) and verify
   the pet reflects the reward.
7. **Hatch flow** — one-time first-launch modal letting the user
   rename and hatch the egg.
8. **Wire remaining reward triggers** — the other 4 RewardKinds.
9. **Stage progression beyond hatchling** — XP thresholds + stage
   change events.
10. **Public profile embed** — `PetBadge` on `/u/[username]`.
11. **Notifications integration** — pet events → user notifications.
12. **Shop** — seed `pet_item` rows + the shop UI.

---

## 9. Self-test recipe

After each implementation step, run this mental checklist before moving
on:

1. **Schema sanity** — can you sign up a fresh account and see exactly
   one `pet` row + zero `pet_token_ledger` rows for the new user?
2. **Decay correctness** — set `last_tick_at` to 24 hours ago in the
   DB, read the pet via your code path, verify hunger dropped by 48
   (rate 2/hr × 24).
3. **Idempotency** — call `awardPetReward(u, 'write_note', 'note', X)`
   twice. Confirm one ledger row, one delta added to balance.
4. **Cap enforcement** — for `daily_login` (cap 1/day), call twice
   in the same UTC day. Confirm second call returns `awarded: false`.
5. **Stage transition** — manually set XP to threshold − 1, fire a
   reward to push it over, confirm `stage_changed` in the return value
   AND the pet row's `stage` field updated.
6. **Sick state** — set hunger to 0 manually, read the pet, confirm
   `status` flipped to `sick`. Then feed it; confirm back to `healthy`.
7. **Public read** — `SELECT * FROM pet WHERE user_id = '<some-other-user>'`
   as an anonymous role. Confirm you see the row.
8. **Owner write only** — try UPDATE as the wrong user; confirm RLS
   rejects (or your app-layer auth check rejects).
9. **Feature flag off** — set `PET_ENABLED=false`, call
   `awardPetReward`. Confirm it returns `{ awarded: false, reason: 'pet disabled' }`
   without touching the DB.

If any of these fail, fix before moving to the next implementation
step. They are cheap to test now and expensive to debug after several
features build on the broken foundation.

---

## 10. Translating to your stack

The reference implementation is Next.js App Router + Supabase. Here
are the rough mappings if you're on something else:

| Reference                       | Generic equivalent                                |
|---------------------------------|--------------------------------------------------|
| Supabase `RLS`                  | Server-side auth checks in route handlers         |
| Supabase trigger functions      | Post-signup callback in your auth system          |
| Next.js Server Action           | POST endpoint in Express / FastAPI / Phoenix      |
| Next.js Client Component        | React (CRA / Vite / Remix) / Vue / Svelte component |
| `@supabase/ssr` client          | Your DB client of choice                          |
| `force-dynamic` route segment   | Equivalent caching directive                      |

The algorithm + schema + idempotency rules + decay model + integration
seams are stack-agnostic. The exact code shapes adapt.

End of brief.

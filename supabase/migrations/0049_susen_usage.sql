-- Migration 0049 — Susen per-response token telemetry.
--
-- Goal: real platform-wide cost analytics. Every Susen reply already comes
-- back from DeepSeek with a `usage` block (prompt / completion / total tokens
-- and prompt_cache_hit_tokens). We persist one row per response so /admin/susen
-- can show actual spend — total tokens, avg per reply, cache-hit rate, and an
-- estimated dollar cost — instead of a prompt-size estimate.
--
-- Design notes:
--   - Append-only telemetry, written server-side in /api/susen/respond as a
--     fire-and-forget insert AFTER the reply is finalized. It never feeds back
--     into the prompt and never blocks or changes the reply.
--   - PII-light on purpose: no email / user id. Just region, source, an
--     is_admin flag, the model, and the token counts. Enough for cost rollups,
--     nothing that identifies a traveller.
--   - Separate from susen_dev_notes (the admin tuning log) so telemetry and
--     tuning stay decoupled, and from susen_messages so the hot chat table
--     isn't touched and we still capture logged-out replies (whose messages
--     aren't persisted).

create table if not exists public.susen_usage (
  id                uuid primary key default gen_random_uuid(),
  created_at        timestamptz not null default now(),
  region_id         text,
  source            text,            -- e.g. 'app'
  is_admin          boolean not null default false,
  model             text,            -- e.g. 'deepseek-chat'
  prompt_tokens     integer,
  completion_tokens integer,
  total_tokens      integer,
  cache_hit_tokens  integer          -- DeepSeek prompt_cache_hit_tokens
);

-- Lock it down: only the service role (used by the server route) reads or
-- writes this. RLS on with no policy = no anon / authenticated access at all.
alter table public.susen_usage enable row level security;
grant select, insert on public.susen_usage to service_role;

-- Window queries for the admin panel are all "last N days", newest first.
create index if not exists susen_usage_created_idx
  on public.susen_usage (created_at desc);

-- Pre-aggregated daily rollup so the admin panel reads a handful of rows
-- (days × regions) instead of scanning every response. The panel sums these.
create or replace view public.susen_usage_daily as
  select
    date_trunc('day', created_at) as day,
    region_id,
    count(*)                      as responses,
    sum(total_tokens)             as total_tokens,
    sum(prompt_tokens)            as prompt_tokens,
    sum(completion_tokens)        as completion_tokens,
    sum(cache_hit_tokens)         as cache_hit_tokens
  from public.susen_usage
  group by 1, 2;

grant select on public.susen_usage_daily to service_role;

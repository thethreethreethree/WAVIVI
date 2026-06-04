-- WAVIVI — Phase 12: per-user application rate limiting
--
-- Supabase already rate-limits its own auth endpoints (sign-up, sign-in,
-- password reset) at the project level. This table covers APPLICATION
-- endpoints — Susen DeepSeek calls + chat sends — that have no built-in
-- ceiling. Without it, one bot can burn the DeepSeek budget in an hour
-- or flood a group chat past readability.
--
-- Design: sliding-bucket counters keyed by (user_id, key, minute_bucket).
-- Each protected action UPSERTS the current minute's row, incrementing
-- the count. The check sums counts across the last N buckets to
-- enforce limits over a sliding window. One row per user-per-key-per-
-- minute keeps cardinality bounded.

create table if not exists public.rate_limit_counters (
  user_id      uuid not null,
  -- Short stable label of the protected action (e.g. 'susen.respond',
  -- 'chat.send'). Anything caller-defined; never user-supplied.
  key          text not null,
  bucket_start timestamptz not null,
  count        integer not null default 0,
  primary key (user_id, key, bucket_start)
);

-- Window-scan query: "sum(count) where user_id=? and key=? and
-- bucket_start > cutoff." This index is the access pattern.
create index if not exists rate_limit_counters_window_idx
  on public.rate_limit_counters (user_id, key, bucket_start desc);

-- Lock down — only the service-role server uses this table.
-- Travelers can't read/write it directly via the anon/authenticated key.
alter table public.rate_limit_counters enable row level security;
grant select, insert, update, delete
  on public.rate_limit_counters to service_role;

-- Atomic "consume a slot" — increments by 1 inside a single statement
-- so two concurrent calls can't both see (cap - 1) and both pass. Returns
-- the new total inside the sliding window.
create or replace function public.rate_limit_consume(
  p_user_id      uuid,
  p_key          text,
  p_window_secs  integer
) returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bucket  timestamptz := date_trunc('minute', now());
  v_cutoff  timestamptz := now() - make_interval(secs => p_window_secs);
  v_total   integer;
begin
  insert into public.rate_limit_counters (user_id, key, bucket_start, count)
    values (p_user_id, p_key, v_bucket, 1)
    on conflict (user_id, key, bucket_start)
    do update set count = rate_limit_counters.count + 1;

  select coalesce(sum(count), 0)
    into v_total
    from public.rate_limit_counters
   where user_id = p_user_id
     and key = p_key
     and bucket_start >= v_cutoff;

  return v_total;
end;
$$;

grant execute on function public.rate_limit_consume(uuid, text, integer)
  to service_role;

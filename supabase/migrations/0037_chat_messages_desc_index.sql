-- WAVIVI — chat_messages: composite DESC index for the latest-N query.
--
-- The original `chat_messages_group_time_idx` (migration 0008) is
-- `(group_id, created_at)` ascending. Our chat-thread query pattern is:
--   select * from chat_messages
--   where group_id = $1
--   order by created_at desc
--   limit 50
-- Postgres can reverse-scan the ASC index, but that's noticeably
-- slower at scale than a native DESC index — especially with the
-- realtime publication adding write contention on the heap.
--
-- This migration adds a `(group_id, created_at DESC)` index so the
-- chat-list query is an index-only forward scan with no in-memory sort.

create index concurrently if not exists chat_messages_group_time_desc_idx
  on public.chat_messages (group_id, created_at desc);

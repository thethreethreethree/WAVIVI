-- WAVIVI — reply-to (WhatsApp-style message quoting) for both chat surfaces.
--
-- Adds three columns to chat_messages and susen_messages:
--   reply_to_id          self-FK on the same table (on delete set null —
--                        keeps the quote bar visible as "this message was
--                        deleted" rather than orphaning the reply).
--   reply_to_snippet     denormalised first ~140 chars of the original
--                        body at the moment of reply. WhatsApp shows the
--                        quote as it was when sent, not as it is now; this
--                        also makes realtime payloads render with no join.
--   reply_to_author_name denormalised author label at the moment of reply
--                        (group: profile display_name; Susen: "You" / "Susen").
--
-- A composite index speeds up the "find all replies to X" query path we'll
-- want later (e.g. for thread highlights). For the bubble render we just
-- read the denormalised columns inline — no join needed.

alter table public.chat_messages
  add column if not exists reply_to_id uuid
    references public.chat_messages(id) on delete set null,
  add column if not exists reply_to_snippet text,
  add column if not exists reply_to_author_name text;

create index if not exists chat_messages_reply_to_id_idx
  on public.chat_messages (reply_to_id)
  where reply_to_id is not null;

alter table public.susen_messages
  add column if not exists reply_to_id uuid
    references public.susen_messages(id) on delete set null,
  add column if not exists reply_to_snippet text,
  add column if not exists reply_to_author_name text;

create index if not exists susen_messages_reply_to_id_idx
  on public.susen_messages (reply_to_id)
  where reply_to_id is not null;

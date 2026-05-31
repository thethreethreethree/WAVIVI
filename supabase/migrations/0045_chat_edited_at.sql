-- WAVIVI — message edit support across both chat surfaces.
--
-- Adds an `edited_at` timestamp to chat_messages and susen_messages. The
-- UI labels a bubble "(edited)" when this is non-null. RLS on the table
-- gates writes; the server action additionally enforces:
--   * caller owns the row
--   * row carries a text body (no editing image- or location-only bubbles)
--   * created_at is within the last 15 minutes (WhatsApp's window)

alter table public.chat_messages
  add column if not exists edited_at timestamptz;

alter table public.susen_messages
  add column if not exists edited_at timestamptz;

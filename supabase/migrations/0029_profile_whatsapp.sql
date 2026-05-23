-- Wondavu — WhatsApp on profiles, for the Meet Travelers search bar.
--
-- Travelers can opt in to letting others find them by WhatsApp number — same
-- trust-building rationale as the verified Instagram handle. Stored as the
-- user-entered string; search matches a digits-only normalisation so "+1
-- 555-0100" and "5550100" both find the same person.

alter table public.profiles
  add column if not exists whatsapp_number text
    check (whatsapp_number is null or char_length(whatsapp_number) between 5 and 32);

-- Partial index — fast lookup of the small subset who set a number.
create index if not exists profiles_whatsapp_idx
  on public.profiles (whatsapp_number) where whatsapp_number is not null;

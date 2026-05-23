-- Wondavu — digits-only WhatsApp column for robust user search.
--
-- whatsapp_number is the user-entered string (may include +, spaces, dashes,
-- parentheses). Search-by-phone needs a normalised digits-only form so
-- "+1 (555) 010-0100" and "5550100100" both find the same person.
-- Generated column keeps it always in sync with the source value at zero
-- maintenance cost.

alter table public.profiles
  add column if not exists whatsapp_digits text generated always as
    (regexp_replace(coalesce(whatsapp_number, ''), '[^0-9]', '', 'g'))
    stored;

create index if not exists profiles_whatsapp_digits_idx
  on public.profiles (whatsapp_digits) where whatsapp_digits <> '';

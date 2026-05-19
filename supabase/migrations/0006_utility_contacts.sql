-- WAVIVI / Travejor — Toolbox utility contact channels
-- Adds social / contact columns so admins can record and filter utilities
-- by the channels they have (Instagram, Facebook, WhatsApp, email).

alter table public.traveler_utilities
  add column if not exists instagram text,
  add column if not exists facebook text,
  add column if not exists whatsapp text,
  add column if not exists email text;

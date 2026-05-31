-- WAVIVI — chat attachments (images + location) for both chat surfaces.
--
-- Two new attachment shapes per message row:
--   IMAGES   — kind='image' plus url + width + height. Files live in a
--              new `chat-photos` Storage bucket, downscaled server-side
--              to WebP / 1280px / quality 78 (typical phone shot lands at
--              80–180 KB). Path: <group_id_or_user_id>/<msg_id>.webp.
--   LOCATION — lat + lng + optional accuracy_m + optional label. No map
--              tiles are stored; the bubble renders a Leaflet preview.
--
-- The text body becomes nullable: an image- or location-only message is
-- valid. A CHECK ensures every row carries SOMETHING (body OR an image OR
-- a location pin) — keeps the bubble from rendering as an empty box.

-- ── chat_messages ─────────────────────────────────────────────────────

alter table public.chat_messages
  alter column body drop not null;

alter table public.chat_messages
  drop constraint if exists chat_messages_body_check;

alter table public.chat_messages
  add column if not exists attachment_kind text
    check (attachment_kind in ('image')),
  add column if not exists attachment_url text,
  add column if not exists attachment_width int,
  add column if not exists attachment_height int,
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision,
  add column if not exists location_accuracy_m double precision,
  add column if not exists location_label text;

alter table public.chat_messages
  drop constraint if exists chat_messages_has_content_check;
alter table public.chat_messages
  add constraint chat_messages_has_content_check check (
    (body is not null and char_length(body) between 1 and 2000)
    or attachment_url is not null
    or location_lat is not null
  );

-- ── susen_messages ────────────────────────────────────────────────────

alter table public.susen_messages
  alter column text drop not null;

alter table public.susen_messages
  add column if not exists attachment_kind text
    check (attachment_kind in ('image')),
  add column if not exists attachment_url text,
  add column if not exists attachment_width int,
  add column if not exists attachment_height int,
  add column if not exists location_lat double precision,
  add column if not exists location_lng double precision,
  add column if not exists location_accuracy_m double precision,
  add column if not exists location_label text;

alter table public.susen_messages
  drop constraint if exists susen_messages_has_content_check;
alter table public.susen_messages
  add constraint susen_messages_has_content_check check (
    (text is not null and char_length(text) between 1 and 2000)
    or attachment_url is not null
    or location_lat is not null
  );

-- ── chat-photos bucket + policies ─────────────────────────────────────
--
-- Public-read so the CDN can serve the image without auth round-trips.
-- INSERT / DELETE are gated by the standard Supabase storage RLS:
-- INSERT requires a signed-in user; DELETE requires the uploader to own
-- the object (matched via storage.objects.owner = auth.uid()).
-- The 8 MB upload size limit on the bucket is a backstop — the server
-- action enforces 5 MB on raw input before downscaling.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-photos',
  'chat-photos',
  true,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "chat-photos: public read" on storage.objects;
create policy "chat-photos: public read"
  on storage.objects
  for select
  using (bucket_id = 'chat-photos');

drop policy if exists "chat-photos: authed insert" on storage.objects;
create policy "chat-photos: authed insert"
  on storage.objects
  for insert
  with check (bucket_id = 'chat-photos' and auth.role() = 'authenticated');

drop policy if exists "chat-photos: owner delete" on storage.objects;
create policy "chat-photos: owner delete"
  on storage.objects
  for delete
  using (bucket_id = 'chat-photos' and owner = auth.uid());

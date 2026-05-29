-- WAVIVI — chat-group-covers storage bucket.
--
-- Public-read bucket holding cover photos for chat groups (the ones
-- listed at /meet and managed in the admin Groups tab). The Group
-- editor uploads here via /api/admin/groups/upload-cover and then
-- writes the public URL into chat_groups.cover_image.
--
-- Writes are admin-only: the upload route uses the service-role client
-- which bypasses RLS, and there is no public/insert policy here. (Same
-- pattern as 0036_stays_photos_bucket.sql.)

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'chat-group-covers',
  'chat-group-covers',
  true,
  5242880,                                   -- 5 MB ceiling
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public read — bucket flag already permits this; explicit policy is
-- defence in depth in case the flag is ever flipped.
drop policy if exists "Chat group covers are publicly readable" on storage.objects;
create policy "Chat group covers are publicly readable"
  on storage.objects for select
  to public
  using (bucket_id = 'chat-group-covers');

-- No insert/update/delete policy for normal users; only the
-- service-role client (admin tools) can write.

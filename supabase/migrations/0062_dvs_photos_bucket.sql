-- Wondavu — dvs-photos storage bucket + RLS policies.
--
-- Companion to migration 0061 (daily_vibe_shares). A public bucket so
-- the feed renders without auth on every viewer; writes are scoped to
-- the uploader's own folder via auth.uid() — path layout is
-- dvs-photos/<user_id>/<timestamp>.<ext>, same shape as the avatars
-- bucket. Photo size cap matches avatars (5 MB) so a phone shot lands
-- without manual resize.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'dvs-photos',
  'dvs-photos',
  true,
  5242880,                       -- 5 MB ceiling
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public read so every viewer fetches the photo without auth.
drop policy if exists "DVS photos are publicly readable" on storage.objects;
create policy "DVS photos are publicly readable"
  on storage.objects for select
  to public
  using (bucket_id = 'dvs-photos');

-- Insert — authenticated, only into your own folder.
drop policy if exists "Users upload their own DVS photo" on storage.objects;
create policy "Users upload their own DVS photo"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'dvs-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users update their own DVS photo" on storage.objects;
create policy "Users update their own DVS photo"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'dvs-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users delete their own DVS photo" on storage.objects;
create policy "Users delete their own DVS photo"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'dvs-photos'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

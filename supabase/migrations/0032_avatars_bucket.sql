-- Wondavu — avatars storage bucket + RLS policies.
--
-- A public bucket so every traveler's profile picture is fetchable
-- without auth (the public profile pages need it). Writes are scoped
-- to the uploader's own folder via auth.uid(): the path layout is
-- avatars/<user_id>/<timestamp>.<ext>, and the (storage.foldername)[1]
-- segment check enforces it.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,                       -- 5 MB ceiling
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Read — public. (The bucket's public flag also makes objects
-- accessible by URL, but the explicit SELECT policy is defence in
-- depth in case the bucket flag is ever flipped.)
drop policy if exists "Avatars are publicly readable" on storage.objects;
create policy "Avatars are publicly readable"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

-- Insert — authenticated, only into your own user-id folder.
drop policy if exists "Users upload their own avatar" on storage.objects;
create policy "Users upload their own avatar"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Update + Delete — same self-only constraint, so a user can replace
-- or clear their own avatar but not touch anyone else's.
drop policy if exists "Users update their own avatar" on storage.objects;
create policy "Users update their own avatar"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "Users delete their own avatar" on storage.objects;
create policy "Users delete their own avatar"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'avatars'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

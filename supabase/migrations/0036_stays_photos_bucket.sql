-- WAVIVI — stays-photos storage bucket.
--
-- Public-read bucket holding mirrored stay hero photos. The Partner
-- Collection ingest route downloads Google-hosted images
-- (lh3.googleusercontent.com / ggpht.com) and uploads them here, then
-- swaps the stay's photo_url to the public Storage URL so we no longer
-- depend on Google's CDN (those URLs rotate / get rate-limited).
--
-- Writes are admin-only: the ingest route uses the service-role client
-- which bypasses RLS, and the admin dashboard uses the admin client too.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'stays-photos',
  'stays-photos',
  true,
  10485760,                                  -- 10 MB ceiling
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

-- Public read — bucket flag already permits this; explicit policy is
-- defence in depth in case the flag is ever flipped.
drop policy if exists "Stay photos are publicly readable" on storage.objects;
create policy "Stay photos are publicly readable"
  on storage.objects for select
  to public
  using (bucket_id = 'stays-photos');

-- No insert/update/delete policy for normal users; only the
-- service-role client (ingest route + admin tools) can write.

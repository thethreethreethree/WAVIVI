-- Drop the duplicate avatars policies that were added via the
-- Supabase dashboard. The canonical set lives in 0032_avatars_bucket.sql.
drop policy if exists "Avatars: public read"   on storage.objects;
drop policy if exists "Avatars: owner upload"  on storage.objects;
drop policy if exists "Avatars: owner update"  on storage.objects;
drop policy if exists "Avatars: owner delete"  on storage.objects;

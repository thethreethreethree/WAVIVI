-- WAVIVI — store Instagram thumbnail URLs alongside the post URLs
--
-- The IG web_profile_info JSON returns `thumbnail_src` / `display_url`
-- for every recent post. We stash those signed CDN URLs so the Featured
-- Travel Moments + Travel Feed grids can render the actual photo
-- instead of a randomized placeholder.
--
-- Note: IG CDN URLs are signed and eventually expire (~7-14 days for
-- thumbnail_src). Users hit "Pull latest from Instagram" to refresh.

alter table public.profiles
  add column if not exists instagram_post_thumbnails text[] not null default '{}'::text[];

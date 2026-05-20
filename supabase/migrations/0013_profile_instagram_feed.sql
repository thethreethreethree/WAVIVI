-- WAVIVI — separate Instagram lists for Featured Travel Moments + Travel Feed
--
-- Featured (`instagram_post_urls`) stays as the curated showcase grid.
-- Feed (`instagram_feed_urls`) is the new horizontally-scrolling Travel
-- Feed below it — different posts, often stories / reels / favourites.
-- Each list carries its own thumbnail array so the gridded artwork can
-- render real Instagram media.

alter table public.profiles
  add column if not exists instagram_feed_urls text[] not null default '{}'::text[],
  add column if not exists instagram_feed_thumbnails text[] not null default '{}'::text[];

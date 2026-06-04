-- WAVIVI — Travelers Feed: in-app video playback
--
-- Adds video_url alongside the existing image_url so a feed post can
-- carry an MP4 / WebM and render inline in the /feed surface as a
-- tap-to-play <video> element. The image_url stays the poster (the
-- still rendered before tap, lifted from the IG video thumbnail), so
-- both columns are populated for video posts and only image_url for
-- still-only posts.
--
-- Why not a separate media table:
--   The feed-post : media relationship is 1:1 (one card, one piece of
--   media). A media table would buy us join overhead without flexibility.
--   If the model ever grows to "post + carousel of N items" we'll
--   migrate then; for v1 the column is the simpler shape.

alter table public.feed_posts
  add column if not exists video_url text;

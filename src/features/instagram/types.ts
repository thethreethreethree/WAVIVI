/** A traveler-selected Instagram showcase post (URL only — no media stored). */
export interface InstagramPost {
  id: string;
  url: string;
  /** Real Instagram CDN thumbnail (set by Pull-from-Instagram), or
   *  null when no thumbnail has been fetched yet. The render layer
   *  (`InstagramThumb`) draws a brand gradient fallback when this is
   *  null or fails to load — see the 2026-06-09 fix for the prior
   *  picsum.photos placeholder breaking on Vercel's image optimizer. */
  image: string | null;
}

/** A traveler's linked Instagram identity. */
export interface InstagramIdentity {
  username: string;
  verified: boolean;
  posts: InstagramPost[];
}

/** A traveler-selected Instagram showcase post (URL only — no media stored). */
export interface InstagramPost {
  id: string;
  url: string;
  /** Lightweight preview thumbnail (placeholder until a live preview API). */
  image: string;
}

/** A traveler's linked Instagram identity. */
export interface InstagramIdentity {
  username: string;
  verified: boolean;
  posts: InstagramPost[];
}

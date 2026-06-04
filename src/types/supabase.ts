/**
 * Supabase database types.
 *
 * Hand-maintained to match `supabase/migrations/`. Once the Supabase project
 * is linked, regenerate with:
 *   npx supabase gen types typescript --project-id <id> > src/types/supabase.ts
 *
 * Note: these are `type` aliases (not interfaces) so they satisfy the
 * `Record<string, unknown>` constraint Supabase's typed client requires.
 */

export type TravelerStatus = "exploring" | "local" | "transit" | "offline";

/* ── profiles ─────────────────────────────────────────────────────────── */

export type ProfileRow = {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  home_country: string | null;
  countries: string[];
  traveler_status: TravelerStatus;
  instagram_username: string | null;
  instagram_verified: boolean;
  instagram_post_urls: string[];
  instagram_post_thumbnails: string[];
  instagram_feed_urls: string[];
  instagram_feed_thumbnails: string[];
  instagram_verify_token: string | null;
  instagram_verify_handle: string | null;
  instagram_verify_expires_at: string | null;
  /** Optional WhatsApp number — surfaces the traveler in the Meet
   *  Travelers search by phone. User-entered string; search normalises
   *  to digits for matching. (Migration 0029) */
  whatsapp_number: string | null;
  /** Digits-only generated column from whatsapp_number. Drives the
   *  WhatsApp search filter so phone formatting doesn't matter.
   *  (Migration 0031) */
  whatsapp_digits: string;
  /** Migration 0051 — stamped when the 3-step welcome flow completes.
   *  Null means the user signed up but never finished the walkthrough,
   *  which is the flag the auth callbacks key off to redirect them
   *  back into /welcome/[step] instead of the requested next path. */
  onboarded_at: string | null;
  /** Migration 0052 — stamped when the user requests deletion. The
   *  auth.users row is purged via service role once
   *  (now() - deletion_requested_at) > 30 days. Until then, signing
   *  back in surfaces a banner offering to cancel. */
  deletion_requested_at: string | null;
  deletion_reason: string | null;
  created_at: string;
  updated_at: string;
};

export type ProfileInsert = {
  id: string;
  username: string;
  display_name: string;
  bio?: string | null;
  avatar_url?: string | null;
  home_country?: string | null;
  countries?: string[];
  traveler_status?: TravelerStatus;
  instagram_username?: string | null;
  instagram_verified?: boolean;
  instagram_post_urls?: string[];
  instagram_post_thumbnails?: string[];
  instagram_feed_urls?: string[];
  instagram_feed_thumbnails?: string[];
  instagram_verify_token?: string | null;
  instagram_verify_handle?: string | null;
  instagram_verify_expires_at?: string | null;
  created_at?: string;
  updated_at?: string;
};

export type ProfileUpdate = {
  username?: string;
  display_name?: string;
  bio?: string | null;
  avatar_url?: string | null;
  home_country?: string | null;
  countries?: string[];
  traveler_status?: TravelerStatus;
  instagram_username?: string | null;
  instagram_verified?: boolean;
  instagram_post_urls?: string[];
  instagram_post_thumbnails?: string[];
  instagram_feed_urls?: string[];
  instagram_feed_thumbnails?: string[];
  instagram_verify_token?: string | null;
  instagram_verify_handle?: string | null;
  instagram_verify_expires_at?: string | null;
  /** Migration 0051 — stamped when the post-signup walkthrough completes. */
  onboarded_at?: string | null;
  /** Migration 0052 — deletion request flow. */
  deletion_requested_at?: string | null;
  deletion_reason?: string | null;
};

/* ── Traveler Toolbox ─────────────────────────────────────────────────── */

export type UtilityCategory =
  | "atm"
  | "market"
  | "bank"
  | "sim_card"
  | "public_wifi"
  | "currency_exchange"
  | "bathroom"
  | "transportation"
  | "medical_clinic"
  | "police"
  | "embassy"
  | "laundry";

export type CrowdLevel = "low" | "medium" | "high";
export type ScanStatus = "pending" | "running" | "completed" | "failed";
export type ReportType =
  | "offline"
  | "bad_service"
  | "temp_closure"
  | "moved"
  | "incorrect_info"
  | "other";
export type ReportStatus = "open" | "reviewed" | "resolved" | "dismissed";

export type RegionRow = {
  id: string;
  country: string;
  province: string | null;
  city: string;
  display_name: string;
  latitude: number;
  longitude: number;
  radius_km: number;
  timezone: string | null;
  active: boolean;
  scan_enabled: boolean;
  last_scan_at: string | null;
  next_scheduled_scan: string | null;
  created_at: string;
  updated_at: string;
};

export type RegionInsert = {
  id: string;
  country: string;
  province?: string | null;
  city: string;
  display_name: string;
  latitude: number;
  longitude: number;
  radius_km?: number;
  timezone?: string | null;
  active?: boolean;
  scan_enabled?: boolean;
  last_scan_at?: string | null;
  next_scheduled_scan?: string | null;
};

export type RegionUpdate = Partial<Omit<RegionInsert, "id">>;

/* ── Cities (migration 0046) ───────────────────────────────────────────
 * A region (province / scan area) groups many cities. Slugs are unique
 * per-region, not globally, so two provinces can each have a "Carmen".
 * Place rows (stays/restaurants/experiences) get an optional city_id FK
 * onto this table. */
export type CityRow = {
  id: string;
  region_id: string;
  slug: string;
  name: string;
  created_at: string;
};

export type CityInsert = {
  id?: string;
  region_id: string;
  slug: string;
  name: string;
};

export type CityUpdate = Partial<Omit<CityInsert, "region_id">>;

/* ── Feed posts (migration 0050) ────────────────────────────────────────
 * Powers the Travelers Feed at /feed. Each row is one IG-style post,
 * tagged to a region (and optionally to a city). Image is mirrored to
 * Supabase Storage on insert so IG CDN token rotation doesn't break it. */
export type FeedPostSource =
  | "admin_curated"
  | "instagram_oauth"
  | "user_paste";

export type FeedPostRow = {
  id: string;
  region_id: string | null;
  city_id: string | null;
  handle: string;
  verified: boolean;
  caption: string;
  location_label: string | null;
  source: FeedPostSource;
  ig_post_url: string | null;
  image_url: string;
  likes_label: string;
  comments: number;
  shares: number;
  active: boolean;
  display_order: number | null;
  created_at: string;
  updated_at: string;
};

export type FeedPostInsert = {
  id?: string;
  region_id?: string | null;
  city_id?: string | null;
  handle: string;
  verified?: boolean;
  caption?: string;
  location_label?: string | null;
  source?: FeedPostSource;
  ig_post_url?: string | null;
  image_url: string;
  likes_label?: string;
  comments?: number;
  shares?: number;
  active?: boolean;
  display_order?: number | null;
};

export type FeedPostUpdate = Partial<Omit<FeedPostInsert, "id">>;

export type UtilityRow = {
  id: string;
  region_id: string | null;
  category: UtilityCategory;
  name: string;
  latitude: number;
  longitude: number;
  google_maps_url: string;
  address: string | null;
  rating: number | null;
  review_count: number;
  thumbs_up: number;
  thumbs_down: number;
  open_24_hours: boolean;
  phone: string | null;
  website: string | null;
  instagram: string | null;
  facebook: string | null;
  whatsapp: string | null;
  email: string | null;
  reliability_score: number;
  backpack_rating: number;
  /** Migration 0048 — Bayesian-weighted ranking score for list pages.
   *  Generated column; never written by callers (Insert/Update types
   *  intentionally omit it). See src/lib/ranking.ts for the formula. */
  rank_score: number | null;
  admin_edited: boolean;
  crowd_level: CrowdLevel | null;
  description: string | null;
  traveler_notes: string[];
  photo_url: string | null;
  source: string;
  source_ref: string;
  metadata_json: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export type UtilityInsert = {
  id?: string;
  region_id?: string | null;
  category: UtilityCategory;
  name: string;
  latitude: number;
  longitude: number;
  google_maps_url: string;
  address?: string | null;
  rating?: number | null;
  review_count?: number;
  thumbs_up?: number;
  thumbs_down?: number;
  open_24_hours?: boolean;
  phone?: string | null;
  website?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  reliability_score?: number;
  backpack_rating?: number;
  admin_edited?: boolean;
  crowd_level?: CrowdLevel | null;
  description?: string | null;
  traveler_notes?: string[];
  photo_url?: string | null;
  source?: string;
  source_ref: string;
  metadata_json?: Record<string, unknown>;
};

export type UtilityUpdate = Partial<Omit<UtilityInsert, "source_ref">>;

export type ReportRow = {
  id: string;
  utility_id: string;
  reporter_id: string | null;
  report_type: ReportType;
  note: string | null;
  status: ReportStatus;
  created_at: string;
};

export type ReportInsert = {
  utility_id: string;
  reporter_id?: string | null;
  report_type: ReportType;
  note?: string | null;
  status?: ReportStatus;
};

export type ReportUpdate = { status?: ReportStatus };

export type ScanJobRow = {
  id: string;
  region_id: string;
  category: UtilityCategory | null;
  status: ScanStatus;
  started_at: string | null;
  completed_at: string | null;
  total_found: number;
  total_saved: number;
  errors: string | null;
  created_at: string;
};

export type ScanJobInsert = {
  id?: string;
  region_id: string;
  category?: UtilityCategory | null;
  status?: ScanStatus;
  started_at?: string | null;
  completed_at?: string | null;
  total_found?: number;
  total_saved?: number;
  errors?: string | null;
};

export type ScanJobUpdate = Partial<Omit<ScanJobInsert, "id" | "region_id">>;

export type ScanLogRow = {
  id: string;
  scan_job_id: string;
  level: "info" | "warn" | "error";
  message: string;
  created_at: string;
};

export type ScanLogInsert = {
  scan_job_id: string;
  level?: "info" | "warn" | "error";
  message: string;
};

export type UtilityVoteRow = {
  id: string;
  utility_id: string;
  voter_id: string;
  vote: -1 | 1;
  created_at: string;
};

export type UtilityVoteInsert = {
  utility_id: string;
  voter_id: string;
  vote: -1 | 1;
};

export type UtilityVoteUpdate = { vote: -1 | 1 };

/* ── Stays (lodging) ──────────────────────────────────────────────────── */

export type StayType =
  | "hostel"
  | "hotel"
  | "guesthouse"
  | "resort"
  | "apartment"
  | "bnb"
  | "camping"
  | "other";

export type StayRow = {
  id: string;
  region_id: string | null;
  /** Migration 0046: links each place to its city under the parent region.
   *  Nullable so legacy rows (pre-cities) and per-region uploaders that
   *  don't supply a city resolver leave it null. */
  city_id: string | null;
  stay_type: StayType;
  name: string;
  latitude: number;
  longitude: number;
  google_maps_url: string;
  address: string | null;
  rating: number | null;
  review_count: number;
  thumbs_up: number;
  thumbs_down: number;
  backpack_rating: number;
  reliability_score: number;
  /** Migration 0048 — Bayesian-weighted ranking score for list pages.
   *  Generated column; never written by callers (Insert/Update types
   *  intentionally omit it). See src/lib/ranking.ts for the formula. */
  rank_score: number | null;
  admin_edited: boolean;
  phone: string | null;
  website: string | null;
  email: string | null;
  instagram: string | null;
  facebook: string | null;
  whatsapp: string | null;
  price_per_night_usd: number | null;
  check_in_time: string | null;
  check_out_time: string | null;
  amenities: string[];
  description: string | null;
  photo_url: string | null;
  photo_urls: string[];
  source: string;
  source_ref: string;
  /** Generated (migration 0021): the Google place id when source_ref is a
   *  google: ref, else null. Read-only — DB computes it. */
  google_place_id: string | null;
  claimed_by: string | null;
  metadata_json: Record<string, unknown>;
  active: boolean;
  /** Hidden from the public site until an admin approves. Set by the
   *  Partner Collection extension ingest route; cleared in the admin
   *  pending-review queue. */
  needs_review: boolean;
  /** Admin-controlled promotion flags (migration 0040). */
  featured: boolean;
  top_pick: boolean;
  created_at: string;
  updated_at: string;
};

export type StayInsert = {
  id?: string;
  region_id?: string | null;
  city_id?: string | null;
  stay_type?: StayType;
  name: string;
  latitude: number;
  longitude: number;
  google_maps_url?: string;
  address?: string | null;
  rating?: number | null;
  review_count?: number;
  thumbs_up?: number;
  thumbs_down?: number;
  backpack_rating?: number;
  reliability_score?: number;
  admin_edited?: boolean;
  phone?: string | null;
  website?: string | null;
  email?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  whatsapp?: string | null;
  price_per_night_usd?: number | null;
  check_in_time?: string | null;
  check_out_time?: string | null;
  amenities?: string[];
  description?: string | null;
  photo_url?: string | null;
  photo_urls?: string[];
  source?: string;
  source_ref: string;
  claimed_by?: string | null;
  metadata_json?: Record<string, unknown>;
  active?: boolean;
  needs_review?: boolean;
  featured?: boolean;
  top_pick?: boolean;
};

export type StayUpdate = Partial<Omit<StayInsert, "source_ref">>;

/* ── Experiences (tours, dives, kayak rentals, viewpoints, …) ─────────── */

export type ExperienceRow = {
  id: string;
  region_id: string | null;
  /** Migration 0046 — see StayRow.city_id. */
  city_id: string | null;
  /** Broad theme for filter chips (Adventure, Water & Beach, …). */
  category: string;
  activity_type: string;
  /** Time-of-day bucket: morning | midday | nighttime | null. */
  day_bucket: string | null;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  google_maps_url: string;
  address: string | null;
  rating: number | null;
  review_count: number;
  thumbs_up: number;
  thumbs_down: number;
  backpack_rating: number;
  reliability_score: number;
  /** Migration 0048 — Bayesian-weighted ranking score for list pages.
   *  Generated column; never written by callers (Insert/Update types
   *  intentionally omit it). See src/lib/ranking.ts for the formula. */
  rank_score: number | null;
  admin_edited: boolean;
  phone: string | null;
  website: string | null;
  email: string | null;
  instagram: string | null;
  facebook: string | null;
  whatsapp: string | null;
  price_per_session_usd: number | null;
  amenities: string[];
  photo_url: string | null;
  photo_urls: string[];
  source: string;
  source_ref: string;
  /** Generated (migration 0021) — Google place id, read-only. */
  google_place_id: string | null;
  claimed_by: string | null;
  metadata_json: Record<string, unknown>;
  active: boolean;
  /** Admin-controlled promotion flags (migration 0041). */
  featured: boolean;
  top_pick: boolean;
  created_at: string;
  updated_at: string;
};

export type ExperienceInsert = {
  id?: string;
  region_id?: string | null;
  city_id?: string | null;
  category?: string;
  activity_type?: string;
  day_bucket?: string | null;
  name: string;
  description?: string | null;
  latitude: number;
  longitude: number;
  google_maps_url?: string;
  address?: string | null;
  rating?: number | null;
  review_count?: number;
  thumbs_up?: number;
  thumbs_down?: number;
  backpack_rating?: number;
  reliability_score?: number;
  admin_edited?: boolean;
  phone?: string | null;
  website?: string | null;
  email?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  whatsapp?: string | null;
  price_per_session_usd?: number | null;
  amenities?: string[];
  photo_url?: string | null;
  photo_urls?: string[];
  source?: string;
  source_ref: string;
  claimed_by?: string | null;
  metadata_json?: Record<string, unknown>;
  active?: boolean;
  featured?: boolean;
  top_pick?: boolean;
};

export type ExperienceUpdate = Partial<Omit<ExperienceInsert, "source_ref">>;

/* ── Events (socials, nights out, meetups, festivals) ─────────────────── */

export type EventRow = {
  id: string;
  region_id: string | null;
  category: string;
  day_bucket: string | null;
  when_text: string | null;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  google_maps_url: string;
  address: string | null;
  rating: number | null;
  review_count: number;
  thumbs_up: number;
  thumbs_down: number;
  backpack_rating: number;
  reliability_score: number;
  /** Migration 0048 — Bayesian-weighted ranking score for list pages.
   *  Generated column; never written by callers (Insert/Update types
   *  intentionally omit it). See src/lib/ranking.ts for the formula. */
  rank_score: number | null;
  admin_edited: boolean;
  phone: string | null;
  website: string | null;
  email: string | null;
  instagram: string | null;
  facebook: string | null;
  whatsapp: string | null;
  amenities: string[];
  photo_url: string | null;
  photo_urls: string[];
  source: string;
  source_ref: string;
  google_place_id: string | null;
  claimed_by: string | null;
  metadata_json: Record<string, unknown>;
  active: boolean;
  featured: boolean;
  top_pick: boolean;
  created_at: string;
  updated_at: string;
};

export type EventInsert = {
  id?: string;
  region_id?: string | null;
  category?: string;
  day_bucket?: string | null;
  when_text?: string | null;
  name: string;
  description?: string | null;
  latitude: number;
  longitude: number;
  google_maps_url?: string;
  address?: string | null;
  rating?: number | null;
  review_count?: number;
  thumbs_up?: number;
  thumbs_down?: number;
  backpack_rating?: number;
  reliability_score?: number;
  admin_edited?: boolean;
  phone?: string | null;
  website?: string | null;
  email?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  whatsapp?: string | null;
  amenities?: string[];
  photo_url?: string | null;
  photo_urls?: string[];
  source?: string;
  source_ref: string;
  claimed_by?: string | null;
  metadata_json?: Record<string, unknown>;
  active?: boolean;
  featured?: boolean;
  top_pick?: boolean;
};

export type EventUpdate = Partial<Omit<EventInsert, "source_ref">>;

/* ── Restaurants (Where to Eat, in-app) ───────────────────────────────── */

export type RestaurantRow = {
  id: string;
  region_id: string | null;
  /** Migration 0046 — see StayRow.city_id. */
  city_id: string | null;
  cuisine: string;
  name: string;
  description: string | null;
  latitude: number;
  longitude: number;
  google_maps_url: string;
  address: string | null;
  rating: number | null;
  review_count: number;
  thumbs_up: number;
  thumbs_down: number;
  backpack_rating: number;
  reliability_score: number;
  /** Migration 0048 — Bayesian-weighted ranking score for list pages.
   *  Generated column; never written by callers (Insert/Update types
   *  intentionally omit it). See src/lib/ranking.ts for the formula. */
  rank_score: number | null;
  admin_edited: boolean;
  phone: string | null;
  website: string | null;
  email: string | null;
  instagram: string | null;
  facebook: string | null;
  whatsapp: string | null;
  price_range: string | null;
  amenities: string[];
  photo_url: string | null;
  photo_urls: string[];
  source: string;
  source_ref: string;
  google_place_id: string | null;
  claimed_by: string | null;
  metadata_json: Record<string, unknown>;
  active: boolean;
  featured: boolean;
  top_pick: boolean;
  created_at: string;
  updated_at: string;
};

export type RestaurantInsert = {
  id?: string;
  region_id?: string | null;
  city_id?: string | null;
  cuisine?: string;
  name: string;
  description?: string | null;
  latitude: number;
  longitude: number;
  google_maps_url?: string;
  address?: string | null;
  rating?: number | null;
  review_count?: number;
  thumbs_up?: number;
  thumbs_down?: number;
  backpack_rating?: number;
  reliability_score?: number;
  admin_edited?: boolean;
  phone?: string | null;
  website?: string | null;
  email?: string | null;
  instagram?: string | null;
  facebook?: string | null;
  whatsapp?: string | null;
  price_range?: string | null;
  amenities?: string[];
  photo_url?: string | null;
  photo_urls?: string[];
  source?: string;
  source_ref: string;
  claimed_by?: string | null;
  metadata_json?: Record<string, unknown>;
  active?: boolean;
  featured?: boolean;
  top_pick?: boolean;
};

export type RestaurantUpdate = Partial<Omit<RestaurantInsert, "source_ref">>;

export type StayVoteRow = {
  id: string;
  stay_id: string;
  voter_id: string;
  created_at: string;
};
export type StayVoteInsert = { stay_id: string; voter_id: string };
export type StayVoteUpdate = Partial<StayVoteInsert>;

/* ── Chat ─────────────────────────────────────────────────────────────── */

export type ChatGroupRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  cover_image: string | null;
  created_by: string | null;
  created_at: string;
  /* Where-to-Next routing columns (migration 0017). */
  destination_country: string | null;
  destination_city: string | null;
  window_start: string | null;
  window_end: string | null;
  theme_tags: string[];
  is_auto_generated: boolean;
  /* Admin control flags (migration 0028). */
  featured: boolean;
  archived: boolean;
  updated_at: string;
  /* Optional specific-location pin (migration 0039). */
  place_name: string | null;
  place_address: string | null;
  place_lat: number | null;
  place_lng: number | null;
  place_partner_id: string | null;
  place_partner_type: "stay" | "restaurant" | "experience" | "event" | null;
};
export type ChatGroupInsert = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  cover_image?: string | null;
  created_by?: string | null;
  destination_country?: string | null;
  destination_city?: string | null;
  window_start?: string | null;
  window_end?: string | null;
  theme_tags?: string[];
  is_auto_generated?: boolean;
  featured?: boolean;
  archived?: boolean;
  place_name?: string | null;
  place_address?: string | null;
  place_lat?: number | null;
  place_lng?: number | null;
  place_partner_id?: string | null;
  place_partner_type?:
    | "stay"
    | "restaurant"
    | "experience"
    | "event"
    | null;
};
export type ChatGroupUpdate = Partial<Omit<ChatGroupInsert, "id">>;

export type ChatGroupMemberRow = {
  group_id: string;
  user_id: string;
  /** Admin-curated — appears in the Group Vibes "Featured Travelers" strip. */
  featured: boolean;
  joined_at: string;
};
export type ChatGroupMemberInsert = {
  group_id: string;
  user_id: string;
  featured?: boolean;
};
export type ChatGroupMemberUpdate = Partial<ChatGroupMemberInsert>;

export type ChatMessageRow = {
  id: string;
  group_id: string;
  user_id: string;
  author_name: string;
  body: string | null;
  created_at: string;
  reply_to_id: string | null;
  reply_to_snippet: string | null;
  reply_to_author_name: string | null;
  attachment_kind: "image" | null;
  attachment_url: string | null;
  attachment_width: number | null;
  attachment_height: number | null;
  location_lat: number | null;
  location_lng: number | null;
  location_accuracy_m: number | null;
  location_label: string | null;
  edited_at: string | null;
};
export type ChatMessageInsert = {
  id?: string;
  group_id: string;
  user_id: string;
  author_name: string;
  body?: string | null;
  reply_to_id?: string | null;
  reply_to_snippet?: string | null;
  reply_to_author_name?: string | null;
  attachment_kind?: "image" | null;
  attachment_url?: string | null;
  attachment_width?: number | null;
  attachment_height?: number | null;
  location_lat?: number | null;
  location_lng?: number | null;
  location_accuracy_m?: number | null;
  location_label?: string | null;
  edited_at?: string | null;
};
export type ChatMessageUpdate = Partial<Omit<ChatMessageInsert, "id">>;

/* ── Traveler Notes (peer references shown on /u/[username]) ──────────── */

export type TravelerNoteRow = {
  id: string;
  author_id: string;
  recipient_id: string;
  body: string;
  created_at: string;
};
export type TravelerNoteInsert = {
  id?: string;
  author_id: string;
  recipient_id: string;
  body: string;
};
export type TravelerNoteUpdate = Partial<TravelerNoteInsert>;

/* ── Susen chat history (persistent per-user) ─────────────────────────── */

export type SusenMessageRow = {
  id: string;
  user_id: string;
  role: "user" | "susen";
  text: string | null;
  created_at: string;
  reply_to_id: string | null;
  reply_to_snippet: string | null;
  reply_to_author_name: string | null;
  attachment_kind: "image" | null;
  attachment_url: string | null;
  attachment_width: number | null;
  attachment_height: number | null;
  location_lat: number | null;
  location_lng: number | null;
  location_accuracy_m: number | null;
  location_label: string | null;
  edited_at: string | null;
};
export type SusenMessageInsert = {
  id?: string;
  user_id: string;
  role: "user" | "susen";
  text?: string | null;
  reply_to_id?: string | null;
  reply_to_snippet?: string | null;
  reply_to_author_name?: string | null;
  attachment_kind?: "image" | null;
  attachment_url?: string | null;
  attachment_width?: number | null;
  attachment_height?: number | null;
  location_lat?: number | null;
  location_lng?: number | null;
  location_accuracy_m?: number | null;
  location_label?: string | null;
  edited_at?: string | null;
};
export type SusenMessageUpdate = Partial<SusenMessageInsert>;

/* ── Where to Next (travel plans + match audit) ───────────────────────── */

export type TravelPlanBudget = "shoestring" | "mid" | "premium" | "luxury";
export type TravelPlanTravelingWith = "solo" | "partner" | "friends" | "family";
export type TravelPlanStatus = "draft" | "upcoming" | "active" | "past";

/** One leg of a multi-stop trip — stored as jsonb so the shape can grow. */
export type TravelPlanDestination = {
  country: string;
  city: string | null;
  arriveOn: string; // YYYY-MM-DD
  departOn: string; // YYYY-MM-DD
};

export type SavedTravelItem = {
  /** Stable id from the source table (stays.id, places.id, etc.) — or
   *  a client-generated uuid for free-text items the user typed in. */
  externalId: string;
  /** Denormalised so the plan still renders if the source row is removed. */
  name: string;
  city: string | null;
  notes: string | null;
  /** Optional — present when the traveler stars an item on the manage
   *  page. Stored inside the jsonb so no migration is needed to add it. */
  favorite?: boolean;
};

export type ItineraryTimeOfDay = "morning" | "afternoon" | "evening" | "anytime";

/** Category kinds an itinerary item can be tagged as. Matches the four
 *  Hub destinations (stay / eat / todo / events) so the planner can
 *  decorate each row with the same painted hub icon the home page uses. */
export type ItineraryKind = "stay" | "eat" | "todo" | "events";

/** One Trip Planner row — fits in the jsonb `itinerary` column. */
export type ItineraryItem = {
  /** Client-generated UUID so React keys + delete-by-id are stable. */
  id: string;
  /** 0-based offset from the plan's start_date. */
  dayIndex: number;
  title: string;
  time: ItineraryTimeOfDay;
  notes: string | null;
  /** Optional category. Existing rows from before this field was added
   *  will have it as undefined; we treat that as "no category" in the UI. */
  kind?: ItineraryKind | null;
};

export type TravelPlanRow = {
  id: string;
  user_id: string;
  start_date: string;
  end_date: string;
  duration_days: number;
  destinations: TravelPlanDestination[];
  destination_countries: string[];
  purpose: string[];
  activities: string[];
  vibe_tags: string[];
  must_see: string[];
  budget: TravelPlanBudget;
  traveling_with: TravelPlanTravelingWith;
  open_to_meet_others: boolean;
  saved_hotels: SavedTravelItem[];
  saved_restaurants: SavedTravelItem[];
  saved_activities: SavedTravelItem[];
  saved_events: SavedTravelItem[];
  saved_chats: string[];
  itinerary: ItineraryItem[];
  status: TravelPlanStatus;
  created_at: string;
  updated_at: string;
};

export type TravelPlanInsert = {
  id?: string;
  user_id: string;
  start_date: string;
  end_date: string;
  destinations?: TravelPlanDestination[];
  destination_countries?: string[];
  purpose?: string[];
  activities?: string[];
  vibe_tags?: string[];
  must_see?: string[];
  budget: TravelPlanBudget;
  traveling_with: TravelPlanTravelingWith;
  open_to_meet_others?: boolean;
  saved_hotels?: SavedTravelItem[];
  saved_restaurants?: SavedTravelItem[];
  saved_activities?: SavedTravelItem[];
  saved_events?: SavedTravelItem[];
  saved_chats?: string[];
  itinerary?: ItineraryItem[];
  status?: TravelPlanStatus;
};

export type TravelPlanUpdate = Partial<Omit<TravelPlanInsert, "user_id">>;

export type ChatInviteLogRow = {
  id: string;
  group_id: string;
  invitee_id: string;
  source_plan_id: string | null;
  match_score: number | null;
  reason: string | null;
  created_at: string;
};

export type ChatInviteLogInsert = {
  id?: string;
  group_id: string;
  invitee_id: string;
  source_plan_id?: string | null;
  match_score?: number | null;
  reason?: string | null;
};

export type ChatInviteLogUpdate = Partial<Omit<ChatInviteLogInsert, "id">>;

/* ── Pet ─────────────────────────────────────────────────────────────── */
// See supabase/migrations/0034_pet_core.sql.

export type PetSpecies = "wanderling";
export type PetStage =
  | "egg"
  | "hatchling"
  | "pup"
  | "explorer"
  | "wayfarer"
  | "elder";
export type PetBranch =
  | "explorer"
  | "social"
  | "foodie"
  | "homebody"
  | "adventurer";
export type PetStatus = "healthy" | "sick" | "dormant";
export type PetItemCategory =
  | "food"
  | "toy"
  | "hat"
  | "body"
  | "background"
  | "boost"
  | "special";

export type PetRow = {
  user_id: string;
  species: PetSpecies;
  name: string;
  stage: PetStage;
  branch: PetBranch | null;
  xp: number;
  hunger: number;
  happiness: number;
  energy: number;
  cleanliness: number;
  wanderlust: number;
  bond: number;
  status: PetStatus;
  wc_balance: number;
  last_tick_at: string;
  hatched_at: string | null;
  created_at: string;
};

export type PetInsert = {
  user_id: string;
  species?: PetSpecies;
  name?: string;
  stage?: PetStage;
  branch?: PetBranch | null;
  xp?: number;
  hunger?: number;
  happiness?: number;
  energy?: number;
  cleanliness?: number;
  wanderlust?: number;
  bond?: number;
  status?: PetStatus;
  wc_balance?: number;
  last_tick_at?: string;
  hatched_at?: string | null;
};

export type PetUpdate = Partial<Omit<PetInsert, "user_id">>;

export type PetItemRow = {
  slug: string;
  category: PetItemCategory;
  name: string;
  description: string | null;
  price_wc: number;
  effect: Record<string, unknown>;
  region: string | null;
  sprite: string;
  unlock_stage: PetStage | null;
  active: boolean;
  created_at: string;
};

export type PetItemInsert = Omit<PetItemRow, "created_at" | "active"> & {
  active?: boolean;
};
export type PetItemUpdate = Partial<PetItemInsert>;

export type PetInventoryRow = {
  user_id: string;
  item_slug: string;
  qty: number;
  equipped: boolean;
  acquired_at: string;
};

export type PetInventoryInsert = {
  user_id: string;
  item_slug: string;
  qty?: number;
  equipped?: boolean;
};

export type PetInventoryUpdate = Partial<
  Omit<PetInventoryInsert, "user_id" | "item_slug">
>;

export type PetTokenLedgerRow = {
  id: number;
  user_id: string;
  delta: number;
  balance_after: number;
  reason: string;
  source_kind: string | null;
  source_id: string | null;
  meta: Record<string, unknown>;
  created_at: string;
};

export type PetTokenLedgerInsert = {
  user_id: string;
  delta: number;
  balance_after: number;
  reason: string;
  source_kind?: string | null;
  source_id?: string | null;
  meta?: Record<string, unknown>;
};

export type PetTokenLedgerUpdate = Partial<
  Omit<PetTokenLedgerInsert, "user_id">
>;

export type PetRewardRuleRow = {
  action_kind: string;
  xp: number;
  tokens: number;
  stat_bumps: Record<string, number>;
  cap_per_day: number | null;
  one_time: boolean;
  active: boolean;
  updated_at: string;
};

export type PetRewardRuleInsert = {
  action_kind: string;
  xp?: number;
  tokens?: number;
  stat_bumps?: Record<string, number>;
  cap_per_day?: number | null;
  one_time?: boolean;
  active?: boolean;
};

export type PetRewardRuleUpdate = Partial<
  Omit<PetRewardRuleInsert, "action_kind">
>;

export type PetEventRow = {
  id: number;
  user_id: string;
  kind: string;
  meta: Record<string, unknown>;
  at: string;
};

export type PetEventInsert = {
  user_id: string;
  kind: string;
  meta?: Record<string, unknown>;
};

export type PetEventUpdate = Partial<Omit<PetEventInsert, "user_id">>;

/* ── Database ─────────────────────────────────────────────────────────── */

type TableShape<R, I, U> = {
  Row: R;
  Insert: I;
  Update: U;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: TableShape<ProfileRow, ProfileInsert, ProfileUpdate>;
      regions: TableShape<RegionRow, RegionInsert, RegionUpdate>;
      cities: TableShape<CityRow, CityInsert, CityUpdate>;
      feed_posts: TableShape<FeedPostRow, FeedPostInsert, FeedPostUpdate>;
      traveler_utilities: TableShape<UtilityRow, UtilityInsert, UtilityUpdate>;
      traveler_reports: TableShape<ReportRow, ReportInsert, ReportUpdate>;
      utility_votes: TableShape<
        UtilityVoteRow,
        UtilityVoteInsert,
        UtilityVoteUpdate
      >;
      scan_jobs: TableShape<ScanJobRow, ScanJobInsert, ScanJobUpdate>;
      scan_logs: TableShape<ScanLogRow, ScanLogInsert, ScanLogInsert>;
      stays: TableShape<StayRow, StayInsert, StayUpdate>;
      stay_votes: TableShape<StayVoteRow, StayVoteInsert, StayVoteUpdate>;
      experiences: TableShape<
        ExperienceRow,
        ExperienceInsert,
        ExperienceUpdate
      >;
      events: TableShape<EventRow, EventInsert, EventUpdate>;
      restaurants: TableShape<
        RestaurantRow,
        RestaurantInsert,
        RestaurantUpdate
      >;
      chat_groups: TableShape<
        ChatGroupRow,
        ChatGroupInsert,
        ChatGroupUpdate
      >;
      chat_group_members: TableShape<
        ChatGroupMemberRow,
        ChatGroupMemberInsert,
        ChatGroupMemberUpdate
      >;
      chat_messages: TableShape<
        ChatMessageRow,
        ChatMessageInsert,
        ChatMessageUpdate
      >;
      traveler_notes: TableShape<
        TravelerNoteRow,
        TravelerNoteInsert,
        TravelerNoteUpdate
      >;
      susen_messages: TableShape<
        SusenMessageRow,
        SusenMessageInsert,
        SusenMessageUpdate
      >;
      travel_plans: TableShape<
        TravelPlanRow,
        TravelPlanInsert,
        TravelPlanUpdate
      >;
      chat_invite_log: TableShape<
        ChatInviteLogRow,
        ChatInviteLogInsert,
        ChatInviteLogUpdate
      >;
      pet: TableShape<PetRow, PetInsert, PetUpdate>;
      pet_item: TableShape<PetItemRow, PetItemInsert, PetItemUpdate>;
      pet_inventory: TableShape<
        PetInventoryRow,
        PetInventoryInsert,
        PetInventoryUpdate
      >;
      pet_token_ledger: TableShape<
        PetTokenLedgerRow,
        PetTokenLedgerInsert,
        PetTokenLedgerUpdate
      >;
      pet_reward_rule: TableShape<
        PetRewardRuleRow,
        PetRewardRuleInsert,
        PetRewardRuleUpdate
      >;
      pet_event: TableShape<PetEventRow, PetEventInsert, PetEventUpdate>;
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      traveler_status: TravelerStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

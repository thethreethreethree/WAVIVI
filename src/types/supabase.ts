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
  claimed_by: string | null;
  metadata_json: Record<string, unknown>;
  active: boolean;
  created_at: string;
  updated_at: string;
};

export type StayInsert = {
  id?: string;
  region_id?: string | null;
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
};

export type StayUpdate = Partial<Omit<StayInsert, "source_ref">>;

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
};
export type ChatGroupUpdate = Partial<Omit<ChatGroupInsert, "id">>;

export type ChatGroupMemberRow = {
  group_id: string;
  user_id: string;
  joined_at: string;
};
export type ChatGroupMemberInsert = {
  group_id: string;
  user_id: string;
};
export type ChatGroupMemberUpdate = Partial<ChatGroupMemberInsert>;

export type ChatMessageRow = {
  id: string;
  group_id: string;
  user_id: string;
  author_name: string;
  body: string;
  created_at: string;
};
export type ChatMessageInsert = {
  id?: string;
  group_id: string;
  user_id: string;
  author_name: string;
  body: string;
};
export type ChatMessageUpdate = Partial<Omit<ChatMessageInsert, "id">>;

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
  /** Stable id from the source table (stays.id, places.id, etc.). */
  externalId: string;
  /** Denormalised so the plan still renders if the source row is removed. */
  name: string;
  city: string | null;
  notes: string | null;
};

export type ItineraryTimeOfDay = "morning" | "afternoon" | "evening" | "anytime";

/** One Trip Planner row — fits in the jsonb `itinerary` column. */
export type ItineraryItem = {
  /** Client-generated UUID so React keys + delete-by-id are stable. */
  id: string;
  /** 0-based offset from the plan's start_date. */
  dayIndex: number;
  title: string;
  time: ItineraryTimeOfDay;
  notes: string | null;
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
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      traveler_status: TravelerStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

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

/* ── Chat ─────────────────────────────────────────────────────────────── */

export type ChatGroupRow = {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  cover_image: string | null;
  created_by: string | null;
  created_at: string;
};
export type ChatGroupInsert = {
  id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  cover_image?: string | null;
  created_by?: string | null;
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
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      traveler_status: TravelerStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

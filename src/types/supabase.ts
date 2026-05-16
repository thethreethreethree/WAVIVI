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

export type ProfileRow = {
  id: string;
  username: string;
  display_name: string;
  bio: string | null;
  avatar_url: string | null;
  home_country: string | null;
  traveler_status: TravelerStatus;
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
  traveler_status?: TravelerStatus;
  created_at?: string;
  updated_at?: string;
};

export type ProfileUpdate = {
  username?: string;
  display_name?: string;
  bio?: string | null;
  avatar_url?: string | null;
  home_country?: string | null;
  traveler_status?: TravelerStatus;
};

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: ProfileRow;
        Insert: ProfileInsert;
        Update: ProfileUpdate;
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: { [_ in never]: never };
    Enums: {
      traveler_status: TravelerStatus;
    };
    CompositeTypes: { [_ in never]: never };
  };
};

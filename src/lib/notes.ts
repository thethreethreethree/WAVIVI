import "server-only";

import { createClient } from "@/lib/supabase/server";

/** A traveler note joined with the author's profile, for display. */
export interface TravelerNoteWithAuthor {
  id: string;
  body: string;
  created_at: string;
  author_id: string;
  author_username: string;
  author_display_name: string;
  author_avatar_url: string | null;
  author_home_country: string | null;
}

/** Notes received by a traveler, newest first. */
export async function getNotesForRecipient(
  recipientId: string,
  limit = 20,
): Promise<TravelerNoteWithAuthor[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("traveler_notes")
    .select(
      "id, body, created_at, author_id, profiles!traveler_notes_author_id_fkey(username, display_name, avatar_url, home_country)",
    )
    .eq("recipient_id", recipientId)
    .order("created_at", { ascending: false })
    .limit(limit);

  type Row = {
    id: string;
    body: string;
    created_at: string;
    author_id: string;
    profiles: {
      username: string;
      display_name: string;
      avatar_url: string | null;
      home_country: string | null;
    } | null;
  };
  return ((data as unknown as Row[] | null) ?? [])
    .filter((r) => r.profiles)
    .map((r) => ({
      id: r.id,
      body: r.body,
      created_at: r.created_at,
      author_id: r.author_id,
      author_username: r.profiles!.username,
      author_display_name: r.profiles!.display_name,
      author_avatar_url: r.profiles!.avatar_url,
      author_home_country: r.profiles!.home_country,
    }));
}

/** How many notes a traveler has received — used for headers + counters. */
export async function countNotesForRecipient(
  recipientId: string,
): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("traveler_notes")
    .select("id", { count: "exact", head: true })
    .eq("recipient_id", recipientId);
  return count ?? 0;
}

/** True if the signed-in user has already left a note for this recipient.
 *  Used to switch the form UI between "leave" and "you've already left one". */
export async function hasNotedRecipient(
  recipientId: string,
): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { count } = await supabase
    .from("traveler_notes")
    .select("id", { count: "exact", head: true })
    .eq("author_id", user.id)
    .eq("recipient_id", recipientId);
  return (count ?? 0) > 0;
}

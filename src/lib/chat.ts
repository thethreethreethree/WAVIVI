import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface ChatGroup {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  cover_image: string | null;
  created_at: string;
}

export interface ChatMessage {
  id: string;
  group_id: string;
  user_id: string;
  author_name: string;
  body: string;
  created_at: string;
}

/** Look up a chat group by its stable id (matches the mock travel-group id). */
export async function getChatGroup(id: string): Promise<ChatGroup | null> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chat_groups")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  return (data as ChatGroup | null) ?? null;
}

/** Most recent messages for a group, oldest first. */
export async function getChatMessages(
  groupId: string,
  limit = 100,
): Promise<ChatMessage[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("group_id", groupId)
    .order("created_at", { ascending: false })
    .limit(limit);
  // Re-sort ascending so the UI can append realtime rows naturally.
  return ((data as ChatMessage[] | null) ?? []).slice().reverse();
}

/** A group member with the join columns we render in the Group Vibes UI. */
export interface ChatGroupMember {
  user_id: string;
  joined_at: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  home_country: string | null;
  bio: string | null;
}

/** Members of a chat group with their profile info, newest joined first.
 *  Used by the Group Vibes page (Featured Travelers) and the members list. */
export async function getChatGroupMembers(
  groupId: string,
  limit?: number,
): Promise<ChatGroupMember[]> {
  const supabase = await createClient();
  let q = supabase
    .from("chat_group_members")
    .select(
      "user_id, joined_at, profiles!inner(username, display_name, avatar_url, home_country, bio)",
    )
    .eq("group_id", groupId)
    .order("joined_at", { ascending: false });
  if (limit) q = q.limit(limit);
  const { data } = await q;
  type Row = {
    user_id: string;
    joined_at: string;
    profiles: {
      username: string;
      display_name: string;
      avatar_url: string | null;
      home_country: string | null;
      bio: string | null;
    } | null;
  };
  return ((data as unknown as Row[] | null) ?? [])
    .filter((r) => r.profiles)
    .map((r) => ({
      user_id: r.user_id,
      joined_at: r.joined_at,
      username: r.profiles!.username,
      display_name: r.profiles!.display_name,
      avatar_url: r.profiles!.avatar_url,
      home_country: r.profiles!.home_country,
      bio: r.profiles!.bio,
    }));
}

/** Total member count for a group — used for "N travelers" labels. */
export async function getChatGroupMemberCount(groupId: string): Promise<number> {
  const supabase = await createClient();
  const { count } = await supabase
    .from("chat_group_members")
    .select("user_id", { count: "exact", head: true })
    .eq("group_id", groupId);
  return count ?? 0;
}

/** True if the signed-in user belongs to the group. */
export async function isMember(groupId: string): Promise<boolean> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data } = await supabase
    .from("chat_group_members")
    .select("group_id")
    .eq("group_id", groupId)
    .eq("user_id", user.id)
    .maybeSingle();
  return Boolean(data);
}

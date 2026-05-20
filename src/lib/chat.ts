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

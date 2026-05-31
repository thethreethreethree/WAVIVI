"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";
import type { ChatMessageRow } from "@/types/supabase";

export type ChatActionResult = { error: string | null };
export type SendMessageResult = {
  error: string | null;
  message: ChatMessageRow | null;
};

/** Join the signed-in user to a chat group (idempotent). */
export async function joinGroup(groupId: string): Promise<ChatActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in." };

  const { error } = await supabase
    .from("chat_group_members")
    .insert({ group_id: groupId, user_id: user.id });

  // 23505 = unique_violation; already a member is a no-op success.
  if (error && error.code !== "23505") {
    return { error: error.message };
  }

  revalidatePath(`/meet/${groupId}`);
  revalidatePath(`/meet/${groupId}/chat`);
  return { error: null };
}

export interface SendMessageReplyTo {
  id: string;
  snippet: string;
  authorName: string;
}

/** Send a message into a group the user belongs to. Returns the inserted
   row so the client can append it optimistically (and dedupe against the
   realtime echo by id).

   When `replyTo` is passed, the row is stamped with the denormalised
   quote-target columns (id + snippet + author_name) so the bubble can
   render the WhatsApp-style quoted bar without a join. */
export async function sendMessage(
  groupId: string,
  body: string,
  replyTo?: SendMessageReplyTo | null,
): Promise<SendMessageResult> {
  const trimmed = body.trim();
  if (!trimmed) return { error: "Message can't be empty.", message: null };
  if (trimmed.length > 2000) {
    return { error: "Message is too long (2000 char max).", message: null };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in.", message: null };

  // Look up the sender's display name once so it's denormalised onto the
  // message row — realtime payloads can render without a join.
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("id", user.id)
    .maybeSingle();
  const authorName =
    profile?.display_name?.trim() || profile?.username || "Traveler";

  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      group_id: groupId,
      user_id: user.id,
      author_name: authorName,
      body: trimmed,
      reply_to_id: replyTo?.id ?? null,
      reply_to_snippet: replyTo?.snippet ?? null,
      reply_to_author_name: replyTo?.authorName ?? null,
    })
    .select("*")
    .single();
  if (error) return { error: error.message, message: null };
  return { error: null, message: data as ChatMessageRow };
}

/** Leave a group. */
export async function leaveGroup(groupId: string): Promise<ChatActionResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in." };
  const { error } = await supabase
    .from("chat_group_members")
    .delete()
    .eq("group_id", groupId)
    .eq("user_id", user.id);
  if (error) return { error: error.message };
  revalidatePath(`/meet/${groupId}`);
  return { error: null };
}

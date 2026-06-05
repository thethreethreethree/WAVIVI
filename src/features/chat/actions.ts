"use server";

import { revalidatePath } from "next/cache";

import { notifyChatRecipients } from "@/lib/notifications/triggers/chat";
import { checkRateLimit, CHAT_SEND_LIMIT } from "@/lib/rate-limit/check";
import { uploadChatPhoto } from "@/lib/storage/chat-photos";
import { friendlySupabaseError } from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";
import type { ChatMessageRow } from "@/types/supabase";

export type ChatActionResult = { error: string | null };
export type SendMessageResult = {
  error: string | null;
  message: ChatMessageRow | null;
};

export interface SendLocationPayload {
  lat: number;
  lng: number;
  accuracyM?: number | null;
  label?: string | null;
}

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
    return {
      error: friendlySupabaseError(error, {
        context: "chat/joinGroup",
        fallback:
          "We couldn't add you to that group. It might be invite-only — message someone who's already in.",
      }),
    };
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

  // Per-user chat-send rate limit. 30/min sits well above typing speed
  // for a real human but caps obvious bot floods. Shared with photo +
  // location sends below by passing them through the same key.
  const rl = await checkRateLimit(user.id, CHAT_SEND_LIMIT);
  if (!rl.ok) {
    return {
      error: "Slow down a sec — you're sending messages quite fast.",
      message: null,
    };
  }

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
  if (error)
    return {
      error: friendlySupabaseError(error, {
        context: "chat/sendMessage",
        fallback: "Couldn't send that message. Please try again.",
      }),
      message: null,
    };
  // Fire-and-forget notification fanout — one row per OTHER group
  // member. Failures here MUST NOT bubble up to the caller; the
  // message itself succeeded, and a missed notification is a soft
  // degrade (next message in the same group still fires).
  void notifyChatRecipients({
    groupId,
    senderUserId: user.id,
    senderName: authorName,
    snippet: trimmed,
    messageId: (data as ChatMessageRow).id,
  });
  return { error: null, message: data as ChatMessageRow };
}

/** Resolve the sender + their author name once, the same way sendMessage
 *  does. Returns a discriminated result so the callers can distinguish
 *  "no session" (401-equivalent) from "rate limited" (429-equivalent)
 *  and surface different copy. */
type ResolvedSender =
  | { ok: true; userId: string; authorName: string }
  | { ok: false; reason: "unauthenticated" | "rate-limited" };

async function resolveSender(): Promise<ResolvedSender> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, reason: "unauthenticated" };
  // Same chat-send limit as the text path — photo / location sends
  // count the same way so a bot can't dodge the meter by switching to
  // image-only messages.
  const rl = await checkRateLimit(user.id, CHAT_SEND_LIMIT);
  if (!rl.ok) return { ok: false, reason: "rate-limited" };
  const { data: profile } = await supabase
    .from("profiles")
    .select("display_name, username")
    .eq("id", user.id)
    .maybeSingle();
  const authorName =
    profile?.display_name?.trim() || profile?.username || "Traveler";
  return { ok: true, userId: user.id, authorName };
}

function senderFailure(result: Extract<ResolvedSender, { ok: false }>): SendMessageResult {
  if (result.reason === "rate-limited") {
    return {
      error: "Slow down a sec — you're sending messages quite fast.",
      message: null,
    };
  }
  return { error: "You need to be signed in.", message: null };
}

/** Upload an image then insert a chat_messages row pointing at it.
 *  Used by the WhatsApp-style attach button — one round-trip per send. */
export async function sendChatImage(
  groupId: string,
  formData: FormData,
): Promise<SendMessageResult> {
  const file = formData.get("file");
  if (!(file instanceof File)) {
    return { error: "No image provided.", message: null };
  }
  const replyToId = (formData.get("replyToId") as string | null) || null;
  const replyToSnippet =
    (formData.get("replyToSnippet") as string | null) || null;
  const replyToAuthor =
    (formData.get("replyToAuthor") as string | null) || null;
  const caption = ((formData.get("caption") as string | null) ?? "").trim();

  const sender = await resolveSender();
  if (!sender.ok) return senderFailure(sender);
  const supabase = await createClient();

  // Reserve a row id up-front so the storage key references it (means the
  // object only exists for messages we successfully insert below — orphan
  // sweep is straightforward).
  const messageId = crypto.randomUUID();
  let uploaded: { url: string; width: number; height: number };
  try {
    uploaded = await uploadChatPhoto(supabase, groupId, messageId, file);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Image upload failed.";
    return { error: msg, message: null };
  }

  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      id: messageId,
      group_id: groupId,
      user_id: sender.userId,
      author_name: sender.authorName,
      body: caption || null,
      attachment_kind: "image",
      attachment_url: uploaded.url,
      attachment_width: uploaded.width,
      attachment_height: uploaded.height,
      reply_to_id: replyToId,
      reply_to_snippet: replyToSnippet,
      reply_to_author_name: replyToAuthor,
    })
    .select("*")
    .single();
  if (error)
    return {
      error: friendlySupabaseError(error, {
        context: "chat/sendPhoto",
        fallback: "Couldn't send that photo. Please try again.",
      }),
      message: null,
    };
  // Notification fanout — caption used as snippet when present,
  // otherwise the renderer falls back to "sent a message" copy.
  void notifyChatRecipients({
    groupId,
    senderUserId: sender.userId,
    senderName: sender.authorName,
    snippet: caption || null,
    messageId,
  });
  return { error: null, message: data as ChatMessageRow };
}

/** Insert a chat_messages row carrying a location pin only (no upload). */
export async function sendChatLocation(
  groupId: string,
  location: SendLocationPayload,
  replyTo?: SendMessageReplyTo | null,
): Promise<SendMessageResult> {
  if (
    !Number.isFinite(location.lat) ||
    !Number.isFinite(location.lng) ||
    Math.abs(location.lat) > 90 ||
    Math.abs(location.lng) > 180
  ) {
    return { error: "Invalid location.", message: null };
  }
  const sender = await resolveSender();
  if (!sender.ok) return senderFailure(sender);
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({
      group_id: groupId,
      user_id: sender.userId,
      author_name: sender.authorName,
      body: null,
      location_lat: location.lat,
      location_lng: location.lng,
      location_accuracy_m: location.accuracyM ?? null,
      location_label: location.label ?? null,
      reply_to_id: replyTo?.id ?? null,
      reply_to_snippet: replyTo?.snippet ?? null,
      reply_to_author_name: replyTo?.authorName ?? null,
    })
    .select("*")
    .single();
  if (error)
    return {
      error: friendlySupabaseError(error, {
        context: "chat/sendLocation",
        fallback: "Couldn't share your location. Please try again.",
      }),
      message: null,
    };
  // Notification fanout — location pins don't carry a snippet, so the
  // renderer falls back to "sent a message in <group>" copy. The
  // location pin itself shows when the recipient taps through.
  void notifyChatRecipients({
    groupId,
    senderUserId: sender.userId,
    senderName: sender.authorName,
    snippet: null,
    messageId: (data as ChatMessageRow).id,
  });
  return { error: null, message: data as ChatMessageRow };
}

/** Edit a previously-sent chat message. Server enforces:
 *   * caller owns the row
 *   * row carries a text body (not image- or location-only)
 *   * sent within the last 15 minutes (WhatsApp's window)
 *  Returns the updated row on success so the client can swap it in. */
export async function editChatMessage(
  messageId: string,
  newBody: string,
): Promise<SendMessageResult> {
  const trimmed = newBody.trim();
  if (!trimmed) return { error: "Message can't be empty.", message: null };
  if (trimmed.length > 2000) {
    return { error: "Message is too long (2000 char max).", message: null };
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "You need to be signed in.", message: null };

  const { data: row } = await supabase
    .from("chat_messages")
    .select("user_id, body, created_at")
    .eq("id", messageId)
    .maybeSingle();
  if (!row) return { error: "Message not found.", message: null };
  const r = row as {
    user_id: string;
    body: string | null;
    created_at: string;
  };
  if (r.user_id !== user.id) {
    return { error: "You can only edit your own messages.", message: null };
  }
  if (!r.body) {
    return { error: "This message has no text to edit.", message: null };
  }
  const ageMs = Date.now() - new Date(r.created_at).getTime();
  if (ageMs > 15 * 60 * 1000) {
    return { error: "Edit window has closed (15 min limit).", message: null };
  }

  const editedAt = new Date().toISOString();
  const { data, error } = await supabase
    .from("chat_messages")
    .update({ body: trimmed, edited_at: editedAt })
    .eq("id", messageId)
    .select("*")
    .single();
  if (error)
    return {
      error: friendlySupabaseError(error, {
        context: "chat/editMessage",
        fallback: "Couldn't save the edit. Please try again.",
      }),
      message: null,
    };
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
  if (error)
    return {
      error: friendlySupabaseError(error, {
        context: "chat/leaveGroup",
        fallback: "Couldn't leave the group. Please try again.",
      }),
    };
  revalidatePath(`/meet/${groupId}`);
  return { error: null };
}

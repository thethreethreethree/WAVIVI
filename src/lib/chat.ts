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
  /** Admin-curated; shown in the Featured Travelers strip on /meet/[id]. */
  featured: boolean;
  username: string;
  display_name: string;
  avatar_url: string | null;
  home_country: string | null;
  bio: string | null;
}

/** Members of a chat group with their profile info, featured-first then
 *  newest joined first. Used by the Group Vibes page (Featured Travelers)
 *  and the members list.
 *
 *  Implemented as two explicit queries instead of a PostgREST embed: the
 *  embed needs an inferable FK relationship between chat_group_members
 *  and profiles, and our schema only links them through auth.users, which
 *  PostgREST can't always traverse — leading to silent empty results.
 *  Two queries is more reliable and only adds one round-trip. */
export async function getChatGroupMembers(
  groupId: string,
  limit?: number,
): Promise<ChatGroupMember[]> {
  const supabase = await createClient();
  let memberQ = supabase
    .from("chat_group_members")
    .select("user_id, joined_at, featured")
    .eq("group_id", groupId)
    .order("featured", { ascending: false })
    .order("joined_at", { ascending: false });
  if (limit) memberQ = memberQ.limit(limit);
  const { data: memberRows } = await memberQ;
  const rows =
    (memberRows as
      | { user_id: string; joined_at: string; featured: boolean }[]
      | null) ?? [];
  if (rows.length === 0) return [];

  const ids = rows.map((r) => r.user_id);
  const { data: profileRows } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, home_country, bio")
    .in("id", ids);
  type Profile = {
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    home_country: string | null;
    bio: string | null;
  };
  const profileById = new Map<string, Profile>();
  for (const p of (profileRows as Profile[] | null) ?? []) {
    profileById.set(p.id, p);
  }

  return rows
    .map((r) => {
      const p = profileById.get(r.user_id);
      if (!p) return null;
      return {
        user_id: r.user_id,
        joined_at: r.joined_at,
        featured: r.featured,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        home_country: p.home_country,
        bio: p.bio,
      } satisfies ChatGroupMember;
    })
    .filter((m): m is ChatGroupMember => m !== null);
}

/** Shape used by the public /meet list. Real chat_groups rows plus a
 *  handful of preview avatars (most-recent members) for the card. */
export interface PublicChatGroup {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  cover_image: string | null;
  destination_city: string | null;
  destination_country: string | null;
  featured: boolean;
  member_count: number;
  /** Up to 3 member avatar URLs (or null when the member has no avatar). */
  preview_avatars: (string | null)[];
}

/** Active (not archived) chat groups for the public /meet discover list.
 *  Sorted by featured DESC then created_at DESC, with up to 3 preview
 *  avatars per group fetched in a single follow-up query. */
export async function listPublicChatGroups(): Promise<PublicChatGroup[]> {
  const supabase = await createClient();
  const { data } = await supabase
    .from("chat_groups")
    .select(
      "id, name, description, category, cover_image, destination_city, destination_country, featured, chat_group_members(count)",
    )
    .eq("archived", false)
    .order("featured", { ascending: false })
    .order("created_at", { ascending: false });

  type Row = {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    cover_image: string | null;
    destination_city: string | null;
    destination_country: string | null;
    featured: boolean;
    chat_group_members?: Array<{ count: number }>;
  };
  const groups = ((data as unknown as Row[] | null) ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    category: g.category,
    cover_image: g.cover_image,
    destination_city: g.destination_city,
    destination_country: g.destination_country,
    featured: g.featured,
    member_count: g.chat_group_members?.[0]?.count ?? 0,
  }));

  // Fetch the preview avatars for every group in one query — most-recent
  // joiners first, capped to ~3 per group on the client side.
  const ids = groups.map((g) => g.id);
  if (ids.length === 0) {
    return groups.map((g) => ({ ...g, preview_avatars: [] }));
  }
  const { data: memberRows } = await supabase
    .from("chat_group_members")
    .select(
      "group_id, joined_at, profiles!inner(avatar_url)",
    )
    .in("group_id", ids)
    .order("joined_at", { ascending: false });
  type MemberRow = {
    group_id: string;
    profiles: { avatar_url: string | null } | null;
  };
  const previewByGroup = new Map<string, (string | null)[]>();
  for (const r of (memberRows as unknown as MemberRow[] | null) ?? []) {
    const list = previewByGroup.get(r.group_id) ?? [];
    if (list.length < 3) {
      list.push(r.profiles?.avatar_url ?? null);
      previewByGroup.set(r.group_id, list);
    }
  }
  return groups.map((g) => ({
    ...g,
    preview_avatars: previewByGroup.get(g.id) ?? [],
  }));
}

/** Admin-scoped chat group with a denormalised member count. Used on the
 *  /admin/groups list so the table can show "N travelers" without an
 *  extra query per row. */
export interface AdminChatGroup {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  cover_image: string | null;
  destination_city: string | null;
  destination_country: string | null;
  featured: boolean;
  archived: boolean;
  member_count: number;
  created_at: string;
  updated_at: string;
}

/**
 * List every chat group + its member count. Uses the admin client so the
 * count isn't filtered by RLS, and returns the full row regardless of the
 * archived flag — the admin UI surfaces archived groups under a chip.
 */
export async function listChatGroups(): Promise<AdminChatGroup[]> {
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const supabase = createAdminClient();
  const { data } = await supabase
    .from("chat_groups")
    .select(
      "id, name, description, category, cover_image, destination_city, destination_country, featured, archived, created_at, updated_at, chat_group_members(count)",
    )
    .order("featured", { ascending: false })
    .order("archived", { ascending: true })
    .order("created_at", { ascending: false });

  type Row = {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    cover_image: string | null;
    destination_city: string | null;
    destination_country: string | null;
    featured: boolean;
    archived: boolean;
    created_at: string;
    updated_at: string;
    chat_group_members?: Array<{ count: number }>;
  };
  return ((data as unknown as Row[] | null) ?? []).map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    category: g.category,
    cover_image: g.cover_image,
    destination_city: g.destination_city,
    destination_country: g.destination_country,
    featured: g.featured,
    archived: g.archived,
    created_at: g.created_at,
    updated_at: g.updated_at,
    member_count: g.chat_group_members?.[0]?.count ?? 0,
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

/** Compact profile info we attach to chat messages so each author renders
 *  with their avatar + home-country flag + a click-through to /u/username. */
export interface ChatAuthor {
  username: string;
  display_name: string;
  avatar_url: string | null;
  home_country: string | null;
}

/** Pull profile rows for the unique authors of a message set, keyed by
 *  user_id. Used by the chat page to enrich incoming messages with a
 *  clickable avatar + flag. */
export async function getChatAuthors(
  userIds: string[],
): Promise<Record<string, ChatAuthor>> {
  if (userIds.length === 0) return {};
  const supabase = await createClient();
  const ids = Array.from(new Set(userIds));
  const { data } = await supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, home_country")
    .in("id", ids);
  const out: Record<string, ChatAuthor> = {};
  for (const r of (data ?? []) as Array<{
    id: string;
    username: string;
    display_name: string;
    avatar_url: string | null;
    home_country: string | null;
  }>) {
    out[r.id] = {
      username: r.username,
      display_name: r.display_name,
      avatar_url: r.avatar_url,
      home_country: r.home_country,
    };
  }
  return out;
}

/** Groups the signed-in user is currently a member of, sorted by the
 *  most-recent join. Powers the "My Groups" page. Returns [] if the
 *  user isn't signed in. */
export async function listMyChatGroups(): Promise<PublicChatGroup[]> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data: memberRows } = await supabase
    .from("chat_group_members")
    .select("group_id, joined_at")
    .eq("user_id", user.id)
    .order("joined_at", { ascending: false });

  const rows =
    (memberRows as { group_id: string; joined_at: string }[] | null) ?? [];
  if (rows.length === 0) return [];

  const groupIds = rows.map((r) => r.group_id);
  const { data: groupRows } = await supabase
    .from("chat_groups")
    .select(
      "id, name, description, category, cover_image, destination_city, destination_country, featured, chat_group_members(count)",
    )
    .in("id", groupIds)
    .eq("archived", false);

  type Row = {
    id: string;
    name: string;
    description: string | null;
    category: string | null;
    cover_image: string | null;
    destination_city: string | null;
    destination_country: string | null;
    featured: boolean;
    chat_group_members?: Array<{ count: number }>;
  };

  const byId = new Map<string, Row>();
  for (const g of ((groupRows as unknown as Row[] | null) ?? [])) {
    byId.set(g.id, g);
  }

  // Preserve the most-recent-joined order from memberRows, drop any
  // groups that have since been archived (not returned by the second query).
  const ordered = rows
    .map((r) => byId.get(r.group_id))
    .filter((g): g is Row => Boolean(g));

  // Fetch up to 3 preview avatars per group (same pattern as the public
  // list) so the cards aren't empty.
  const ids = ordered.map((g) => g.id);
  const previewByGroup = new Map<string, (string | null)[]>();
  if (ids.length > 0) {
    const { data: avatarRows } = await supabase
      .from("chat_group_members")
      .select("group_id, joined_at, profiles!inner(avatar_url)")
      .in("group_id", ids)
      .order("joined_at", { ascending: false });
    type AvatarRow = {
      group_id: string;
      profiles: { avatar_url: string | null } | { avatar_url: string | null }[];
    };
    for (const a of ((avatarRows as unknown as AvatarRow[] | null) ?? [])) {
      const p = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles;
      const list = previewByGroup.get(a.group_id) ?? [];
      if (list.length < 3) list.push(p?.avatar_url ?? null);
      previewByGroup.set(a.group_id, list);
    }
  }

  return ordered.map((g) => ({
    id: g.id,
    name: g.name,
    description: g.description,
    category: g.category,
    cover_image: g.cover_image,
    destination_city: g.destination_city,
    destination_country: g.destination_country,
    featured: g.featured,
    member_count: g.chat_group_members?.[0]?.count ?? 0,
    preview_avatars: previewByGroup.get(g.id) ?? [],
  }));
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

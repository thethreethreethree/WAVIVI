import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ChatThread } from "@/components/ui/chat-thread";
import {
  getChatAuthors,
  getChatGroup,
  getChatMessages,
  isMember,
} from "@/lib/chat";
import { createClient } from "@/lib/supabase/server";
import { getGroup } from "@/lib/travejor/groups";

export const metadata: Metadata = { title: "Group Chat" };

type Params = Promise<{ id: string }>;

export default async function GroupChatPage({ params }: { params: Params }) {
  const { id } = await params;

  // The chat_groups row is the source of truth for chat; fall back to the
  // mock travel-group for discovery metadata (cover image, traveler count)
  // that the seed didn't carry across.
  const [dbGroup, mockGroup] = await Promise.all([
    getChatGroup(id),
    Promise.resolve(getGroup(id)),
  ]);
  if (!dbGroup && !mockGroup) notFound();

  const name = dbGroup?.name ?? mockGroup?.name ?? "Group";
  const category = dbGroup?.category ?? mockGroup?.category ?? "Travellers";
  const subtitle = mockGroup?.travelerCount
    ? `${mockGroup.travelerCount} travelers · ${category}`
    : category;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const joined = user ? await isMember(id) : false;
  const initialMessages = joined ? await getChatMessages(id) : [];
  // Fetch profile info for every unique author in the initial set so each
  // message renders with its author's avatar + home-country flag + a click
  // through to /u/[username]. Realtime new messages with an unknown author
  // fall back to the denormalised author_name only — acceptable, the page
  // refreshes on next mount.
  const authorsById = joined
    ? await getChatAuthors(initialMessages.map((m) => m.user_id))
    : {};

  return (
    <ChatThread
      title={name}
      subtitle={subtitle}
      coverImage={dbGroup?.cover_image ?? mockGroup?.coverImage ?? null}
      back={`/meet/${id}`}
      groupId={id}
      currentUserId={user?.id ?? null}
      joined={joined}
      initialMessages={initialMessages}
      authorsById={authorsById}
      showAuthors
    />
  );
}

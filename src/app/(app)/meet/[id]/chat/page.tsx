import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ChatThread, type ThreadMessage } from "@/components/ui/chat-thread";
import { getGroup } from "@/lib/travejor/groups";

export const metadata: Metadata = { title: "Group Chat" };

type Params = Promise<{ id: string }>;

const seed: ThreadMessage[] = [
  {
    id: "g0",
    author: "Susen",
    body: "Welcome in 👋 Quick one for the room — what's a place you almost skipped but ended up loving?",
    time: "18:40",
    own: false,
    susen: true,
  },
  {
    id: "g1",
    author: "Maya",
    body: "Anyone heading to the night market later? 🍜",
    time: "18:42",
    own: false,
  },
  {
    id: "g2",
    author: "Carlos",
    body: "I'm in! Meeting at the hostel lobby at 7?",
    time: "18:45",
    own: false,
  },
  {
    id: "g3",
    author: "Zara",
    body: "Save me a spot — bringing two more travelers 🙌",
    time: "18:51",
    own: false,
  },
];

export default async function GroupChatPage({ params }: { params: Params }) {
  const { id } = await params;
  const group = getGroup(id);
  if (!group) notFound();

  return (
    <ChatThread
      title={group.name}
      subtitle={`${group.travelerCount} travelers · ${group.category}`}
      back={`/meet/${id}`}
      initialMessages={seed}
      showAuthors
    />
  );
}

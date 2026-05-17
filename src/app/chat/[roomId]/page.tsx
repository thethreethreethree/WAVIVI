import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { ChatRoomView } from "@/features/chat";
import { getRoom, mockMessages } from "@/lib/chat/data";

type Params = Promise<{ roomId: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { roomId } = await params;
  const room = getRoom(roomId);
  return { title: room ? room.name : "Chat room" };
}

export default async function ChatRoomPage({ params }: { params: Params }) {
  const { roomId } = await params;
  const room = getRoom(roomId);

  if (!room) notFound();

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col">
      <ChatRoomView room={room} initialMessages={mockMessages[roomId] ?? []} />
    </main>
  );
}

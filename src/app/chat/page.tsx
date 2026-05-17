import type { Metadata } from "next";

import { RoomList } from "@/features/chat";
import { mockRooms } from "@/lib/chat/data";

export const metadata: Metadata = {
  title: "Group chats",
  description: "Join travel group chats by place and topic.",
};

export default function ChatPage() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-12">
      <div className="w-full max-w-2xl">
        <header className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Group chats</h1>
          <p className="mt-1 text-sm text-muted">
            Jump into a room and connect with travelers near you.
          </p>
        </header>
        <RoomList rooms={mockRooms} />
      </div>
    </main>
  );
}

import Link from "next/link";

import type { ChatRoom } from "@/lib/chat/types";

/** Vertical list of joinable chat rooms. */
export function RoomList({ rooms }: { rooms: ChatRoom[] }) {
  return (
    <ul className="flex flex-col gap-2">
      {rooms.map((room) => (
        <li key={room.id}>
          <Link
            href={`/chat/${room.id}`}
            className="flex items-start gap-3 rounded-2xl border border-border
                       bg-surface p-4 transition-colors hover:border-glow/50"
          >
            <span className="text-2xl" aria-hidden>
              {room.emoji}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center justify-between gap-2">
                <span className="truncate font-medium">{room.name}</span>
                <span className="shrink-0 text-xs text-muted">
                  {room.memberCount.toLocaleString()} members
                </span>
              </span>
              <span className="block truncate text-xs text-cool">
                {room.place}
              </span>
              <span className="mt-1 block text-sm text-muted">
                {room.topic}
              </span>
            </span>
          </Link>
        </li>
      ))}
    </ul>
  );
}

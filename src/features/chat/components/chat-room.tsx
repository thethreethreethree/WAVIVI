"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { MessageBubble } from "@/features/chat/components/message-bubble";
import { currentIdentity, simulatedReplies } from "@/lib/chat/data";
import type { ChatMessage, ChatRoom } from "@/lib/chat/types";

export function ChatRoomView({
  room,
  initialMessages,
}: {
  room: ChatRoom;
  initialMessages: ChatMessage[];
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;

    const mine: ChatMessage = {
      id: crypto.randomUUID(),
      roomId: room.id,
      authorId: currentIdentity.id,
      authorName: currentIdentity.name,
      authorInitials: currentIdentity.initials,
      body,
      sentAt: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, mine]);
    setDraft("");

    // Simulate a live room until Supabase Realtime is wired in.
    const reply =
      simulatedReplies[Math.floor(Math.random() * simulatedReplies.length)];
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          roomId: room.id,
          authorId: `sim-${reply.initials}`,
          authorName: reply.name,
          authorInitials: reply.initials,
          body: reply.body,
          sentAt: new Date().toISOString(),
        },
      ]);
    }, 1400);
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-border px-6 py-3">
        <Link
          href="/chat"
          className="text-sm text-muted transition-colors hover:text-foreground"
          aria-label="Back to rooms"
        >
          ←
        </Link>
        <span className="text-xl" aria-hidden>
          {room.emoji}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-sm font-semibold">
            {room.name}
          </span>
          <span className="block truncate text-xs text-muted">
            {room.memberCount.toLocaleString()} members · {room.place}
          </span>
        </span>
      </header>

      <div
        ref={scrollRef}
        className="flex flex-1 flex-col gap-4 overflow-y-auto px-6 py-5"
      >
        {messages.map((message) => (
          <MessageBubble
            key={message.id}
            message={message}
            own={message.authorId === currentIdentity.id}
          />
        ))}
      </div>

      <form
        onSubmit={send}
        className="flex items-center gap-2 border-t border-border px-4 py-3"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={`Message ${room.name}…`}
          className="flex-1 rounded-full border border-border bg-surface px-4 py-2.5
                     text-sm outline-none transition-colors placeholder:text-muted
                     focus-visible:border-glow"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="rounded-full bg-glow px-4 py-2.5 text-sm font-medium text-white
                     transition-opacity hover:opacity-90 disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}

"use client";

import Link from "next/link";
import { useEffect, useRef, useState, useTransition } from "react";

import { SusenAvatar } from "@/components/ui/susen-avatar";
import { joinGroup, sendMessage } from "@/features/chat/actions";
import type { ChatMessage } from "@/lib/chat";
import { createClient } from "@/lib/supabase/client";

/**
 * Realtime group chat thread.
 *
 * Subscribes to `chat_messages` rows for `groupId` via Supabase Realtime
 * and posts via the `sendMessage` server action. If the signed-in user
 * isn't a member yet, the composer becomes a "Join this chat" CTA that
 * calls the `joinGroup` server action.
 */
export function ChatThread({
  title,
  subtitle,
  back,
  groupId,
  currentUserId,
  joined: joinedProp,
  initialMessages,
  showAuthors,
}: {
  title: string;
  subtitle: string;
  back: string;
  groupId: string;
  /** null when the visitor isn't signed in. */
  currentUserId: string | null;
  /** Server-rendered membership state; toggles after a successful join. */
  joined: boolean;
  initialMessages: ChatMessage[];
  showAuthors: boolean;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [joined, setJoined] = useState(joinedProp);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const endRef = useRef<HTMLDivElement>(null);

  // Auto-scroll on new messages.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages]);

  // Subscribe to new chat_messages rows for this group.
  useEffect(() => {
    if (!joined) return;
    const supabase = createClient();
    const channel = supabase
      .channel(`chat:${groupId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "chat_messages",
          filter: `group_id=eq.${groupId}`,
        },
        (payload) => {
          const row = payload.new as ChatMessage;
          // Dedupe against optimistic inserts.
          setMessages((prev) =>
            prev.some((m) => m.id === row.id) ? prev : [...prev, row],
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, joined]);

  function onSend(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body || !currentUserId) return;
    setDraft("");
    setError(null);
    startTransition(async () => {
      const res = await sendMessage(groupId, body);
      if (res.error) {
        setError(res.error);
        setDraft(body);
      }
    });
  }

  function onJoin() {
    if (!currentUserId) return;
    setError(null);
    startTransition(async () => {
      const res = await joinGroup(groupId);
      if (res.error) setError(res.error);
      else setJoined(true);
    });
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center gap-3 border-b border-border px-5 pb-3 pt-[max(3rem,calc(env(safe-area-inset-top)+2rem))]">
        <Link href={back} aria-label="Back" className="text-foreground">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            className="h-5 w-5"
          >
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </Link>
        <span className="min-w-0">
          <span className="block truncate font-bold">{title}</span>
          <span className="block truncate text-xs text-muted">{subtitle}</span>
        </span>
      </header>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
        {messages.length === 0 && (
          <p className="my-auto text-center text-sm text-muted">
            No messages yet — say hi 👋
          </p>
        )}
        {messages.map((m) => {
          const own = m.user_id === currentUserId;
          return (
            <div
              key={m.id}
              className={`flex flex-col ${own ? "items-end" : "items-start"}`}
            >
              {showAuthors && !own && (
                <span className="mb-0.5 text-xs font-medium text-muted">
                  {m.author_name}
                </span>
              )}
              <div
                className={`wc-frame max-w-[78%] px-3.5 py-2 text-sm ${
                  own
                    ? "wc-frame-sunset rounded-2xl rounded-tr-sm text-white"
                    : "rounded-2xl rounded-tl-sm text-foreground"
                }`}
              >
                {m.body}
              </div>
              <span className="mt-0.5 text-[10px] text-muted">
                {fmtTime(m.created_at)}
              </span>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      {error && (
        <p className="border-t border-heat/40 bg-heat/5 px-4 py-2 text-center text-xs font-semibold text-heat">
          {error}
        </p>
      )}

      {!currentUserId ? (
        <div className="border-t border-border px-4 py-3 text-center text-sm text-muted">
          <Link href="/login" className="font-semibold text-glow">
            Sign in
          </Link>{" "}
          to join the chat.
        </div>
      ) : !joined ? (
        <div className="flex items-center gap-3 border-t border-border px-4 py-3">
          <SusenAvatar className="h-8 w-8 shrink-0" />
          <p className="flex-1 text-sm text-muted">
            Join this group to send messages.
          </p>
          <button
            type="button"
            onClick={onJoin}
            disabled={pending}
            className="rounded-full bg-glow px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
          >
            {pending ? "Joining…" : "Join chat"}
          </button>
        </div>
      ) : (
        <form
          onSubmit={onSend}
          className="flex items-center gap-2 border-t border-border px-4 py-3"
        >
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Message…"
            disabled={pending}
            className="wc-frame flex-1 rounded-full bg-transparent px-4 py-2.5
                       text-sm outline-none placeholder:text-muted focus-visible:border-glow"
          />
          <button
            type="submit"
            disabled={!draft.trim() || pending}
            className="rounded-full bg-glow px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            {pending ? "…" : "Send"}
          </button>
        </form>
      )}
    </div>
  );
}

function fmtTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { SusenAvatar } from "@/components/ui/susen-avatar";

export interface ThreadMessage {
  id: string;
  author: string;
  body: string;
  time: string;
  own: boolean;
  /** Rendered as a Susen system message when true. */
  susen?: boolean;
}

const CANNED = [
  "Sounds great — count me in! 🙌",
  "Nice, see you all there.",
  "Adding it to my list, thanks!",
  "On my way now 🚶",
];

/**
 * Reusable chat thread — used for both group chats and direct messages.
 * Simulates a live room until Supabase Realtime is wired in.
 */
export function ChatThread({
  title,
  subtitle,
  back,
  initialMessages,
  showAuthors,
}: {
  title: string;
  subtitle: string;
  back: string;
  initialMessages: ThreadMessage[];
  showAuthors: boolean;
}) {
  const [messages, setMessages] = useState(initialMessages);
  const [draft, setDraft] = useState("");
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  function send(e: React.FormEvent) {
    e.preventDefault();
    const body = draft.trim();
    if (!body) return;
    const now = new Date().toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
    setMessages((prev) => [
      ...prev,
      { id: crypto.randomUUID(), author: "You", body, time: now, own: true },
    ]);
    setDraft("");
    setTimeout(() => {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          author: showAuthors ? "Maya" : title,
          body: CANNED[Math.floor(Math.random() * CANNED.length)],
          time: now,
          own: false,
        },
      ]);
    }, 1300);
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
        {messages.map((m) =>
          m.susen ? (
            <div
              key={m.id}
              className="wc-frame flex items-start gap-2 rounded-2xl p-3"
            >
              <SusenAvatar className="h-7 w-7" />
              <div className="min-w-0">
                <span className="text-xs font-bold text-glow">Susen</span>
                <p className="text-sm text-foreground">{m.body}</p>
              </div>
            </div>
          ) : (
            <div
              key={m.id}
              className={`flex flex-col ${m.own ? "items-end" : "items-start"}`}
            >
              {showAuthors && !m.own && (
                <span className="mb-0.5 text-xs font-medium text-muted">
                  {m.author}
                </span>
              )}
              <div
                className={`wc-frame max-w-[78%] px-3.5 py-2 text-sm ${
                  m.own
                    ? "wc-frame-sunset rounded-2xl rounded-tr-sm text-white"
                    : "rounded-2xl rounded-tl-sm text-foreground"
                }`}
              >
                {m.body}
              </div>
              <span className="mt-0.5 text-[10px] text-muted">{m.time}</span>
            </div>
          ),
        )}
        <div ref={endRef} />
      </div>

      <form
        onSubmit={send}
        className="flex items-center gap-2 border-t border-border px-4 py-3"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Message…"
          className="flex-1 rounded-full border border-border bg-surface px-4 py-2.5
                     text-sm outline-none placeholder:text-muted focus-visible:border-glow"
        />
        <button
          type="submit"
          disabled={!draft.trim()}
          className="rounded-full bg-glow px-4 py-2.5 text-sm font-semibold text-white disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}

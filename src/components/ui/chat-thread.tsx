"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { BackButton } from "@/components/ui/back-button";
import { SusenAvatar } from "@/components/ui/susen-avatar";
import { joinGroup, leaveGroup, sendMessage } from "@/features/chat/actions";
import type { ChatAuthor, ChatMessage } from "@/lib/chat";
import { createClient } from "@/lib/supabase/client";
import { flagImage } from "@/lib/travejor/account";

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
  authorsById,
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
  /** Author profile lookup keyed by user_id — populated server-side from
   *  the initial messages. Drives the avatar + flag chip next to each
   *  incoming message. Realtime messages from unknown authors fall back
   *  to plain text. */
  authorsById?: Record<string, ChatAuthor>;
  showAuthors: boolean;
}) {
  const router = useRouter();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [draft, setDraft] = useState("");
  const [joined, setJoined] = useState(joinedProp);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [menuOpen, setMenuOpen] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const menuWrapRef = useRef<HTMLDivElement>(null);

  // Close the kebab menu on outside-click and on Escape.
  useEffect(() => {
    if (!menuOpen) return;
    function onDown(e: MouseEvent) {
      if (!menuWrapRef.current?.contains(e.target as Node)) setMenuOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setMenuOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  function onLeave() {
    if (!currentUserId) return;
    if (!window.confirm("Leave this group? You can rejoin anytime.")) return;
    setMenuOpen(false);
    setError(null);
    startTransition(async () => {
      const res = await leaveGroup(groupId);
      if (res.error) setError(res.error);
      else {
        setJoined(false);
        router.push(`/meet/${groupId}`);
      }
    });
  }

  // Auto-scroll on new messages.
  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end", behavior: "smooth" });
  }, [messages]);

  // Subscribe to new chat_messages rows for this group.
  // RLS gates the broadcast — Realtime needs the user's access token, or
  // SELECT policy evaluation fails server-side and no rows are delivered.
  useEffect(() => {
    if (!joined) return;
    const supabase = createClient();
    let channel: ReturnType<typeof supabase.channel> | null = null;
    let cancelled = false;

    (async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (cancelled) return;
      if (session?.access_token) {
        supabase.realtime.setAuth(session.access_token);
      }
      channel = supabase
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
    })();

    return () => {
      cancelled = true;
      if (channel) supabase.removeChannel(channel);
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
      if (res.error || !res.message) {
        setError(res.error ?? "Could not send.");
        setDraft(body);
        return;
      }
      // Append immediately so the sender doesn't wait for the realtime
      // echo. The subscription dedupes by id when the same row arrives.
      const inserted = res.message;
      setMessages((prev) =>
        prev.some((m) => m.id === inserted.id) ? prev : [...prev, inserted],
      );
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
    // Explicit height (viewport minus bottom-nav reservation) so the
    // messages area below gets a real flex-1 number to scroll within and
    // the composer stays pinned at the bottom regardless of message count.
    <div className="flex h-[calc(100dvh-6.75rem)] flex-col overflow-hidden">
      <header className="flex items-center gap-3 border-b border-border px-5 pb-3 pt-[max(3rem,calc(env(safe-area-inset-top)+2rem))]">
        <BackButton
          fallback={back}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-foreground/5 active:scale-95"
        />
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">{title}</span>
          <span className="block truncate text-xs text-muted">{subtitle}</span>
        </span>

        {/* Chat settings — kebab menu top-right. Shows the painted icon
            from the brand asset kit; opens a small popover anchored under
            the button with View Members + (when joined) Leave Group. */}
        <div ref={menuWrapRef} className="relative">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Chat settings"
            onClick={() => setMenuOpen((o) => !o)}
            className="flex h-9 w-9 items-center justify-center rounded-full transition-transform active:scale-95 hover:bg-foreground/5"
          >
            <Image
              src="/icons/orange/menu_kebab.png"
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 object-contain"
            />
          </button>
          {menuOpen && (
            <div
              role="menu"
              className="wc-frame absolute right-0 top-11 z-30 w-48 overflow-hidden rounded-2xl bg-surface shadow-card"
            >
              <Link
                href={`/meet/${groupId}/members`}
                onClick={() => setMenuOpen(false)}
                className="block px-4 py-2.5 text-left text-sm font-semibold text-foreground hover:bg-foreground/5"
              >
                👥 View members
              </Link>
              <Link
                href={`/meet/${groupId}`}
                onClick={() => setMenuOpen(false)}
                className="block border-t border-border px-4 py-2.5 text-left text-sm font-semibold text-foreground hover:bg-foreground/5"
              >
                🪐 Group info
              </Link>
              {joined && (
                <button
                  type="button"
                  onClick={onLeave}
                  disabled={pending}
                  className="block w-full border-t border-border px-4 py-2.5 text-left text-sm font-semibold text-heat hover:bg-heat/5 disabled:opacity-60"
                >
                  🚪 Leave group
                </button>
              )}
            </div>
          )}
        </div>
      </header>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
        {messages.length === 0 && (
          <p className="my-auto text-center text-sm text-muted">
            No messages yet — say hi 👋
          </p>
        )}
        {messages.map((m) => {
          const own = m.user_id === currentUserId;
          // Pull profile info for incoming messages so the author chip
          // shows avatar + home-country flag and clicks through to /u/...
          // Realtime new messages from authors not in the map render with
          // text-only fallback (refresh fills in the avatar next mount).
          const author = !own ? authorsById?.[m.user_id] : undefined;
          return (
            <div
              key={m.id}
              className={`flex flex-col ${own ? "items-end" : "items-start"}`}
            >
              {showAuthors && !own && (
                author ? (
                  <Link
                    href={`/u/${author.username}`}
                    className="mb-0.5 flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground"
                  >
                    <span className="relative inline-block h-6 w-6">
                      <span className="block h-full w-full overflow-hidden rounded-full bg-surface ring-1 ring-border">
                        {author.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={author.avatar_url}
                            alt={author.display_name}
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-[10px] font-bold text-glow">
                            {author.display_name.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                      </span>
                      {author.home_country && (
                        <span
                          className="pointer-events-none absolute -bottom-0.5 -right-0.5 block h-3 w-3 overflow-hidden rounded-full bg-white ring-1 ring-background"
                          title={author.home_country}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={flagImage(author.home_country)}
                            alt={author.home_country}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                        </span>
                      )}
                    </span>
                    <span className="truncate">
                      {author.display_name || m.author_name}
                    </span>
                  </Link>
                ) : (
                  <span className="mb-0.5 text-xs font-medium text-muted">
                    {m.author_name}
                  </span>
                )
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

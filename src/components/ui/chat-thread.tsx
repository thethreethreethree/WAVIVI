"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";

import { BackButton } from "@/components/ui/back-button";
import {
  MessageImage,
  MessageLocation,
} from "@/components/ui/message-attachments";
import {
  canEditMessage,
  EditPreview,
  QuotedReply,
  ReplyActionSheet,
  ReplyPreview,
  type ReplyTarget,
  snippetFor,
} from "@/components/ui/reply-bits";
import { SusenAvatar } from "@/components/ui/susen-avatar";
import {
  editChatMessage,
  joinGroup,
  leaveGroup,
  sendChatImage,
  sendChatLocation,
  sendMessage,
} from "@/features/chat/actions";
import { useLongPress } from "@/hooks/use-long-press";
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
  coverImage,
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
  /** Group cover photo — rendered as a small circle in the header so the
   *  chat carries the same identity as the Group Vibes page. Falls back
   *  to a watercolor balloon glyph when missing. */
  coverImage?: string | null;
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
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [editing, setEditing] = useState<{
    id: string;
    originalBody: string;
  } | null>(null);
  const [actionMessageId, setActionMessageId] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const menuWrapRef = useRef<HTMLDivElement>(null);
  const messageRefs = useRef(new Map<string, HTMLDivElement>());
  const inputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [sharingLocation, setSharingLocation] = useState(false);

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
    if (editing) {
      const editId = editing.id;
      setDraft("");
      setEditing(null);
      setError(null);
      startTransition(async () => {
        const res = await editChatMessage(editId, body);
        if (res.error || !res.message) {
          setError(res.error ?? "Could not edit.");
          setDraft(body);
          setEditing({ id: editId, originalBody: body });
          return;
        }
        const updated = res.message;
        setMessages((prev) =>
          prev.map((m) => (m.id === updated.id ? { ...m, ...updated } : m)),
        );
      });
      return;
    }
    const replyPayload = replyTarget?.id
      ? {
          id: replyTarget.id,
          snippet: replyTarget.snippet,
          authorName: replyTarget.authorName,
        }
      : null;
    setDraft("");
    setReplyTarget(null);
    setError(null);
    startTransition(async () => {
      const res = await sendMessage(groupId, body, replyPayload);
      if (res.error || !res.message) {
        setError(res.error ?? "Could not send.");
        setDraft(body);
        if (replyPayload) {
          // Restore the reply chip so the user doesn't lose context on
          // retry — same gesture WhatsApp uses when a send fails.
          setReplyTarget({
            id: replyPayload.id,
            snippet: replyPayload.snippet,
            authorName: replyPayload.authorName,
          });
        }
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

  function onPickImage(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // reset so the same file re-fires onChange next time
    if (!file || !currentUserId) return;
    setError(null);
    const replyPayload = replyTarget?.id
      ? {
          id: replyTarget.id,
          snippet: replyTarget.snippet,
          authorName: replyTarget.authorName,
        }
      : null;
    setReplyTarget(null);
    startTransition(async () => {
      const fd = new FormData();
      fd.append("file", file);
      if (replyPayload) {
        fd.append("replyToId", replyPayload.id);
        fd.append("replyToSnippet", replyPayload.snippet);
        fd.append("replyToAuthor", replyPayload.authorName);
      }
      const res = await sendChatImage(groupId, fd);
      if (res.error || !res.message) {
        setError(res.error ?? "Could not send the photo.");
        if (replyPayload) {
          setReplyTarget({
            id: replyPayload.id,
            snippet: replyPayload.snippet,
            authorName: replyPayload.authorName,
          });
        }
        return;
      }
      const inserted = res.message;
      setMessages((prev) =>
        prev.some((m) => m.id === inserted.id) ? prev : [...prev, inserted],
      );
    });
  }

  function onShareLocation() {
    if (!currentUserId || sharingLocation) return;
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setError("Location isn't supported on this device.");
      return;
    }
    setError(null);
    setSharingLocation(true);
    const replyPayload = replyTarget?.id
      ? {
          id: replyTarget.id,
          snippet: replyTarget.snippet,
          authorName: replyTarget.authorName,
        }
      : null;
    setReplyTarget(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        startTransition(async () => {
          const res = await sendChatLocation(
            groupId,
            { lat: latitude, lng: longitude, accuracyM: accuracy ?? null },
            replyPayload,
          );
          setSharingLocation(false);
          if (res.error || !res.message) {
            setError(res.error ?? "Could not share your location.");
            if (replyPayload) {
              setReplyTarget({
                id: replyPayload.id,
                snippet: replyPayload.snippet,
                authorName: replyPayload.authorName,
              });
            }
            return;
          }
          const inserted = res.message;
          setMessages((prev) =>
            prev.some((m) => m.id === inserted.id) ? prev : [...prev, inserted],
          );
        });
      },
      (err) => {
        setSharingLocation(false);
        setError(
          err.code === err.PERMISSION_DENIED
            ? "Location permission was denied."
            : "Couldn't read your location.",
        );
      },
      { enableHighAccuracy: true, timeout: 10_000, maximumAge: 30_000 },
    );
  }

  function beginReply(m: ChatMessage) {
    setActionMessageId(null);
    setEditing(null);
    setReplyTarget({
      id: m.id,
      authorName: m.user_id === currentUserId ? "You" : m.author_name,
      snippet: snippetFor(
        m.body ??
          (m.attachment_kind === "image"
            ? "📷 Photo"
            : m.location_lat != null
              ? "📍 Location"
              : ""),
      ),
    });
    // Focus the composer so the keyboard pops on mobile.
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function beginEdit(m: ChatMessage) {
    if (!m.body) return;
    setActionMessageId(null);
    setReplyTarget(null);
    setEditing({ id: m.id, originalBody: m.body });
    setDraft(m.body);
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function scrollToMessage(id: string) {
    const el = messageRefs.current.get(id);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setHighlightId(id);
    window.setTimeout(() => {
      setHighlightId((cur) => (cur === id ? null : cur));
    }, 1400);
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
        <BackButton fallback={back} className="shrink-0" />
        {/* Group cover circle — matches the brand identity. Falls back to the
            balloon glyph when the group has no cover, so the avatar slot is
            never empty / shifty. */}
        <span className="wc-frame wc-frame-orange relative block h-10 w-10 shrink-0 rounded-full p-1">
          <span className="relative block h-full w-full overflow-hidden rounded-full bg-surface">
            {coverImage ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={coverImage}
                alt=""
                referrerPolicy="no-referrer"
                className="h-full w-full object-cover"
              />
            ) : (
              <Image
                src="/decor/balloon-floater.png"
                alt=""
                width={32}
                height={32}
                className="h-full w-full object-contain p-1"
              />
            )}
          </span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate font-bold">
            <span className="wc-underline">{title}</span>
          </span>
          <span className="block truncate text-xs text-muted">{subtitle}</span>
        </span>

        {/* Chat settings — kebab menu top-right. Shows the painted icon
            from the brand asset kit; opens a small popover anchored under
            the button with View Members + (when joined) Leave Group.
            `shrink-0 h-9 w-9` on the wrap pins the trigger's footprint so
            opening the absolute-positioned dropdown can't reflow it into
            the flex parent. */}
        <div ref={menuWrapRef} className="relative h-9 w-9 shrink-0">
          <button
            type="button"
            aria-haspopup="menu"
            aria-expanded={menuOpen}
            aria-label="Chat settings"
            onClick={() => setMenuOpen((o) => !o)}
            // `focus:outline-none focus-visible:outline-none` kills the
            // browser-default focus ring (which picked up the theme's
            // accent-glow and read as an orange outline on Sketch /
            // Journal). The icon stays the clear hit-target.
            className="flex h-full w-full items-center justify-center rounded-full transition-transform focus:outline-none focus-visible:outline-none active:scale-95 hover:bg-foreground/5"
          >
            <Image
              src="/icons/orange/menu_kebab.png"
              alt=""
              width={36}
              height={36}
              // Bumped from h-7 → h-9 (≈30% larger) so the dots fill the
              // trigger more confidently. User asked for the size bump.
              className="h-9 w-9 object-contain"
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

      <div className="relative flex flex-1 flex-col overflow-y-auto px-5 py-4">
        {/* Faint balloon decor drifting behind the thread — pure mood,
            doesn't compete with the messages. Hidden when there are no
            messages (the empty state has its own visual centre). */}
        {messages.length > 0 && (
          <>
            <Image
              src="/decor/balloon-floater.png"
              alt=""
              width={40}
              height={40}
              aria-hidden
              className="pointer-events-none absolute right-3 top-6 h-10 w-10 opacity-15"
              style={{
                animation: "balloonFloat 9s ease-in-out infinite",
              }}
            />
            <Image
              src="/decor/balloon-floater.png"
              alt=""
              width={32}
              height={32}
              aria-hidden
              className="pointer-events-none absolute bottom-24 left-4 h-8 w-8 opacity-10"
              style={{
                animation: "balloonFloat 11s ease-in-out infinite 2s",
              }}
            />
          </>
        )}

        {messages.length === 0 && (
          <p className="my-auto text-center text-sm text-muted">
            No messages yet — say hi 👋
          </p>
        )}
        {messages.map((m, i) => {
          const own = m.user_id === currentUserId;
          const prev = i > 0 ? messages[i - 1] : null;
          // Run-grouping: tighten gap + suppress author chip when the
          // previous message is from the same user within ~5 min.
          const sameRun =
            prev != null &&
            prev.user_id === m.user_id &&
            new Date(m.created_at).getTime() -
              new Date(prev.created_at).getTime() <
              5 * 60_000;
          // Day divider when the calendar date flips (or this is the first
          // message). Renders before the message itself.
          const showDay =
            !prev || !sameDay(prev.created_at, m.created_at);
          // Pull profile info for incoming messages so the author chip
          // shows avatar + home-country flag and clicks through to /u/...
          // Realtime new messages from authors not in the map render with
          // text-only fallback (refresh fills in the avatar next mount).
          const author = !own ? authorsById?.[m.user_id] : undefined;
          return (
            <div key={m.id}>
              {showDay && <DayDivider iso={m.created_at} />}
              <div
                className={`relative z-10 flex flex-col ${
                  sameRun ? "mt-0.5" : "mt-3"
                } ${own ? "items-end" : "items-start"}`}
              >
                {!sameRun && showAuthors && !own && (
                  author ? (
                    <Link
                      href={`/u/${author.username}`}
                      className="mb-1 flex items-center gap-1.5 text-xs font-medium text-muted hover:text-foreground"
                    >
                      <span className="relative inline-block h-7 w-7">
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
                            className="pointer-events-none absolute -bottom-0.5 -right-0.5 block h-3.5 w-3.5 overflow-hidden rounded-full bg-white ring-1 ring-background"
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
                    <span className="mb-1 text-xs font-medium text-muted">
                      {m.author_name}
                    </span>
                  )
                )}
                <MessageBubble
                  message={m}
                  own={own}
                  sameRun={sameRun}
                  highlighted={highlightId === m.id}
                  actionsOpen={actionMessageId === m.id}
                  canEdit={canEditMessage({
                    own,
                    hasBody: Boolean(m.body),
                    createdAtIso: m.created_at,
                  })}
                  registerRef={(el) => {
                    if (el) messageRefs.current.set(m.id, el);
                    else messageRefs.current.delete(m.id);
                  }}
                  onOpenActions={() => setActionMessageId(m.id)}
                  onCloseActions={() => setActionMessageId(null)}
                  onReply={() => beginReply(m)}
                  onEdit={() => beginEdit(m)}
                  onQuoteTap={
                    m.reply_to_id ? () => scrollToMessage(m.reply_to_id!) : undefined
                  }
                />
                {/* Timestamp only on the last message of a run — keeps long
                    bursts compact and the time still visible per cluster. */}
                {!isMidRun(messages, i) && (
                  <span className="mt-1 text-[10px] text-muted">
                    {fmtTime(m.created_at)}
                  </span>
                )}
              </div>
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
        <>
          {editing && (
            <EditPreview
              originalSnippet={snippetFor(editing.originalBody)}
              onCancel={() => {
                setEditing(null);
                setDraft("");
              }}
            />
          )}
          {replyTarget && !editing && (
            <ReplyPreview
              target={replyTarget}
              onCancel={() => setReplyTarget(null)}
            />
          )}
        <form
          onSubmit={onSend}
          className="flex items-center gap-2 border-t border-border bg-surface/60 px-4 py-3 backdrop-blur"
        >
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onPickImage}
          />
          <button
            type="button"
            aria-label="Attach photo"
            disabled={pending}
            onClick={() => fileInputRef.current?.click()}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-foreground/5 disabled:opacity-40"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden
            >
              <rect x="3" y="5" width="18" height="14" rx="2" />
              <circle cx="9" cy="11" r="2" />
              <path d="M21 17l-5-5-6 7" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Share location"
            disabled={pending || sharingLocation}
            onClick={onShareLocation}
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-muted hover:bg-foreground/5 disabled:opacity-40"
          >
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="h-5 w-5"
              aria-hidden
            >
              <path d="M12 22s-7-7.58-7-12a7 7 0 1 1 14 0c0 4.42-7 12-7 12z" />
              <circle cx="12" cy="10" r="2.5" />
            </svg>
          </button>
          <span className="wc-frame flex flex-1 items-center rounded-full bg-background px-2 py-1">
            <input
              ref={inputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder={
                editing
                  ? "Edit your message…"
                  : replyTarget
                    ? "Reply…"
                    : "Say something nice…"
              }
              disabled={pending}
              className="flex-1 bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-muted"
            />
          </span>
          <button
            type="submit"
            aria-label="Send"
            disabled={!draft.trim() || pending}
            className="wc-frame wc-frame-sunset flex h-10 w-10 items-center justify-center rounded-full text-white shadow-card transition-transform active:scale-95 disabled:opacity-40"
          >
            {pending ? (
              <span className="text-xs">…</span>
            ) : (
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className="h-4 w-4"
                aria-hidden
              >
                <path d="M2 12l19-9-9 19-2-8-8-2z" />
              </svg>
            )}
          </button>
        </form>
        </>
      )}
    </div>
  );
}

/** Single message bubble — knows how to long-press to open the action
 *  sheet, render its own quoted-reply bar, and flash on highlight. */
function MessageBubble({
  message,
  own,
  sameRun,
  highlighted,
  actionsOpen,
  canEdit,
  registerRef,
  onOpenActions,
  onCloseActions,
  onReply,
  onEdit,
  onQuoteTap,
}: {
  message: ChatMessage;
  own: boolean;
  sameRun: boolean;
  highlighted: boolean;
  actionsOpen: boolean;
  canEdit: boolean;
  registerRef: (el: HTMLDivElement | null) => void;
  onOpenActions: () => void;
  onCloseActions: () => void;
  onReply: () => void;
  onEdit: () => void;
  onQuoteTap?: () => void;
}) {
  const longPress = useLongPress(onOpenActions, { delayMs: 450 });
  const quote: ReplyTarget | null = message.reply_to_snippet
    ? {
        id: message.reply_to_id,
        snippet: message.reply_to_snippet,
        authorName: message.reply_to_author_name ?? "Traveler",
      }
    : null;
  return (
    <div className="relative w-fit max-w-[78%]">
      <div
        ref={registerRef}
        {...longPress}
        className={`wc-frame px-3.5 py-2 text-sm leading-snug shadow-card transition-shadow ${
          own
            ? `wc-frame-sunset rounded-2xl text-white ${sameRun ? "rounded-tr-2xl" : "rounded-tr-sm"}`
            : `rounded-2xl text-foreground ${sameRun ? "rounded-tl-2xl" : "rounded-tl-sm"}`
        } ${highlighted ? "ring-2 ring-glow ring-offset-2 ring-offset-background" : ""}`}
        style={{ touchAction: "pan-y" }}
      >
        {quote && (
          <QuotedReply
            target={quote}
            onTap={onQuoteTap}
            variant={own ? "own" : "default"}
          />
        )}
        {message.attachment_kind === "image" && message.attachment_url && (
          <div className={message.body ? "mb-1.5" : ""}>
            <MessageImage
              url={message.attachment_url}
              width={message.attachment_width}
              height={message.attachment_height}
              variant={own ? "own" : "default"}
            />
          </div>
        )}
        {message.location_lat != null && message.location_lng != null && (
          <div className={message.body ? "mb-1.5" : ""}>
            <MessageLocation
              lat={message.location_lat}
              lng={message.location_lng}
              accuracyM={message.location_accuracy_m}
              label={message.location_label}
              variant={own ? "own" : "default"}
            />
          </div>
        )}
        {message.body}
      </div>
      {actionsOpen && (
        <div
          className={`absolute top-full mt-1 ${own ? "right-0" : "left-0"}`}
        >
          <ReplyActionSheet
            onReply={onReply}
            onEdit={canEdit ? onEdit : undefined}
            onClose={onCloseActions}
          />
        </div>
      )}
      {message.edited_at && message.body && (
        <span
          className={`mt-0.5 block text-[10px] text-muted ${
            own ? "text-right" : "text-left"
          }`}
        >
          edited
        </span>
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

/** True when two timestamps fall on the same calendar day (local time). */
function sameDay(aIso: string, bIso: string): boolean {
  try {
    const a = new Date(aIso);
    const b = new Date(bIso);
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    );
  } catch {
    return false;
  }
}

/** True when the message at i is part of a run AND the next message is also
 *  by the same user within ~5min — i.e. it's in the middle of a run, so its
 *  timestamp can be suppressed. */
function isMidRun(messages: ChatMessage[], i: number): boolean {
  const next = messages[i + 1];
  if (!next) return false;
  if (next.user_id !== messages[i].user_id) return false;
  return (
    new Date(next.created_at).getTime() -
      new Date(messages[i].created_at).getTime() <
    5 * 60_000
  );
}

/** Soft watercolor pill that breaks up the thread into Today / Yesterday /
 *  full date sections so long histories are skimmable. */
function DayDivider({ iso }: { iso: string }) {
  const label = (() => {
    try {
      const d = new Date(iso);
      const now = new Date();
      const ms = now.setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0);
      const days = Math.round(ms / 86_400_000);
      if (days === 0) return "Today";
      if (days === 1) return "Yesterday";
      return new Date(iso).toLocaleDateString(undefined, {
        weekday: "short",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "";
    }
  })();
  return (
    <div className="relative z-10 my-4 flex items-center justify-center">
      <span className="wc-frame rounded-full bg-surface px-3 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-muted shadow-card">
        {label}
      </span>
    </div>
  );
}

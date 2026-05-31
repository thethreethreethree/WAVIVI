"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

import {
  QuotedReply,
  ReplyActionSheet,
  ReplyPreview,
  type ReplyTarget,
  snippetFor,
} from "@/components/ui/reply-bits";
import { SusenAvatar } from "@/components/ui/susen-avatar";
import { useLongPress } from "@/hooks/use-long-press";
import {
  appendSusenTurnAction,
  loadSusenHistoryAction,
} from "@/lib/susen/actions";
import { SUSEN_WELCOME, type SusenTurn, susen } from "@/lib/susen/engine";
import { SUSEN, SUSEN_QUICK_PROMPTS } from "@/lib/susen/persona";

export default function SusenPage() {
  const [turns, setTurns] = useState<SusenTurn[]>([
    { role: "susen", text: SUSEN_WELCOME },
  ]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const [replyTarget, setReplyTarget] = useState<ReplyTarget | null>(null);
  const [actionTurnKey, setActionTurnKey] = useState<string | null>(null);
  const [highlightId, setHighlightId] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const turnRefs = useRef(new Map<string, HTMLDivElement>());

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [turns, thinking]);

  // Hydrate persisted history on mount. Admins get everything; everyone else
  // gets the last 24h. Signed-out users come back empty → keep the welcome.
  useEffect(() => {
    let cancelled = false;
    loadSusenHistoryAction()
      .then((history) => {
        if (cancelled || history.length === 0) return;
        setTurns([{ role: "susen", text: SUSEN_WELCOME }, ...history]);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  async function send(text: string) {
    const input = text.trim();
    if (!input || thinking) return;
    const reply = replyTarget?.id
      ? {
          id: replyTarget.id,
          snippet: replyTarget.snippet,
          authorName: replyTarget.authorName,
        }
      : null;
    setDraft("");
    setReplyTarget(null);
    // Build the user turn with the (unresolved) reply metadata so the
    // bubble shows the quote immediately. We'll stamp turn.id once the
    // server returns the inserted row id.
    const userTurn: SusenTurn = {
      role: "user",
      text: input,
      reply_to_id: reply?.id ?? null,
      reply_to_snippet: reply?.snippet ?? null,
      reply_to_author_name: reply?.authorName ?? null,
    };
    setTurns((t) => [...t, userTurn]);
    setThinking(true);
    void appendSusenTurnAction("user", input, reply)
      .then((insertedId) => {
        if (!insertedId) return;
        setTurns((t) => {
          const idx = t.lastIndexOf(userTurn);
          if (idx < 0) return t;
          const next = t.slice();
          next[idx] = { ...userTurn, id: insertedId };
          return next;
        });
      })
      .catch(() => {});
    const susenReply = await susen.respond(input, turns);
    setTimeout(() => {
      const susenTurn: SusenTurn = { role: "susen", text: susenReply.text };
      setTurns((t) => [...t, susenTurn]);
      setThinking(false);
      void appendSusenTurnAction("susen", susenReply.text)
        .then((insertedId) => {
          if (!insertedId) return;
          setTurns((t) => {
            const idx = t.lastIndexOf(susenTurn);
            if (idx < 0) return t;
            const next = t.slice();
            next[idx] = { ...susenTurn, id: insertedId };
            return next;
          });
        })
        .catch(() => {});
    }, 700);
  }

  function beginReply(turn: SusenTurn) {
    setActionTurnKey(null);
    setReplyTarget({
      id: turn.id ?? null,
      authorName: turn.role === "user" ? "You" : SUSEN.name,
      snippet: snippetFor(turn.text),
    });
    setTimeout(() => inputRef.current?.focus(), 0);
  }

  function scrollToTurn(id: string) {
    const el = turnRefs.current.get(id);
    if (!el) return;
    el.scrollIntoView({ block: "center", behavior: "smooth" });
    setHighlightId(id);
    window.setTimeout(() => {
      setHighlightId((cur) => (cur === id ? null : cur));
    }, 1400);
  }

  return (
    <div className="flex h-[calc(100dvh-6.75rem)] flex-col">
      <header className="flex items-center gap-3 border-b border-border px-5 pb-3 pt-[max(3rem,calc(env(safe-area-inset-top)+2rem))]">
        <Link href="/" aria-label="Back" className="text-foreground">
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
        <SusenAvatar className="h-10 w-10" />
        <span className="min-w-0">
          <span className="block text-base font-bold leading-tight">
            {SUSEN.name}
          </span>
          <span className="block text-sm text-muted">{SUSEN.tagline}</span>
        </span>
        <span className="ml-auto flex items-center gap-1.5 rounded-full bg-white/85 px-3 py-1 text-xs font-bold text-cool ring-1 ring-cool/30">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-70" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
          </span>
          Online
        </span>
      </header>

      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
        {turns.map((turn, i) => {
          const turnKey = turn.id ?? `idx:${i}`;
          return (
            <SusenBubble
              key={turnKey}
              turn={turn}
              registerRef={(el) => {
                if (turn.id) {
                  if (el) turnRefs.current.set(turn.id, el);
                  else turnRefs.current.delete(turn.id);
                }
              }}
              highlighted={turn.id != null && highlightId === turn.id}
              actionsOpen={actionTurnKey === turnKey}
              onOpenActions={() => setActionTurnKey(turnKey)}
              onCloseActions={() => setActionTurnKey(null)}
              onReply={() => beginReply(turn)}
              onQuoteTap={
                turn.reply_to_id
                  ? () => scrollToTurn(turn.reply_to_id!)
                  : undefined
              }
            />
          );
        })}

        {thinking && (
          <div className="flex items-end gap-2">
            <SusenAvatar className="h-7 w-7" />
            <div className="wc-frame flex gap-1 rounded-2xl rounded-bl-sm px-3.5 py-3">
              {[0, 1, 2].map((d) => (
                <motion.span
                  key={d}
                  className="h-1.5 w-1.5 rounded-full bg-muted"
                  animate={{ opacity: [0.3, 1, 0.3] }}
                  transition={{
                    duration: 1,
                    repeat: Infinity,
                    delay: d * 0.2,
                  }}
                />
              ))}
            </div>
          </div>
        )}
        <div ref={endRef} />
      </div>

      {/* Quick prompts */}
      <div className="flex gap-2 overflow-x-auto px-5 pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {SUSEN_QUICK_PROMPTS.map((p, i) => (
          <button
            key={p}
            type="button"
            onClick={() => send(p)}
            style={{ animationDelay: `${-i * 0.27}s` }}
            className={`wc-stop-motion-${(i % 5) + 1} wc-frame wc-frame-ghost shrink-0 rounded-full bg-white/70 px-4 py-2 text-sm font-semibold text-glow`}
          >
            {p}
          </button>
        ))}
      </div>

      {replyTarget && (
        <ReplyPreview
          target={replyTarget}
          onCancel={() => setReplyTarget(null)}
        />
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
        className="flex items-center gap-2 border-t border-border px-4 py-3"
      >
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={replyTarget ? "Reply…" : "Ask Susen anything…"}
          className="wc-frame flex-1 rounded-full bg-white/70 px-4 py-3
                     text-base outline-none placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={!draft.trim() || thinking}
          className="wc-frame wc-frame-sunset rounded-full px-5 py-3 text-base font-bold text-white disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}

function SusenBubble({
  turn,
  registerRef,
  highlighted,
  actionsOpen,
  onOpenActions,
  onCloseActions,
  onReply,
  onQuoteTap,
}: {
  turn: SusenTurn;
  registerRef: (el: HTMLDivElement | null) => void;
  highlighted: boolean;
  actionsOpen: boolean;
  onOpenActions: () => void;
  onCloseActions: () => void;
  onReply: () => void;
  onQuoteTap?: () => void;
}) {
  const own = turn.role === "user";
  const longPress = useLongPress(onOpenActions, { delayMs: 450 });
  const quote: ReplyTarget | null = turn.reply_to_snippet
    ? {
        id: turn.reply_to_id ?? null,
        snippet: turn.reply_to_snippet,
        authorName: turn.reply_to_author_name ?? "Traveler",
      }
    : null;
  return (
    <div
      className={`flex items-end gap-2 ${own ? "flex-row-reverse" : ""}`}
    >
      {!own && <SusenAvatar className="h-7 w-7" />}
      <div className="relative">
        <div
          ref={registerRef}
          {...longPress}
          className={`wc-frame max-w-[82%] px-4 py-3 text-base leading-snug transition-shadow ${
            own
              ? "wc-frame-sunset rounded-2xl rounded-br-sm text-white"
              : "rounded-2xl rounded-bl-sm bg-white/85 text-foreground"
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
          {turn.text}
        </div>
        {actionsOpen && (
          <div
            className={`absolute top-full mt-1 ${own ? "right-0" : "left-0"}`}
          >
            <ReplyActionSheet onReply={onReply} onClose={onCloseActions} />
          </div>
        )}
      </div>
    </div>
  );
}

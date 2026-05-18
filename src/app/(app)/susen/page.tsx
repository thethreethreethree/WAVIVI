"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";

import { SusenAvatar } from "@/components/ui/susen-avatar";
import { SUSEN } from "@/lib/susen/persona";
import { SUSEN_QUICK_PROMPTS } from "@/lib/susen/persona";
import { SUSEN_WELCOME, type SusenTurn, susen } from "@/lib/susen/engine";

export default function SusenPage() {
  const [turns, setTurns] = useState<SusenTurn[]>([
    { role: "susen", text: SUSEN_WELCOME },
  ]);
  const [draft, setDraft] = useState("");
  const [thinking, setThinking] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [turns, thinking]);

  async function send(text: string) {
    const input = text.trim();
    if (!input || thinking) return;
    setDraft("");
    setTurns((t) => [...t, { role: "user", text: input }]);
    setThinking(true);
    const reply = await susen.respond(input, turns);
    setTimeout(() => {
      setTurns((t) => [...t, { role: "susen", text: reply.text }]);
      setThinking(false);
    }, 700);
  }

  return (
    <div className="flex flex-1 flex-col">
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
        <SusenAvatar className="h-9 w-9" />
        <span className="min-w-0">
          <span className="block font-bold leading-tight">{SUSEN.name}</span>
          <span className="block text-xs text-muted">{SUSEN.tagline}</span>
        </span>
        <span className="wc-frame ml-auto rounded-full px-2.5 py-1 text-[10px] font-bold text-cool">
          ● Online
        </span>
      </header>

      <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-5 py-4">
        {turns.map((turn, i) => (
          <div
            key={i}
            className={`flex items-end gap-2 ${
              turn.role === "user" ? "flex-row-reverse" : ""
            }`}
          >
            {turn.role === "susen" && <SusenAvatar className="h-7 w-7" />}
            <div
              className={`wc-frame max-w-[80%] px-3.5 py-2.5 text-sm ${
                turn.role === "user"
                  ? "wc-frame-sunset rounded-2xl rounded-br-sm text-white"
                  : "rounded-2xl rounded-bl-sm text-foreground"
              }`}
            >
              {turn.text}
            </div>
          </div>
        ))}

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
            className={`wc-stop-motion-${(i % 5) + 1} wc-frame wc-frame-ghost shrink-0 rounded-full px-3.5 py-1.5 text-xs font-semibold text-glow`}
          >
            {p}
          </button>
        ))}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          send(draft);
        }}
        className="flex items-center gap-2 border-t border-border px-4 py-3"
      >
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask Susen anything…"
          className="wc-frame flex-1 rounded-full bg-transparent px-4 py-2.5
                     text-sm outline-none placeholder:text-muted"
        />
        <button
          type="submit"
          disabled={!draft.trim() || thinking}
          className="wc-frame wc-frame-sunset rounded-full px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40"
        >
          Send
        </button>
      </form>
    </div>
  );
}

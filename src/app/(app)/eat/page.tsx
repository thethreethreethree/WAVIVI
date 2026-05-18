"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "motion/react";

/** Where to Eat is powered by our sister company, YumYumPo. */
const YUMYUMPO_URL = "https://yumyumpo.com/discover";
const REDIRECT_MS = 2800;

/* YumYumPo brand — matched to yumyumpo.com. */
const YY_YELLOW = "#FFD000";
const YY_BLACK = "#111111";

export default function EatHandoffPage() {
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const id = setTimeout(() => {
      setLeaving(true);
      window.location.href = YUMYUMPO_URL;
    }, REDIRECT_MS);
    return () => clearTimeout(id);
  }, []);

  return (
    <div
      className="font-[family-name:var(--font-yumyumpo)] relative flex flex-1
                 flex-col items-center justify-center overflow-hidden px-8"
      style={{ background: "#FFFCEF", color: YY_BLACK }}
    >
      {/* Warm YumYumPo glow */}
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(circle at 50% 38%, rgba(255,208,0,0.28), transparent 64%)",
        }}
        aria-hidden
      />

      <p className="relative text-[11px] font-bold uppercase tracking-[0.28em]">
        Handing you over to
      </p>

      {/* From-Travejor cue */}
      <div className="relative mt-5 flex items-center gap-2.5 opacity-80">
        <span
          className="flex h-9 w-9 items-center justify-center rounded-full"
          style={{ background: YY_BLACK }}
        >
          <svg viewBox="0 0 24 24" className="h-4 w-4" fill="#f7941d" aria-hidden>
            <path d="M2 12l19-9-9 19-2-8-8-2z" />
          </svg>
        </span>
        <div className="relative h-px w-12">
          <div
            className="absolute inset-0 border-t-2 border-dashed"
            style={{ borderColor: "rgba(17,17,17,0.25)" }}
          />
          <motion.span
            className="absolute -top-1 h-2 w-2 rounded-full"
            style={{ background: YY_YELLOW }}
            initial={{ left: "0%" }}
            animate={{ left: "100%" }}
            transition={{ duration: 1.1, repeat: Infinity, ease: "easeInOut" }}
          />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider">
          YumYumPo
        </span>
      </div>

      {/* Real YumYumPo logo */}
      <motion.div
        className="relative mt-6"
        initial={{ scale: 0.7, opacity: 0, y: 8 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
      >
        <Image
          src="/yumyumpo-logo.webp"
          alt="YumYumPo"
          width={208}
          height={208}
          priority
          className="h-52 w-52 object-contain"
        />
      </motion.div>

      <p className="relative -mt-2 text-center text-sm font-medium text-black/60">
        Restaurants by mood + buzz
      </p>

      {/* Progress */}
      <div
        className="relative mt-6 h-1.5 w-48 overflow-hidden rounded-full"
        style={{ background: "rgba(17,17,17,0.12)" }}
      >
        <motion.div
          className="h-full rounded-full"
          style={{ background: YY_YELLOW }}
          initial={{ width: "0%" }}
          animate={{ width: "100%" }}
          transition={{ duration: REDIRECT_MS / 1000, ease: "easeInOut" }}
        />
      </div>
      <p className="relative mt-3 text-xs font-semibold text-black/55">
        {leaving ? "Opening YumYumPo…" : "Taking you there…"}
      </p>

      <div className="relative mt-7 flex flex-col items-center gap-3">
        <a
          href={YUMYUMPO_URL}
          className="rounded-full border-2 px-6 py-2.5 text-sm font-bold active:scale-95"
          style={{
            background: YY_YELLOW,
            borderColor: YY_YELLOW,
            color: YY_BLACK,
          }}
        >
          Go to YumYumPo now
        </a>
        <Link
          href="/"
          className="flex items-center gap-1.5 rounded-full border-2 px-5 py-2
                     text-sm font-bold active:scale-95"
          style={{ borderColor: "rgba(17,17,17,0.2)", color: YY_BLACK }}
        >
          <span aria-hidden>‹</span> Back to Travejor
        </Link>
      </div>
    </div>
  );
}

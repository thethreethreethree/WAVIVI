"use client";

import { useState } from "react";

/** Local-only RSVP toggle, used on event details. */
export function RsvpButton({ label = "RSVP — I'm in" }: { label?: string }) {
  const [going, setGoing] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setGoing((g) => !g)}
      className={`w-full rounded-2xl py-3.5 text-center font-bold shadow-card transition-all active:scale-[0.98] ${
        going
          ? "border border-cool bg-cool/10 text-cool"
          : "bg-sunset text-white"
      }`}
    >
      {going ? "You're going ✓" : label}
    </button>
  );
}

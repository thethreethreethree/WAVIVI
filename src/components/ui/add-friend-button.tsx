"use client";

import { useState } from "react";

/** Local-only "Add Friend" toggle on user profiles. */
export function AddFriendButton() {
  const [added, setAdded] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setAdded((a) => !a)}
      className={`wc-frame rounded-full px-5 py-2 text-sm font-bold transition-colors active:scale-[0.98] ${
        added
          ? "wc-frame-orange text-glow"
          : "wc-frame-sunset text-white"
      }`}
    >
      {added ? "Friends ✓" : "Add Friend"}
    </button>
  );
}

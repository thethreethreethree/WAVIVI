"use client";

import { useState } from "react";

/** Local-only "Add Friend" toggle on user profiles. */
export function AddFriendButton() {
  const [added, setAdded] = useState(false);

  return (
    <button
      type="button"
      onClick={() => setAdded((a) => !a)}
      className={`rounded-full px-5 py-2 text-sm font-semibold transition-colors ${
        added
          ? "border border-glow text-glow"
          : "bg-glow text-white"
      }`}
    >
      {added ? "Friends ✓" : "Add Friend"}
    </button>
  );
}

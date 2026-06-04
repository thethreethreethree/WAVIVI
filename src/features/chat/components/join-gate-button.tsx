"use client";

import Image from "next/image";
import { useState } from "react";

import { SignupPromptModal } from "@/components/ui/signup-prompt-modal";

/**
 * Anonymous-side counterpart to JoinGroupButton — renders the same
 * styled "plane" CTA, but tapping it opens the sign-up modal instead
 * of dropping the visitor straight on /login. The page knows the
 * visitor isn't signed in (server-side `user === null` check) and
 * forwards `groupId` so the modal's `next` lands them back on the
 * meet detail after sign-up, where the real JoinGroupButton then
 * takes over.
 *
 * Server-side `joinGroup` keeps its own auth guard
 * (src/features/chat/actions.ts:28) — this is UX, not security.
 */
export function JoinGateButton({ groupId }: { groupId: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="wc-frame wc-frame-sunset mt-5 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-center font-bold text-white active:scale-[0.98]"
      >
        <Image
          src="/icons/orange/plane.png"
          alt=""
          width={44}
          height={44}
          className="h-5 w-5"
          aria-hidden
        />
        Sign up to join the chat
      </button>
      <SignupPromptModal
        open={open}
        onClose={() => setOpen(false)}
        headline="Join Wondavu to chat with the group"
        subhead="Free account — sync your trips, message other travelers, get to the meet-up together."
        returnTo={`/meet/${groupId}`}
      />
    </>
  );
}

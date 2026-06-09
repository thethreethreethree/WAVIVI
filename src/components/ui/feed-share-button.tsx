"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

import { SignupPromptModal } from "@/components/ui/signup-prompt-modal";
import { createClient } from "@/lib/supabase/client";

/**
 * Anonymous-aware Share button on the Travelers Feed header.
 *
 *   - Signed-out → opens the sign-up modal so they convert before
 *     reaching the composer.
 *   - Signed-in  → routes straight to the DVS composer at
 *     /profile/share-vibe (Phase 2 — compose is real now).
 *
 * Replaces the old "compose coming soon" stub. The compose flow is
 * the 5-question Daily Vibe Share form; once submitted, the share
 * lands on the feed sections this button sits above.
 */
export function FeedShareButton() {
  const router = useRouter();
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [signupOpen, setSignupOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const supabase = createClient();
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!cancelled) setIsAuthed(Boolean(data.session));
      })
      .catch(() => {
        if (!cancelled) setIsAuthed(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function onClick(): void {
    if (isAuthed === false) {
      setSignupOpen(true);
      return;
    }
    // null = still resolving session. Treat as "wait" so a quick tap
    // from a signed-in user on a slow network isn't auto-gated.
    if (isAuthed === true) router.push("/profile/share-vibe");
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        aria-label="Share today's vibe"
        className="wc-frame flex h-12 w-12 items-center justify-center rounded-full active:scale-95"
      >
        <span
          className="inline-block"
          style={{ animation: "balloonFloat 6s ease-in-out infinite" }}
        >
          <Image
            src="/decor/balloon-floater.png"
            alt=""
            width={40}
            height={40}
            className="h-8 w-8 object-contain"
          />
        </span>
      </button>
      <SignupPromptModal
        open={signupOpen}
        onClose={() => setSignupOpen(false)}
        headline="Sign up to share your vibe"
        subhead="Five quick questions on your day — tips and costs that help the next traveler who lands here."
        returnTo="/profile/share-vibe"
      />
    </>
  );
}

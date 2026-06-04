"use client";

import Image from "next/image";
import { useEffect, useState } from "react";

import { SignupPromptModal } from "@/components/ui/signup-prompt-modal";
import { createClient } from "@/lib/supabase/client";

/**
 * Anonymous-aware Share button for the Travelers Feed header. Until
 * the traveller-side compose flow ships (Phase 2, alongside
 * Login-with-Instagram), this button does one of two things:
 *
 *   - Signed-out → opens the sign-up modal so they convert before
 *     the compose surface lands.
 *   - Signed-in  → shows an interim "Compose coming soon" hint so
 *     the tap registers as deliberate, not broken.
 *
 * Server-side gates (createFeedPost via the admin actions) stay in
 * place — this only owns the UX wrapper on the public surface.
 */
export function FeedShareButton() {
  const [isAuthed, setIsAuthed] = useState<boolean | null>(null);
  const [signupOpen, setSignupOpen] = useState(false);
  const [comingSoonOpen, setComingSoonOpen] = useState(false);

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
    if (isAuthed === true) setComingSoonOpen(true);
  }

  return (
    <>
      <button
        type="button"
        onClick={onClick}
        aria-label="Share to feed"
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
        headline="Sign up to share your trip"
        subhead="Post photos and notes from where you are — they show up in the regional feed for other travelers."
        returnTo="/feed"
      />
      {comingSoonOpen && (
        <div
          role="dialog"
          aria-modal
          className="fixed inset-0 z-[140] flex items-end justify-center bg-black/40 sm:items-center"
          onClick={() => setComingSoonOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="wc-frame relative mx-3 mb-[7.5rem] w-full max-w-sm rounded-3xl bg-background p-5 text-center sm:mb-0"
          >
            <h2 className="text-lg font-bold tracking-tight">
              Compose is on the way
            </h2>
            <p className="mt-2 text-sm text-muted">
              Traveler-side posting lands with the Instagram connect flow.
              For now your admin can post on your region&apos;s behalf
              via the Feed admin console.
            </p>
            <button
              type="button"
              onClick={() => setComingSoonOpen(false)}
              className="mt-4 rounded-full bg-foreground/10 px-4 py-2 text-sm font-bold text-foreground hover:bg-foreground/15"
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
}

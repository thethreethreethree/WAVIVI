import Link from "next/link";

/**
 * Verification gate shown when a non-verified traveler reaches Where to
 * Next. Sends them to /profile/edit#instagram-verify where the existing
 * IG-bio-token flow lives.
 */
export function VerificationGate() {
  return (
    <div className="flex flex-1 flex-col gap-6 px-5 pb-8 pt-[max(2.5rem,calc(env(safe-area-inset-top)+1.5rem))]">
      <header>
        <p className="text-xs font-bold uppercase tracking-wide text-glow">
          Where to Next
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          Verify your account to unlock
        </h1>
      </header>

      <div className="wc-frame rounded-2xl p-5">
        <p className="text-sm leading-6 text-foreground/90">
          Where to Next builds a plan from your answers and matches you with
          real travelers heading the same way. To keep matches genuine, this
          tool is open only to verified travelers.
        </p>
        <p className="mt-3 text-sm leading-6 text-foreground/90">
          You verify by linking your Instagram and confirming a one-time
          token in your bio — takes under a minute and no password is
          shared.
        </p>
      </div>

      <Link
        href="/profile/edit"
        className="wc-frame wc-frame-sunset block rounded-2xl px-5 py-3 text-center text-sm font-bold text-white active:scale-[0.98]"
      >
        Verify my account ›
      </Link>

      <Link
        href="/"
        className="wc-frame wc-frame-orange-white self-center rounded-full px-5 py-2 text-xs font-semibold text-glow"
      >
        Back to home
      </Link>
    </div>
  );
}

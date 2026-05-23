import { BackButton } from "./back-button";

/**
 * Sub-screen header — a back arrow, a title, and an optional right action.
 * `accent` renders the title in the brand orange (Wondavu style).
 *
 * The back arrow uses real browser history (router.back()) so navigating
 * deeper into a section and tapping back returns to the exact previous view.
 * `back` is the fallback target when there's no history (direct URL load).
 *
 * Visual treatment is intentionally minimal — a small foreground chevron,
 * matching the back arrow used inside the chat thread. We use the same
 * spare look on every back button across the app for consistency.
 */
export function ScreenHeader({
  title,
  back = "/",
  accent = false,
  action,
}: {
  title: string;
  back?: string;
  accent?: boolean;
  action?: React.ReactNode;
}) {
  return (
    <header className="flex items-center gap-3 px-5 pb-3 pt-[max(3rem,calc(env(safe-area-inset-top)+2rem))]">
      <BackButton
        fallback={back}
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-foreground transition-colors hover:bg-foreground/5 active:scale-95"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
        >
          <path d="M15 18l-6-6 6-6" />
        </svg>
      </BackButton>
      <h1
        className={`flex-1 text-xl font-bold tracking-tight ${
          accent ? "text-glow" : "text-foreground"
        }`}
      >
        <span className="wc-underline">{title}</span>
      </h1>
      {action}
    </header>
  );
}

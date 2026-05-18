import Link from "next/link";

/**
 * Sub-screen header — a back arrow, a title, and an optional right action.
 * `accent` renders the title in the brand orange (Travejor style).
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
    <header className="flex items-center gap-3 px-5 pb-3 pt-4">
      <Link
        href={back}
        aria-label="Back"
        className="flex h-8 w-8 items-center justify-center rounded-full
                   text-foreground transition-colors hover:bg-surface-elevated"
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
      </Link>
      <h1
        className={`flex-1 text-xl font-bold tracking-tight ${
          accent ? "text-glow" : "text-foreground"
        }`}
      >
        {title}
      </h1>
      {action}
    </header>
  );
}

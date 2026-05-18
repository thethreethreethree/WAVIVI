import Link from "next/link";

const COLUMNS = [
  {
    title: "Discover",
    links: [
      { href: "/discover/stays", label: "Where to Stay" },
      { href: "/discover/experiences", label: "What to Do" },
      { href: "/discover/events", label: "Events Nearby" },
    ],
  },
  {
    title: "Partners",
    links: [
      { href: "/list-with-travejor", label: "List with Travejor" },
      { href: "/list-with-travejor", label: "Partner support" },
      { href: "/admin", label: "Admin console" },
    ],
  },
  {
    title: "Travejor",
    links: [
      { href: "/", label: "Get the app" },
      { href: "/discover", label: "How it works" },
    ],
  },
];

/** Footer for the Travejor partner webapp. */
export function WebFooter() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-5 py-10 md:grid-cols-4">
        <div className="col-span-2 md:col-span-1">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="#f7941d">
              <path d="M2 12l19-9-9 19-2-8-8-2z" />
            </svg>
            <span className="font-mono text-sm font-bold uppercase tracking-[0.22em]">
              Travejor
            </span>
          </div>
          <p className="mt-3 max-w-xs text-sm text-muted">
            Where stays, experiences, and events meet the travelers looking
            for them.
          </p>
        </div>

        {COLUMNS.map((col) => (
          <div key={col.title}>
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted">
              {col.title}
            </h3>
            <ul className="mt-3 flex flex-col gap-2">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link
                    href={l.href}
                    className="text-sm text-foreground/80 transition-colors hover:text-foreground"
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <div className="border-t border-border">
        <p className="mx-auto max-w-6xl px-5 py-4 text-xs text-muted">
          © {new Date().getFullYear()} Travejor. Meet. Vibe. Move.
        </p>
      </div>
    </footer>
  );
}

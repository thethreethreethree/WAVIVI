import Link from "next/link";

export const dynamic = "force-dynamic";

/**
 * Experiences admin — placeholder until the `experiences` table ships.
 * The schema will mirror `stays` (region-scoped, partner-claimable, CSV
 * importable), so the dashboard pattern is already proven; we just
 * haven't generated the table yet.
 */
export default function ExperiencesAdminPage() {
  return (
    <div className="mx-auto max-w-3xl px-5 py-12">
      <header>
        <p className="text-xs font-bold uppercase tracking-wide text-muted">
          Partners
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          Experiences
        </h1>
        <p className="mt-1 text-sm text-muted">
          Tours, boat trips, classes — partner-led activities.
        </p>
      </header>

      <div className="mt-8 rounded-2xl bg-surface p-8 text-center shadow-card ring-1 ring-border">
        <span className="text-4xl" aria-hidden>
          🌊
        </span>
        <h2 className="mt-3 text-lg font-bold">Coming soon</h2>
        <p className="mx-auto mt-2 max-w-md text-sm text-muted">
          The Experiences admin uses the same pattern as Stays: region
          scope, CSV import, manual add, partner self-edit via the future
          partner dashboard. Schema lands in a future migration —
          everything else is ready to plug in.
        </p>
        <div className="mt-5 flex justify-center gap-2">
          <Link
            href="/admin/partners"
            className="rounded-full bg-foreground/10 px-4 py-2 text-sm font-bold text-foreground hover:bg-foreground/15"
          >
            ← Partners
          </Link>
          <Link
            href="/admin/stays"
            className="rounded-full bg-sunset px-4 py-2 text-sm font-bold text-white"
          >
            See Stays admin
          </Link>
        </div>
      </div>
    </div>
  );
}

import { phases, type PhaseStatus } from "@/config/phases";
import { siteConfig } from "@/config/site";

const statusStyles: Record<PhaseStatus, string> = {
  done: "border-cool/40 bg-cool/10 text-cool",
  "in-progress": "border-heat/40 bg-heat/10 text-heat",
  planned: "border-border bg-surface text-muted",
};

const statusLabel: Record<PhaseStatus, string> = {
  done: "Done",
  "in-progress": "In progress",
  planned: "Planned",
};

export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center px-6 py-20">
      <div className="w-full max-w-2xl">
        <header className="mb-12">
          <span className="text-xs font-mono uppercase tracking-[0.3em] text-glow">
            {siteConfig.name}
          </span>
          <h1 className="mt-3 text-4xl font-semibold tracking-tight">
            {siteConfig.tagline}
          </h1>
          <p className="mt-3 max-w-md text-muted">{siteConfig.description}</p>
        </header>

        <section>
          <h2 className="mb-4 text-sm font-medium uppercase tracking-widest text-muted">
            Roadmap
          </h2>
          <ol className="flex flex-col gap-2">
            {phases.map((phase) => (
              <li
                key={phase.id}
                className="flex items-center gap-4 rounded-xl border border-border bg-surface px-4 py-3"
              >
                <span className="w-6 shrink-0 text-center font-mono text-sm text-muted">
                  {phase.id}
                </span>
                <span className="flex-1 font-medium">{phase.goal}</span>
                <span
                  className={`shrink-0 rounded-full border px-2.5 py-0.5 text-xs font-medium ${statusStyles[phase.status]}`}
                >
                  {statusLabel[phase.status]}
                </span>
              </li>
            ))}
          </ol>
        </section>

        <footer className="mt-12 text-xs text-muted">
          Phase 4 — Traveler Discovery · Next.js · Supabase · Mapbox
        </footer>
      </div>
    </main>
  );
}

import Link from "next/link";

import { StatCard } from "@/components/admin/stat-card";
import { loadDashboard } from "@/lib/admin/dashboard";

// Force a fresh fetch every render — the dashboard is the ops "is the
// app up?" surface, so we never want to serve cached aggregates that
// might be 30 minutes old when something's burning.
export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const { pulse, stats, topGroups, regionActivity } = await loadDashboard();
  const peak = Math.max(
    1,
    ...regionActivity.map((r) => r.travelers),
  );

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted">
          Live view of the Wondavu traveler ecosystem.
        </p>
      </div>

      {/* Platform pulse */}
      <div className="rounded-2xl bg-sunset p-4 text-white shadow-card">
        <p className="text-xs font-bold uppercase tracking-wider text-white/80">
          Platform pulse
        </p>
        <div className="mt-3 grid grid-cols-4 gap-2 text-center">
          {[
            { v: pulse.newToday.toLocaleString(), l: "New today" },
            { v: pulse.meetupsToday.toLocaleString(), l: "Events today" },
            { v: pulse.reportsOpen.toLocaleString(), l: "Open reports" },
            { v: pulse.susenAssists.toLocaleString(), l: "Susen (24h)" },
          ].map((m) => (
            <div key={m.l}>
              <p className="text-lg font-bold">{m.v}</p>
              <p className="text-[10px] text-white/85">{m.l}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Key metrics */}
      <section>
        <h2 className="mb-2 text-sm font-bold">Key metrics</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {stats.map((s) => (
            <StatCard key={s.label} stat={s} />
          ))}
        </div>
      </section>

      {/* Top groups */}
      <section>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-sm font-bold">Top group chats</h2>
          <Link href="/admin/groups" className="text-xs font-medium text-glow">
            Manage
          </Link>
        </div>
        {topGroups.length === 0 ? (
          <p className="rounded-2xl bg-surface px-4 py-6 text-center text-sm text-muted shadow-card ring-1 ring-border">
            No group chats yet — the count zeroes out until travelers
            start joining.
          </p>
        ) : (
          <ul className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-border">
            {topGroups.map((g, i) => (
              <li
                key={g.id}
                className={`flex items-center gap-3 px-4 py-3 ${
                  i > 0 ? "border-t border-border" : ""
                }`}
              >
                <span className="w-4 font-mono text-xs text-muted">
                  {i + 1}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">
                    {g.name}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    {g.category ?? "—"}
                  </span>
                </span>
                <span className="shrink-0 text-xs font-bold text-glow">
                  {g.memberCount} member{g.memberCount === 1 ? "" : "s"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Region activity */}
      <section>
        <h2 className="mb-2 text-sm font-bold">Active events by region</h2>
        {regionActivity.length === 0 ? (
          <p className="rounded-2xl bg-surface px-4 py-6 text-center text-sm text-muted shadow-card ring-1 ring-border">
            No active events to chart yet.
          </p>
        ) : (
          <div className="flex flex-col gap-2.5 rounded-2xl bg-surface p-4 shadow-card ring-1 ring-border">
            {regionActivity.map((r) => (
              <div key={r.region}>
                <div className="mb-1 flex justify-between text-xs">
                  <span className="font-medium">{r.region}</span>
                  <span className="text-muted">{r.travelers} events</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-border">
                  <div
                    className="h-full rounded-full bg-glow"
                    style={{ width: `${(r.travelers / peak) * 100}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

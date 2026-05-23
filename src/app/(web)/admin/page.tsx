import Link from "next/link";

import { StatCard } from "@/components/admin/stat-card";
import {
  adminStats,
  platformPulse,
  regionActivity,
  topGroups,
} from "@/lib/admin/data";

export default function AdminDashboard() {
  const peak = Math.max(...regionActivity.map((r) => r.travelers));

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
            { v: platformPulse.online.toLocaleString(), l: "Online now" },
            { v: platformPulse.meetupsToday, l: "Meetups today" },
            { v: platformPulse.reportsOpen, l: "Open reports" },
            { v: platformPulse.susenInterventions, l: "Susen assists" },
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
          {adminStats.map((s) => (
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
        <ul className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-border">
          {topGroups.map((g, i) => (
            <li
              key={g.id}
              className={`flex items-center gap-3 px-4 py-3 ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <span className="w-4 font-mono text-xs text-muted">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {g.name}
                </span>
                <span className="block truncate text-xs text-muted">
                  {g.category} · {g.distance}
                </span>
              </span>
              <span className="shrink-0 text-xs font-bold text-glow">
                {g.travelerCount} active
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Region activity */}
      <section>
        <h2 className="mb-2 text-sm font-bold">Vibe activity by region</h2>
        <div className="flex flex-col gap-2.5 rounded-2xl bg-surface p-4 shadow-card ring-1 ring-border">
          {regionActivity.map((r) => (
            <div key={r.region}>
              <div className="mb-1 flex justify-between text-xs">
                <span className="font-medium">{r.region}</span>
                <span className="text-muted">{r.travelers} travelers</span>
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
      </section>
    </div>
  );
}

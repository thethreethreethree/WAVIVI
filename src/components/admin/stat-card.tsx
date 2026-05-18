import type { AdminStat } from "@/lib/admin/data";

/** Compact analytics tile for the admin dashboard. */
export function StatCard({ stat }: { stat: AdminStat }) {
  const up = stat.delta >= 0;
  return (
    <div className="rounded-2xl bg-surface p-3.5 shadow-card ring-1 ring-border">
      <p className="text-xs font-medium text-muted">{stat.label}</p>
      <p className="mt-1 text-xl font-bold tracking-tight">{stat.value}</p>
      <div className="mt-1 flex items-center gap-1.5">
        <span
          className={`rounded-full px-1.5 py-0.5 text-[10px] font-bold ${
            up ? "bg-cool/15 text-cool" : "bg-heat/15 text-heat"
          }`}
        >
          {up ? "▲" : "▼"} {Math.abs(stat.delta)}%
        </span>
        <span className="truncate text-[10px] text-muted">{stat.hint}</span>
      </div>
    </div>
  );
}

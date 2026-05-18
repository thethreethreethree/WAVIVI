import { auditLog, errorLog } from "@/lib/admin/data";

export default function AdminLogsPage() {
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Logs</h1>
        <p className="text-sm text-muted">
          System health and the admin audit trail.
        </p>
      </div>

      {/* Error logs */}
      <section>
        <h2 className="mb-2 text-sm font-bold">Error logs</h2>
        <ul className="flex flex-col gap-2">
          {errorLog.map((e) => (
            <li
              key={e.id}
              className="flex items-start gap-3 rounded-2xl bg-surface p-3.5 shadow-card ring-1 ring-border"
            >
              <span
                className={`mt-0.5 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${
                  e.level === "error"
                    ? "bg-heat/15 text-heat"
                    : "bg-glow/15 text-glow"
                }`}
              >
                {e.level}
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm">{e.message}</span>
                <span className="block text-[11px] text-muted">{e.time}</span>
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Audit trail */}
      <section>
        <h2 className="mb-2 text-sm font-bold">Admin audit trail</h2>
        <ul className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-border">
          {auditLog.map((a, i) => (
            <li
              key={a.id}
              className={`px-4 py-3 ${i > 0 ? "border-t border-border" : ""}`}
            >
              <p className="text-sm">{a.action}</p>
              <p className="mt-0.5 text-[11px] text-muted">
                by <span className="font-semibold">{a.admin}</span> · {a.time}
              </p>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

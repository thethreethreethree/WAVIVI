"use client";

import { useState } from "react";

import {
  type ReportStatus,
  moderationReports,
  verificationRequests,
} from "@/lib/admin/data";

const STATUS_STYLE: Record<ReportStatus, string> = {
  open: "bg-heat/15 text-heat",
  reviewing: "bg-glow/15 text-glow",
  resolved: "bg-cool/15 text-cool",
};

export default function AdminModerationPage() {
  const [reports, setReports] = useState(moderationReports);
  const [handled, setHandled] = useState<Record<string, "approved" | "denied">>(
    {},
  );

  function setStatus(id: string, status: ReportStatus) {
    setReports((rs) => rs.map((r) => (r.id === id ? { ...r, status } : r)));
  }

  const openCount = reports.filter((r) => r.status !== "resolved").length;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Moderation</h1>
        <p className="text-sm text-muted">
          {openCount} open · keep the community safe and group-first.
        </p>
      </div>

      {/* Reports queue */}
      <section>
        <h2 className="mb-2 text-sm font-bold">Reports queue</h2>
        <ul className="flex flex-col gap-2">
          {reports.map((r) => (
            <li
              key={r.id}
              className="rounded-2xl bg-surface p-3.5 shadow-card ring-1 ring-border"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{r.subject}</p>
                  <p className="text-xs text-muted">{r.reason}</p>
                  <p className="mt-0.5 text-[11px] text-muted">
                    Reported by {r.reportedBy} · {r.time}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${STATUS_STYLE[r.status]}`}
                >
                  {r.status}
                </span>
              </div>
              {r.status !== "resolved" && (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => setStatus(r.id, "reviewing")}
                    className="flex-1 rounded-lg border border-border py-1.5 text-xs font-bold text-muted transition-colors hover:text-foreground"
                  >
                    Mark reviewing
                  </button>
                  <button
                    type="button"
                    onClick={() => setStatus(r.id, "resolved")}
                    className="flex-1 rounded-lg bg-cool/10 py-1.5 text-xs font-bold text-cool"
                  >
                    Resolve
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      {/* Verification requests */}
      <section>
        <h2 className="mb-2 text-sm font-bold">Verification requests</h2>
        <ul className="flex flex-col gap-2">
          {verificationRequests.map((v) => (
            <li
              key={v.id}
              className="flex items-center gap-3 rounded-2xl bg-surface p-3.5 shadow-card ring-1 ring-border"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">
                  {v.name}
                </span>
                <span className="block truncate text-xs text-muted">
                  @{v.username} · {v.submitted}
                </span>
              </span>
              {handled[v.id] ? (
                <span
                  className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${
                    handled[v.id] === "approved"
                      ? "bg-cool/15 text-cool"
                      : "bg-heat/15 text-heat"
                  }`}
                >
                  {handled[v.id] === "approved" ? "✓ Approved" : "Denied"}
                </span>
              ) : (
                <span className="flex shrink-0 gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setHandled((h) => ({ ...h, [v.id]: "denied" }))
                    }
                    className="rounded-lg border border-border px-2.5 py-1.5 text-xs font-bold text-muted"
                  >
                    Deny
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setHandled((h) => ({ ...h, [v.id]: "approved" }))
                    }
                    className="bg-sunset rounded-lg px-2.5 py-1.5 text-xs font-bold text-white"
                  >
                    Approve
                  </button>
                </span>
              )}
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

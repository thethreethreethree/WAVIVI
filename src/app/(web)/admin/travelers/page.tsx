"use client";

import Image from "next/image";
import { useMemo, useState } from "react";

import { members } from "@/lib/travejor/members";

type Status = "active" | "suspended";

export default function AdminTravelersPage() {
  const [query, setQuery] = useState("");
  const [statuses, setStatuses] = useState<Record<string, Status>>({});
  const [verified, setVerified] = useState<Record<string, boolean>>(
    Object.fromEntries(members.map((m) => [m.id, m.verified])),
  );

  const rows = useMemo(
    () =>
      members.filter(
        (m) =>
          m.name.toLowerCase().includes(query.toLowerCase()) ||
          m.username.toLowerCase().includes(query.toLowerCase()),
      ),
    [query],
  );

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Travelers</h1>
        <p className="text-sm text-muted">
          {members.length} accounts · verify, suspend, and review.
        </p>
      </div>

      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search travelers…"
        className="rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm
                   outline-none placeholder:text-muted focus-visible:border-glow"
      />

      <ul className="flex flex-col gap-2">
        {rows.map((m) => {
          const status: Status = statuses[m.id] ?? "active";
          const isVerified = verified[m.id];
          return (
            <li
              key={m.id}
              className="rounded-2xl bg-surface p-3.5 shadow-card ring-1 ring-border"
            >
              <div className="flex items-center gap-3">
                <span className="relative h-10 w-10 shrink-0 overflow-hidden rounded-full">
                  <Image
                    src={m.avatar}
                    alt={m.name}
                    fill
                    sizes="40px"
                    className="object-cover"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1.5">
                    <span className="truncate text-sm font-semibold">
                      {m.name}
                    </span>
                    {isVerified && (
                      <span className="text-[10px] font-bold text-cool">✓</span>
                    )}
                  </span>
                  <span className="block truncate text-xs text-muted">
                    @{m.username}
                  </span>
                </span>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                    status === "active"
                      ? "bg-cool/15 text-cool"
                      : "bg-heat/15 text-heat"
                  }`}
                >
                  {status}
                </span>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setVerified((v) => ({ ...v, [m.id]: !v[m.id] }))
                  }
                  className="flex-1 rounded-lg border border-border py-1.5 text-xs font-bold text-muted transition-colors hover:text-foreground"
                >
                  {isVerified ? "Remove verification" : "Verify"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setStatuses((s) => ({
                      ...s,
                      [m.id]: status === "active" ? "suspended" : "active",
                    }))
                  }
                  className={`flex-1 rounded-lg py-1.5 text-xs font-bold ${
                    status === "active"
                      ? "bg-heat/10 text-heat"
                      : "bg-cool/10 text-cool"
                  }`}
                >
                  {status === "active" ? "Suspend" : "Reinstate"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

"use client";

import { useState } from "react";

import { travelGroups } from "@/lib/travejor/groups";

export default function AdminGroupsPage() {
  const [featured, setFeatured] = useState<Record<string, boolean>>({});
  const [archived, setArchived] = useState<Record<string, boolean>>({});

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Group chats</h1>
        <p className="text-sm text-muted">
          {travelGroups.length} active groups · feature or archive.
        </p>
      </div>

      <ul className="flex flex-col gap-2">
        {travelGroups.map((g) => {
          const isArchived = archived[g.id];
          return (
            <li
              key={g.id}
              className={`rounded-2xl bg-surface p-3.5 shadow-card ring-1 ring-border ${
                isArchived ? "opacity-60" : ""
              }`}
            >
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{g.name}</p>
                  <p className="truncate text-xs text-muted">
                    {g.category} · {g.travelerCount} travelers · {g.distance}
                  </p>
                </div>
                {featured[g.id] && (
                  <span className="shrink-0 rounded-full bg-glow/15 px-2 py-0.5 text-[10px] font-bold text-glow">
                    Featured
                  </span>
                )}
              </div>
              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setFeatured((f) => ({ ...f, [g.id]: !f[g.id] }))
                  }
                  className="flex-1 rounded-lg border border-border py-1.5 text-xs font-bold text-muted transition-colors hover:text-foreground"
                >
                  {featured[g.id] ? "Unfeature" : "Feature"}
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setArchived((a) => ({ ...a, [g.id]: !a[g.id] }))
                  }
                  className={`flex-1 rounded-lg py-1.5 text-xs font-bold ${
                    isArchived
                      ? "bg-cool/10 text-cool"
                      : "bg-heat/10 text-heat"
                  }`}
                >
                  {isArchived ? "Restore" : "Archive"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

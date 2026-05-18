"use client";

import Image from "next/image";
import { useState } from "react";

import { travejorEvents } from "@/lib/travejor/events";

export default function AdminEventsPage() {
  const [approved, setApproved] = useState<Record<string, boolean>>(
    Object.fromEntries(travejorEvents.map((e) => [e.id, true])),
  );
  const [removed, setRemoved] = useState<Record<string, boolean>>({});

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Events</h1>
        <p className="text-sm text-muted">
          {travejorEvents.length} live events · approve, edit, or remove.
        </p>
      </div>

      <ul className="flex flex-col gap-2.5">
        {travejorEvents.map((e) => {
          const isRemoved = removed[e.id];
          return (
            <li
              key={e.id}
              className={`overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-border ${
                isRemoved ? "opacity-60" : ""
              }`}
            >
              <div className="flex gap-3 p-3">
                <span className="relative h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                  <Image
                    src={e.image}
                    alt={e.title}
                    fill
                    sizes="64px"
                    className="object-cover"
                  />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-start gap-2">
                    <p className="min-w-0 flex-1 truncate text-sm font-bold">
                      {e.title}
                    </p>
                    {approved[e.id] && !isRemoved && (
                      <span className="shrink-0 rounded-full bg-cool/15 px-2 py-0.5 text-[10px] font-bold text-cool">
                        ✓ Approved
                      </span>
                    )}
                  </div>
                  <p className="truncate text-xs text-muted">
                    {e.when} · {e.area}
                  </p>
                  <p className="text-xs text-muted">{e.attendees} going</p>
                </div>
              </div>
              <div className="flex gap-2 border-t border-border p-2.5">
                <button
                  type="button"
                  onClick={() =>
                    setApproved((a) => ({ ...a, [e.id]: !a[e.id] }))
                  }
                  className="flex-1 rounded-lg border border-border py-1.5 text-xs font-bold text-muted transition-colors hover:text-foreground"
                >
                  {approved[e.id] ? "Revoke approval" : "Approve"}
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-lg border border-border py-1.5 text-xs font-bold text-muted transition-colors hover:text-foreground"
                >
                  Edit
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setRemoved((r) => ({ ...r, [e.id]: !r[e.id] }))
                  }
                  className={`flex-1 rounded-lg py-1.5 text-xs font-bold ${
                    isRemoved ? "bg-cool/10 text-cool" : "bg-heat/10 text-heat"
                  }`}
                >
                  {isRemoved ? "Restore" : "Remove"}
                </button>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

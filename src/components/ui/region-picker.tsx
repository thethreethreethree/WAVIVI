"use client";

import Image from "next/image";
import { useState, useTransition } from "react";

import { setCurrentRegion } from "@/lib/regions/actions";
import type { RegionRow } from "@/lib/regions/current";

/** Globe button + bottom-sheet picker. Selecting a region writes the
 *  `wv-region` cookie via a Server Action and refreshes every list. */
export function RegionPicker({
  regions,
  currentId,
  currentLabel,
}: {
  regions: RegionRow[];
  currentId: string | null;
  currentLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function choose(id: string) {
    startTransition(async () => {
      await setCurrentRegion(id);
      setOpen(false);
    });
  }
  function clear() {
    startTransition(async () => {
      await setCurrentRegion("");
      setOpen(false);
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Change region (currently ${currentLabel})`}
        className="relative flex h-11 w-11 items-center justify-center active:scale-95"
      >
        <span
          aria-hidden
          className="wc-edge-soft absolute inset-0 rounded-full bg-[#fdf4e2] ring-[1.5px] ring-[#3d1f06]/55 shadow-[0_2px_8px_-2px_rgba(120,70,30,0.22)]"
        />
        <Image
          src="/icons/sketch/globe.png"
          alt=""
          width={88}
          height={88}
          className="relative h-7 w-7 object-contain"
        />
      </button>

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Choose region"
          className="fixed inset-0 z-[120] flex items-end justify-center bg-black/40"
          onClick={() => setOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="wc-frame relative mx-3 mb-3 w-full max-w-md rounded-3xl bg-background p-5"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Pick a region</h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="text-2xl leading-none text-muted"
                aria-label="Close"
              >
                ×
              </button>
            </div>
            <p className="mb-3 text-base text-muted">
              Wondavu will tailor stays, food, events, and tools to wherever
              you are.
            </p>

            <ul className="max-h-[60vh] overflow-y-auto">
              <li>
                <button
                  type="button"
                  disabled={pending}
                  onClick={clear}
                  className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left text-base font-semibold transition active:scale-[0.99] ${
                    currentId == null
                      ? "bg-glow/15 text-foreground"
                      : "hover:bg-surface-elevated"
                  }`}
                >
                  <span>🌍 Show everywhere</span>
                  {currentId == null && <span className="text-glow">✓</span>}
                </button>
              </li>

              {regions.map((r) => {
                const active = r.id === currentId;
                return (
                  <li key={r.id}>
                    <button
                      type="button"
                      disabled={pending}
                      onClick={() => choose(r.id)}
                      className={`flex w-full items-center justify-between rounded-xl px-4 py-3 text-left transition active:scale-[0.99] ${
                        active
                          ? "bg-glow/15"
                          : "hover:bg-surface-elevated"
                      }`}
                    >
                      <span className="min-w-0">
                        <span className="block text-base font-semibold text-foreground">
                          {r.display_name}
                        </span>
                        {r.country && (
                          <span className="block text-sm text-muted">
                            {[r.city, r.country].filter(Boolean).join(", ")}
                          </span>
                        )}
                      </span>
                      {active && <span className="text-glow">✓</span>}
                    </button>
                  </li>
                );
              })}

              {regions.length === 0 && (
                <li className="px-4 py-6 text-center text-base text-muted">
                  No regions available yet.
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
    </>
  );
}

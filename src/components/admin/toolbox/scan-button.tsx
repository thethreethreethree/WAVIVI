"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

interface ScanButtonProps {
  regionId: string;
  /** Optional single category to scan; omit to scan all 12. */
  category?: string;
  /** Visual variant. */
  size?: "sm" | "md";
  label?: string;
}

/**
 * Triggers a region scan via `POST /api/admin/regions/[id]/scan`.
 * Scans are slow (~30-60s) — shows a loading state and refreshes on success.
 */
export function ScanButton({
  regionId,
  category,
  size = "sm",
  label = "Scan Now",
}: ScanButtonProps) {
  const router = useRouter();
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function scan() {
    setScanning(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/regions/${regionId}/scan`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(category ? { category } : {}),
      });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as {
          error?: string;
        } | null;
        throw new Error(body?.error ?? `Scan failed (${res.status})`);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Scan failed.");
    } finally {
      setScanning(false);
    }
  }

  const pad = size === "md" ? "px-4 py-2 text-sm" : "px-3 py-1.5 text-xs";

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={scan}
        disabled={scanning}
        className={`inline-flex items-center gap-1.5 rounded-full bg-sunset font-bold text-white disabled:opacity-70 ${pad}`}
      >
        {scanning && (
          <span className="h-3 w-3 animate-spin rounded-full border-2 border-white/40 border-t-white" />
        )}
        {scanning ? "Scanning…" : label}
      </button>
      {error && (
        <span className="text-[11px] font-semibold text-heat">{error}</span>
      )}
    </span>
  );
}

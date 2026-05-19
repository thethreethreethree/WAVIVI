import Link from "next/link";

import { formatDateTime } from "@/components/admin/toolbox/toolbox-utils";
import { CATEGORY_BY_ID } from "@/lib/toolbox/categories";
import { createClient } from "@/lib/supabase/server";
import type { ScanJobRow, ScanStatus } from "@/types/supabase";

export const dynamic = "force-dynamic";

const STATUS_STYLE: Record<ScanStatus, string> = {
  pending: "bg-border text-muted",
  running: "bg-glow/15 text-glow",
  completed: "bg-cool/15 text-cool",
  failed: "bg-heat/15 text-heat",
};

type ScanJobWithRegion = ScanJobRow & {
  regions: { display_name: string } | null;
};

export default async function ScanJobsPage() {
  const supabase = await createClient();

  const { data } = await supabase
    .from("scan_jobs")
    .select("*, regions(display_name)")
    .order("created_at", { ascending: false })
    .limit(100);

  const jobs = (data ?? []) as unknown as ScanJobWithRegion[];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link
          href="/admin/toolbox"
          className="text-xs font-bold text-glow hover:underline"
        >
          ‹ Toolbox
        </Link>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">Scan jobs</h1>
        <p className="text-sm text-muted">
          The 100 most recent toolbox discovery scans.
        </p>
      </div>

      {jobs.length === 0 ? (
        <p className="rounded-2xl bg-surface px-4 py-8 text-center text-sm text-muted shadow-card ring-1 ring-border">
          No scan jobs have run yet.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl bg-surface shadow-card ring-1 ring-border">
          <table className="w-full min-w-[680px] text-left text-xs">
            <thead>
              <tr className="border-b border-border text-muted">
                <Th>Region</Th>
                <Th>Category</Th>
                <Th>Status</Th>
                <Th>Found</Th>
                <Th>Saved</Th>
                <Th>Started</Th>
                <Th>Completed</Th>
                <Th>Errors</Th>
              </tr>
            </thead>
            <tbody>
              {jobs.map((job, i) => (
                <tr
                  key={job.id}
                  className={i > 0 ? "border-t border-border" : ""}
                >
                  <Td className="font-semibold text-foreground">
                    {job.regions?.display_name ?? "—"}
                  </Td>
                  <Td>
                    {job.category
                      ? CATEGORY_BY_ID[job.category].label
                      : "All categories"}
                  </Td>
                  <Td>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        STATUS_STYLE[job.status]
                      }`}
                    >
                      {job.status}
                    </span>
                  </Td>
                  <Td>{job.total_found}</Td>
                  <Td>{job.total_saved}</Td>
                  <Td>{formatDateTime(job.started_at)}</Td>
                  <Td>{formatDateTime(job.completed_at)}</Td>
                  <Td className="max-w-[200px]">
                    {job.errors ? (
                      <span
                        className="block truncate text-heat"
                        title={job.errors}
                      >
                        {job.errors}
                      </span>
                    ) : (
                      "—"
                    )}
                  </Td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return <th className="px-3 py-2.5 font-bold">{children}</th>;
}

function Td({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return <td className={`px-3 py-2.5 text-muted ${className}`}>{children}</td>;
}

import { redirect } from "next/navigation";

import { SusenAvatar } from "@/components/ui/susen-avatar";
import { listDevNotes, listLiveRules } from "@/lib/susen/tuning";
import { estimateResponseUsage } from "@/lib/susen/usage";
import { requireAdmin } from "@/lib/toolbox/admin";

import { SusenTuning } from "./SusenTuning";

/**
 * Susen tuning console (admin-only).
 *
 *  - Per-response token + cost gauge (where her tokens go, ~cost per reply).
 *  - Live rules: review / retire / hand-write the operator guidance that
 *    steers every reply. Retiring takes effect on her next message — no deploy.
 *  - Recent chats: the capture log, with one-click promote-to-rule.
 *
 * Admin only. The /admin layout gates on is_admin; we re-check here so a
 * direct hit can't slip data out if the layout gate ever changes.
 */
export const dynamic = "force-dynamic";

// Representative region for the token gauge — El Nido is our most complete
// inventory, so it's a realistic upper-ish bound for prompt size.
const SAMPLE_REGION = "el_nido_palawan_philippines";

export default async function AdminSusenPage() {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) redirect("/admin");

  const [liveRules, recent, usage] = await Promise.all([
    listLiveRules(),
    listDevNotes(60),
    estimateResponseUsage(SAMPLE_REGION),
  ]);
  const liveIds = new Set(liveRules.map((r) => r.id));
  const captures = recent.filter((n) => !liveIds.has(n.id));

  const fmt = (n: number) => n.toLocaleString();
  const total = usage.systemInputTokens || 1;
  const breakdown = [
    { label: "Persona", tokens: usage.personaTokens, hint: "fixed system prompt" },
    { label: "Region context", tokens: usage.regionTokens, hint: usage.regionName ?? "—" },
    {
      label: "Live inventory",
      tokens: usage.inventoryTokens,
      hint: `${usage.matchCounts.stays + usage.matchCounts.restaurants + usage.matchCounts.experiences} rows for this query`,
    },
    {
      label: "Operator guidance",
      tokens: usage.guidanceTokens,
      hint: `${usage.liveRuleCount} live rule${usage.liveRuleCount === 1 ? "" : "s"}`,
    },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <SusenAvatar className="h-11 w-11" />
        <div className="min-w-0">
          <h1 className="text-2xl font-bold tracking-tight">Susen — Tuning</h1>
          <p className="text-sm text-muted">
            Review what’s steering her replies and see what each reply costs.
            Live on{" "}
            <span className="font-mono text-xs">{usage.model}</span>.
          </p>
        </div>
      </div>

      {/* Token + cost gauge */}
      <section className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-border">
        <h2 className="text-sm font-bold">Cost per response</h2>
        <p className="mt-0.5 text-xs text-muted">
          Estimated from the live prompt for a{" "}
          <span className="italic">“{usage.sampleQuery}”</span> query in{" "}
          {usage.regionName ?? "this region"}. Chat history adds more on top.
        </p>

        <div className="mt-3 grid grid-cols-3 gap-2.5">
          <div className="rounded-xl bg-background p-3 ring-1 ring-border">
            <p className="text-xl font-bold tracking-tight">
              ≈ {fmt(usage.systemInputTokens)}
            </p>
            <p className="text-[11px] text-muted">input tokens / reply</p>
          </div>
          <div className="rounded-xl bg-background p-3 ring-1 ring-border">
            <p className="text-xl font-bold tracking-tight">
              {fmt(usage.outputCapTokens)}
            </p>
            <p className="text-[11px] text-muted">
              output cap (~{usage.typicalOutputTokens} typical)
            </p>
          </div>
          <div className="rounded-xl bg-background p-3 ring-1 ring-border">
            <p className="text-xl font-bold tracking-tight">
              ${usage.costPerResponseUsd.toFixed(4)}
            </p>
            <p className="text-[11px] text-muted">
              / reply · ${usage.costPer1kResponsesUsd.toFixed(2)} per 1k
            </p>
          </div>
        </div>

        {/* Where the input tokens go */}
        <div className="mt-3 flex flex-col gap-1.5">
          {breakdown.map((b) => (
            <div key={b.label} className="flex items-center gap-2">
              <span className="w-28 shrink-0 text-[11px] font-medium">
                {b.label}
              </span>
              <div className="h-2 flex-1 overflow-hidden rounded-full bg-background ring-1 ring-border">
                <div
                  className="h-full rounded-full bg-sunset"
                  style={{
                    width: `${Math.round((b.tokens / total) * 100)}%`,
                  }}
                />
              </div>
              <span className="w-24 shrink-0 text-right text-[11px] text-muted">
                ≈ {fmt(b.tokens)} · {b.hint}
              </span>
            </div>
          ))}
        </div>

        <p className="mt-3 text-[10px] leading-relaxed text-muted">
          Tokens are a ~estimate (≈ chars ÷ 3.8). Cost uses DeepSeek list rates
          (≈ ${usage.inputPricePerM}/1M input, ${usage.outputPricePerM}/1M
          output) — verify current pricing. The query-targeted retrieval keeps
          the inventory block small; a broad “what’s nearby” query is near the
          top of the range.
        </p>
      </section>

      {/* Tuning console */}
      <SusenTuning liveRules={liveRules} captures={captures} />
    </div>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";

import { SusenAvatar } from "@/components/ui/susen-avatar";
import { listDevNotes, listLiveRules } from "@/lib/susen/tuning";
import {
  estimateResponseUsage,
  loadUsageSummary,
  projectMonthlyCost,
} from "@/lib/susen/usage";
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

export default async function AdminSusenPage({
  searchParams,
}: {
  searchParams: Promise<{ window?: string }>;
}) {
  const { isAdmin } = await requireAdmin();
  if (!isAdmin) redirect("/admin");

  // Cost-basis window — admins toggle 7d / 30d to choose the smoothing window
  // for the spend panel and the projection. Default 7d.
  const costWindow = (await searchParams).window === "30" ? 30 : 7;

  const [liveRules, recent, usage, spend] = await Promise.all([
    listLiveRules(),
    listDevNotes(60),
    estimateResponseUsage(SAMPLE_REGION),
    loadUsageSummary(costWindow),
  ]);
  const liveIds = new Set(liveRules.map((r) => r.id));
  const captures = recent.filter((n) => !liveIds.has(n.id));

  const fmt = (n: number) => n.toLocaleString();
  const usd = (n: number) =>
    n < 100
      ? `$${n.toFixed(2)}`
      : `$${Math.round(n).toLocaleString()}`;
  const projection = projectMonthlyCost(spend);
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

      {/* Real spend (actual DeepSeek usage) — window toggle drives this panel
          AND the projection below. */}
      <section className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-border">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-sm font-bold">Real spend · last {spend.days} days</h2>
          <div className="flex items-center gap-0.5 rounded-full bg-background p-0.5 text-[11px] font-bold ring-1 ring-border">
            {([7, 30] as const).map((w) => (
              <Link
                key={w}
                href={`/admin/susen?window=${w}`}
                scroll={false}
                className={`rounded-full px-2.5 py-0.5 transition-colors ${
                  costWindow === w
                    ? "bg-sunset text-white"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {w}d
              </Link>
            ))}
          </div>
        </div>
        {spend.available ? (
          <>
            <p className="mt-0.5 text-xs text-muted">
              Actual DeepSeek usage across every reply (cache-aware cost).
            </p>
            <div className="mt-3 grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <div className="rounded-xl bg-background p-3 ring-1 ring-border">
                <p className="text-xl font-bold tracking-tight">
                  ${spend.estCostUsd.toFixed(2)}
                </p>
                <p className="text-[11px] text-muted">est. spend</p>
              </div>
              <div className="rounded-xl bg-background p-3 ring-1 ring-border">
                <p className="text-xl font-bold tracking-tight">
                  {fmt(spend.responses)}
                </p>
                <p className="text-[11px] text-muted">
                  replies · {fmt(spend.avgTokensPerResponse)} avg tok
                </p>
              </div>
              <div className="rounded-xl bg-background p-3 ring-1 ring-border">
                <p className="text-xl font-bold tracking-tight">
                  {fmt(spend.totalTokens)}
                </p>
                <p className="text-[11px] text-muted">total tokens</p>
              </div>
              <div className="rounded-xl bg-background p-3 ring-1 ring-border">
                <p className="text-xl font-bold tracking-tight text-cool">
                  {Math.round(spend.cacheHitRate * 100)}%
                </p>
                <p className="text-[11px] text-muted">input cache-hit</p>
              </div>
            </div>
          </>
        ) : (
          <p className="mt-2 rounded-xl bg-glow/5 px-3 py-2 text-xs text-muted ring-1 ring-glow/30">
            No usage recorded yet. Apply migration{" "}
            <span className="font-mono">0049_susen_usage</span> to start
            collecting real per-reply spend — new replies populate this panel
            automatically.
          </p>
        )}
      </section>

      {/* Monthly cost projection */}
      <section className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-border">
        <h2 className="text-sm font-bold">Monthly cost projection</h2>
        <p className="mt-0.5 text-xs text-muted">
          DeepSeek inference at scale, from{" "}
          {projection.fromLiveData
            ? `your live $${(projection.costPerMsgUsd * 1000).toFixed(2)} per 1,000 messages (${fmt(projection.sampleResponses)} replies, last ${spend.days}d)`
            : `an estimated $${(projection.costPerMsgUsd * 1000).toFixed(2)} per 1,000 messages — no live data yet`}
          . Rows are messages per active user per month.
        </p>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-muted">
                <th className="py-1 pr-3 font-medium">msgs/user/mo</th>
                {projection.tiers.map((t) => (
                  <th
                    key={t.users}
                    className="py-1 pr-3 text-right font-medium"
                  >
                    {fmt(t.users)} users
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {projection.engagementLevels.map((m, e) => (
                <tr key={m} className="border-t border-border">
                  <td className="py-1.5 pr-3 font-bold">{m}</td>
                  {projection.tiers.map((t) => (
                    <td
                      key={t.users}
                      className="py-1.5 pr-3 text-right tabular-nums"
                    >
                      {usd(t.monthlyUsd[e] ?? 0)}/mo
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-[10px] leading-relaxed text-muted">
          DeepSeek inference only (excludes Vercel / Supabase / egress).
          “Users” = monthly active senders. Engagement is the big swing factor;
          the live cost/message already reflects the current cache-hit rate, so
          this drops automatically as caching improves.
        </p>
      </section>

      {/* Token + cost gauge */}
      <section className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-border">
        <h2 className="text-sm font-bold">Cost per response (estimate)</h2>
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

import { SusenAvatar } from "@/components/ui/susen-avatar";
import { susenActivity, susenStats } from "@/lib/admin/data";

export default function AdminSusenPage() {
  const metrics = [
    { v: susenStats.messagesHandled.toLocaleString(), l: "Messages handled" },
    { v: susenStats.chatsRevived, l: "Chats revived" },
    { v: susenStats.meetupsCoordinated, l: "Meetups coordinated" },
    { v: susenStats.vibeReports, l: "Vibe reports" },
  ];

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Susen</h1>
        <p className="text-sm text-muted">
          Monitor the social operating intelligence.
        </p>
      </div>

      {/* Status */}
      <div className="flex items-center gap-3 rounded-2xl bg-surface p-4 shadow-card ring-1 ring-border">
        <SusenAvatar className="h-11 w-11" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">S.U.S.E.N</p>
          <p className="text-[10px] text-muted">Smart Universal Experience Navigator</p>
          <p className="truncate text-xs text-muted">{susenStats.model}</p>
        </div>
        <span className="shrink-0 rounded-full bg-cool/15 px-2.5 py-1 text-[10px] font-bold text-cool">
          ● {susenStats.status}
        </span>
      </div>

      {/* Metrics */}
      <section>
        <h2 className="mb-2 text-sm font-bold">Activity (30 days)</h2>
        <div className="grid grid-cols-2 gap-2.5">
          {metrics.map((m) => (
            <div
              key={m.l}
              className="rounded-2xl bg-surface p-3.5 shadow-card ring-1 ring-border"
            >
              <p className="text-xl font-bold tracking-tight">{m.v}</p>
              <p className="text-xs text-muted">{m.l}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Recent activity */}
      <section>
        <h2 className="mb-2 text-sm font-bold">Recent interventions</h2>
        <ul className="overflow-hidden rounded-2xl bg-surface shadow-card ring-1 ring-border">
          {susenActivity.map((a, i) => (
            <li
              key={a.id}
              className={`flex items-center gap-3 px-4 py-3 ${
                i > 0 ? "border-t border-border" : ""
              }`}
            >
              <span className="min-w-0 flex-1 text-sm">{a.text}</span>
              <span className="shrink-0 text-[11px] text-muted">{a.time}</span>
            </li>
          ))}
        </ul>
      </section>

      {/* Config note */}
      <div className="rounded-2xl border border-glow/30 bg-glow/5 p-4">
        <p className="text-sm font-bold text-glow">Connect a live model</p>
        <p className="mt-1 text-xs text-muted">
          Susen runs on the rule-based engine today. Add an Anthropic API key
          and swap the engine in <code>lib/susen/engine.ts</code> to bring the
          live model online — her behavior system and system prompt are ready.
        </p>
      </div>
    </div>
  );
}

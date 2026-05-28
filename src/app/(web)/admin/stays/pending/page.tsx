import Link from "next/link";

import { createClient } from "@/lib/supabase/server";
import type { StayRow } from "@/types/supabase";

import { PendingActions } from "./PendingActions";

export const dynamic = "force-dynamic";

/**
 * Pending review queue — stays ingested by the Partner Collection
 * extension that haven't been approved yet. Admin can approve (publish
 * to the public site) or reject (delete).
 */
export default async function StaysPendingReviewPage() {
  const supabase = await createClient();

  const { data, error } = await supabase
    .from("stays")
    .select("*")
    .eq("needs_review", true)
    .order("created_at", { ascending: false })
    .limit(200);

  const rows = (data ?? []) as StayRow[];

  return (
    <div className="mx-auto max-w-5xl px-5 py-10">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Pending review
          </h1>
          <p className="mt-1 text-sm text-muted">
            {rows.length === 0
              ? "No stays awaiting review."
              : `${rows.length} stay${rows.length === 1 ? "" : "s"} from the Partner Collection extension awaiting approval.`}
          </p>
        </div>
        <Link
          href="/admin/stays"
          className="rounded-full bg-foreground/10 px-4 py-2 text-sm font-bold text-foreground hover:bg-foreground/15"
        >
          ← Stays admin
        </Link>
      </header>

      {error ? (
        <p className="mt-6 rounded-2xl bg-red-500/10 px-4 py-3 text-sm text-red-500">
          {error.message}
        </p>
      ) : null}

      <ul className="mt-8 grid gap-4">
        {rows.map((s) => (
          <li
            key={s.id}
            className="rounded-2xl bg-surface p-4 shadow-card ring-1 ring-border"
          >
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex min-w-0 gap-4">
                {s.photo_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={s.photo_url}
                    alt=""
                    className="h-20 w-28 shrink-0 rounded-xl object-cover"
                  />
                ) : (
                  <div className="h-20 w-28 shrink-0 rounded-xl bg-foreground/5" />
                )}
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold">{s.name}</p>
                  <p className="mt-0.5 text-xs text-muted">
                    {s.stay_type}
                    {s.rating ? ` · ${s.rating.toFixed(1)}★` : ""}
                    {s.review_count ? ` (${s.review_count})` : ""}
                  </p>
                  {s.address ? (
                    <p className="mt-1 truncate text-xs text-muted">
                      {s.address}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
                    {s.phone ? <span>📞 {s.phone}</span> : null}
                    {s.website ? (
                      <a
                        href={s.website}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        Website
                      </a>
                    ) : null}
                    {s.instagram ? (
                      <a
                        href={s.instagram}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        Instagram
                      </a>
                    ) : null}
                    {s.facebook ? (
                      <a
                        href={s.facebook}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        Facebook
                      </a>
                    ) : null}
                    {s.whatsapp ? (
                      <a
                        href={s.whatsapp}
                        target="_blank"
                        rel="noreferrer"
                        className="underline"
                      >
                        WhatsApp
                      </a>
                    ) : null}
                    <a
                      href={s.google_maps_url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      Maps
                    </a>
                  </div>
                  {s.amenities.length ? (
                    <p className="mt-2 text-xs text-muted">
                      {s.amenities.join(" · ")}
                    </p>
                  ) : null}
                  {s.description ? (
                    <p className="mt-2 line-clamp-3 text-xs text-foreground/80">
                      {s.description}
                    </p>
                  ) : null}
                </div>
              </div>
              <PendingActions stayId={s.id} />
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

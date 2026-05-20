import Link from "next/link";
import { notFound, redirect } from "next/navigation";

import { PartnerStayForm } from "@/features/partner/partner-stay-form";
import { createClient } from "@/lib/supabase/server";
import type { StayRow } from "@/types/supabase";

export const dynamic = "force-dynamic";

export default async function PartnerStayPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/partner");

  // RLS already restricts SELECT to active stays + admins. Owners can
  // always read their own listing — verify explicitly so the page can
  // 404 cleanly if someone hits a URL that isn't theirs.
  const { data } = await supabase
    .from("stays")
    .select("*")
    .eq("id", id)
    .eq("claimed_by", user.id)
    .maybeSingle();
  const stay = data as StayRow | null;
  if (!stay) notFound();

  return (
    <div className="flex flex-col gap-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            Manage listing
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {stay.name}
          </h1>
        </div>
        <Link
          href="/partner"
          className="rounded-full bg-foreground/10 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-foreground/15"
        >
          ← All my listings
        </Link>
      </header>

      <PartnerStayForm stay={stay} />

      <section className="rounded-2xl bg-surface p-4 text-xs text-muted shadow-card ring-1 ring-border">
        <p className="font-bold text-foreground">What you can&apos;t change here</p>
        <p className="mt-1">
          Travejor admins curate Google rating, the backpack score,
          location and stay type to keep listings consistent for
          travelers. If something there is wrong, contact your Travejor
          admin and they&apos;ll update it.
        </p>
      </section>
    </div>
  );
}

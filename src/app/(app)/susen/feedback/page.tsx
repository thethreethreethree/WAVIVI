import { redirect } from "next/navigation";

import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

import { SusenFeedbackForm } from "./SusenFeedbackForm";

/**
 * Traveller-facing feedback capture for Susen tuning.
 *
 * Why this exists: Susen's location knowledge comes from the database
 * + admin-authored rules. When a traveller's lived experience adds to
 * that ("Pangolin's housemusic peaks 11pm-1am, not earlier"), this is
 * where they say so. Admins review the queue at /admin/susen and
 * promote the strongest signals into scoped rules so future travellers
 * get a better answer.
 */
export const dynamic = "force-dynamic";

export default async function SusenFeedbackPage({
  searchParams,
}: {
  // q = the user's question, a = Susen's reply, turnId = optional
  // susen_messages row id for lineage. Passed in when the "Improve
  // this answer" link on a Susen reply opens this page. Plain
  // searchParams since the values are short text.
  searchParams: Promise<{
    q?: string;
    a?: string;
    turnId?: string;
  }>;
}) {
  // Sign-in gate — anonymous submissions would let anyone seed the
  // admin review queue and burn the team's time.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=/susen/feedback");
  }
  const sp = await searchParams;
  const prefill = (sp.q ?? "").trim() || (sp.a ?? "").trim()
    ? {
        question: (sp.q ?? "").trim(),
        answer: (sp.a ?? "").trim(),
        turnId: (sp.turnId ?? "").trim() || null,
      }
    : null;

  // Pull the same scope dropdown options the admin form uses so the
  // traveller can scope their feedback to the city they actually saw.
  const admin = createAdminClient();
  const [regionsRes, citiesRes] = await Promise.all([
    admin
      .from("regions")
      .select("id, display_name, country")
      .eq("active", true)
      .order("display_name", { ascending: true })
      .returns<
        { id: string; display_name: string; country: string | null }[]
      >(),
    admin
      .from("cities")
      .select("id, name, region_id")
      .order("name", { ascending: true })
      .returns<{ id: string; name: string; region_id: string }[]>(),
  ]);
  const regions = (regionsRes.data ?? []).map((r) => ({
    id: r.id,
    displayName: r.display_name,
    country: r.country,
  }));
  const cities = (citiesRes.data ?? []).map((c) => ({
    id: c.id,
    name: c.name,
    regionId: c.region_id,
  }));

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5 px-4 py-8">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">
          Tell Susen what you learned
        </h1>
        <p className="mt-1 text-sm text-muted">
          Share something specific from your trip — a hidden gem, a
          nightlife pattern, a transport tip — and we&apos;ll review it
          for inclusion in Susen&apos;s answers. The more concrete the
          better: name venues, times, and the sequence of events when
          relevant.
        </p>
      </header>
      <SusenFeedbackForm
        regions={regions}
        cities={cities}
        prefill={prefill}
      />
    </div>
  );
}

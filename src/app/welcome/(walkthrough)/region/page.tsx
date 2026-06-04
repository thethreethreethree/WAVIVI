import { redirect } from "next/navigation";

import { listActiveRegions } from "@/lib/regions/current";
import { createClient } from "@/lib/supabase/server";

import { StepIndicator } from "../step-indicator";

import { RegionStepClient } from "./region-step-client";

/**
 * Step 1 of the post-signup walkthrough — region picker.
 *
 * Unauthenticated visitors that land here directly get bounced to /login
 * with `next` set back so the flow resumes after sign-in. Already-
 * onboarded users get sent to / so they don't get trapped in the flow
 * after refreshing mid-step.
 */
export default async function WelcomeRegionPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=%2Fwelcome%2Fregion");
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded_at")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.onboarded_at) {
    redirect("/");
  }

  const regions = await listActiveRegions();

  return (
    <>
      <StepIndicator current={1} />
      <h1 className="text-3xl font-bold tracking-tight">
        Where are you headed?
      </h1>
      <p className="mt-2 text-base text-muted">
        Pick a place to start. We&apos;ll show you the travelers, events, and
        spots there.
      </p>
      <div className="mt-6">
        <RegionStepClient regions={regions} />
      </div>
    </>
  );
}

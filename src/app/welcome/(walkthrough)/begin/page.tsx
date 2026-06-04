import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { StepIndicator } from "../step-indicator";

import { BeginStepClient } from "./begin-step-client";

/** Step 3 of the post-signup walkthrough — pick where to start.
 *  This is the terminal step: every CTA in BeginStepClient calls
 *  finishOnboarding(), which stamps profiles.onboarded_at so the
 *  auth callbacks stop routing this user back into /welcome. */
export default async function WelcomeBeginPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=%2Fwelcome%2Fbegin");
  }
  const { data: profile } = await supabase
    .from("profiles")
    .select("onboarded_at")
    .eq("id", user.id)
    .maybeSingle();
  if (profile?.onboarded_at) {
    redirect("/");
  }

  return (
    <>
      <StepIndicator current={3} />
      <h1 className="text-3xl font-bold tracking-tight">
        Where to start?
      </h1>
      <p className="mt-2 text-base text-muted">
        You can do all three from the bottom tabs — this just picks where to
        drop you first.
      </p>
      <div className="mt-6">
        <BeginStepClient />
      </div>
    </>
  );
}

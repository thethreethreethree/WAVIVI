import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import { StepIndicator } from "../step-indicator";

import { VibeStepClient } from "./vibe-step-client";

/** Step 2 of the post-signup walkthrough — pick interest tags. */
export default async function WelcomeVibePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/login?next=%2Fwelcome%2Fvibe");
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
      <StepIndicator current={2} />
      <h1 className="text-3xl font-bold tracking-tight">
        What&apos;s your vibe?
      </h1>
      <p className="mt-2 text-base text-muted">
        Pick a few — we&apos;ll tilt your feed and what Susen suggests.
      </p>
      <div className="mt-6">
        <VibeStepClient />
      </div>
    </>
  );
}

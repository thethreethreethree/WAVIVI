import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "@/features/auth";
import { isConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Create account" };

export default async function SignupPage() {
  if (isConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect("/profile");
  }

  return (
    <>
      <h1 className="mb-1 text-lg font-semibold">Join WAVIVI</h1>
      <p className="mb-5 text-sm text-muted">
        Create an account to find your people on the map.
      </p>
      <AuthForm mode="signup" />
    </>
  );
}

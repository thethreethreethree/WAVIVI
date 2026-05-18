import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "@/features/auth";
import { isConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage() {
  if (isConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect("/profile");
  }

  return (
    <div className="pt-[max(3rem,calc(env(safe-area-inset-top)+2rem))]">
      <h1 className="mb-1 text-lg font-semibold">Welcome back</h1>
      <p className="mb-5 text-sm text-muted">
        Sign in to pick up where you left off.
      </p>
      <AuthForm mode="login" />
    </div>
  );
}

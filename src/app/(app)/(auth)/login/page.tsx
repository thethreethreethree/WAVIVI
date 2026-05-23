import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "@/features/auth";
import { isConfigured } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Sign in" };

type Search = Promise<{ next?: string }>;

function safe(next: string | undefined): string | undefined {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return undefined;
  return next;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Search;
}) {
  const next = safe((await searchParams).next);

  if (isConfigured) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) redirect(next ?? "/profile");
  }

  const goingToAdmin = next?.startsWith("/admin") ?? false;

  return (
    <div className="pt-[max(3rem,calc(env(safe-area-inset-top)+2rem))]">
      <h1 className="mb-1 text-lg font-semibold">
        {goingToAdmin ? "Admin sign-in" : "Welcome back"}
      </h1>
      <p className="mb-5 text-sm text-muted">
        {goingToAdmin
          ? "Sign in with your Wondavu admin account."
          : "Sign in to pick up where you left off."}
      </p>
      <AuthForm mode="login" next={next} />
    </div>
  );
}

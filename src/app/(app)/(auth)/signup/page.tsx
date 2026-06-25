import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { AuthForm } from "@/features/auth";
import { isConfigured } from "@/lib/env";
import { getTranslator } from "@/lib/i18n/server";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Create account" };

type Search = Promise<{ next?: string }>;

function safe(next: string | undefined): string | undefined {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return undefined;
  return next;
}

export default async function SignupPage({
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

  const t = await getTranslator();
  return (
    <div className="pt-[max(3rem,calc(env(safe-area-inset-top)+2rem))]">
      <h1 className="mb-1 text-3xl font-bold">{t("auth.joinHeading")}</h1>
      <p className="mb-5 text-lg text-muted">{t("auth.joinSubtitle")}</p>
      <AuthForm mode="signup" next={next} />
    </div>
  );
}

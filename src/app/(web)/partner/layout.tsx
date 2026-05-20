import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { PartnerShell } from "@/components/partner/partner-shell";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Travejor Partner Dashboard",
  robots: { index: false, follow: false },
};

export default async function PartnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Middleware already bounces anonymous visitors, but belt-and-braces.
  if (!user) redirect("/login?next=/partner");

  return <PartnerShell email={user.email ?? null}>{children}</PartnerShell>;
}

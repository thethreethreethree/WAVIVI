import type { Metadata } from "next";
import { redirect } from "next/navigation";

import { ScreenHeader } from "@/components/ui/screen-header";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Verification" };
export const dynamic = "force-dynamic";

export default async function VerificationPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profile/verification");

  const { data: profile } = await supabase
    .from("profiles")
    .select("instagram_verified, instagram_username, display_name")
    .eq("id", user.id)
    .maybeSingle();

  const emailVerified = Boolean(user.email_confirmed_at);
  const igVerified = Boolean(profile?.instagram_verified);

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Verification" back="/settings" />
      <div className="flex flex-col gap-5 px-5 pb-8 pt-2">
        <p className="text-base text-muted">
          Verified travelers earn a trust badge and unlock priority placement in
          chat groups and event invites.
        </p>

        <StatusRow
          title="Email"
          subtitle={user.email ?? "No email on file"}
          status={emailVerified ? "verified" : "pending"}
          statusLabel={emailVerified ? "Verified" : "Unconfirmed"}
        />

        <StatusRow
          title="Instagram"
          subtitle={
            profile?.instagram_username
              ? `@${profile.instagram_username}`
              : "Add your Instagram handle on the Edit profile screen."
          }
          status={igVerified ? "verified" : "pending"}
          statusLabel={igVerified ? "Verified" : "Not linked"}
        />

        <StatusRow
          title="Government ID"
          subtitle="Upload a photo of your passport or driver's license."
          status="coming-soon"
          statusLabel="Coming soon"
        />

        <p className="mt-2 text-sm text-muted">
          Verification is optional. Travelers always control which signals are
          visible on their public profile.
        </p>
      </div>
    </div>
  );
}

function StatusRow({
  title,
  subtitle,
  status,
  statusLabel,
}: {
  title: string;
  subtitle: string;
  status: "verified" | "pending" | "coming-soon";
  statusLabel: string;
}) {
  const styles =
    status === "verified"
      ? "bg-cool/15 text-cool"
      : status === "pending"
        ? "bg-heat/15 text-heat"
        : "bg-muted/15 text-muted";
  return (
    <div className="wc-frame rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-lg font-bold text-foreground">{title}</p>
          <p className="mt-0.5 text-sm text-muted">{subtitle}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${styles}`}
        >
          {status === "verified" ? "✓ " : ""}
          {statusLabel}
        </span>
      </div>
    </div>
  );
}

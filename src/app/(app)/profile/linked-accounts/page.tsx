import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { ScreenHeader } from "@/components/ui/screen-header";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Linked accounts" };
export const dynamic = "force-dynamic";

export default async function LinkedAccountsPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/profile/linked-accounts");

  const { data: profile } = await supabase
    .from("profiles")
    .select("instagram_username, instagram_verified, whatsapp_number")
    .eq("id", user.id)
    .maybeSingle();

  const providers = user.app_metadata?.providers ?? [user.app_metadata?.provider];
  const hasGoogle = Array.isArray(providers) && providers.includes("google");
  const hasApple = Array.isArray(providers) && providers.includes("apple");

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Linked accounts" back="/settings" />
      <div className="flex flex-col gap-3 px-5 pb-8 pt-2">
        <p className="text-base text-muted">
          Manage the accounts and channels linked to your Wondavu profile.
        </p>

        <LinkRow
          title="Email"
          value={user.email ?? "Not set"}
          status={user.email_confirmed_at ? "Confirmed" : "Unconfirmed"}
          confirmed={Boolean(user.email_confirmed_at)}
        />
        <LinkRow
          title="Instagram"
          value={
            profile?.instagram_username
              ? `@${profile.instagram_username}`
              : "Not linked"
          }
          status={profile?.instagram_verified ? "Verified" : "Add on Edit profile"}
          confirmed={Boolean(profile?.instagram_verified)}
        />
        <LinkRow
          title="WhatsApp"
          value={profile?.whatsapp_number ?? "Not linked"}
          status={profile?.whatsapp_number ? "Linked" : "Add on Edit profile"}
          confirmed={Boolean(profile?.whatsapp_number)}
        />
        <LinkRow
          title="Google sign-in"
          value={hasGoogle ? "Linked" : "Not linked"}
          status={hasGoogle ? "Linked" : "Coming soon"}
          confirmed={hasGoogle}
        />
        <LinkRow
          title="Apple sign-in"
          value={hasApple ? "Linked" : "Not linked"}
          status={hasApple ? "Linked" : "Coming soon"}
          confirmed={hasApple}
        />

        <Link
          href="/profile/edit"
          className="mt-3 rounded-2xl bg-glow py-3 text-center text-base font-semibold text-white active:opacity-90"
        >
          Edit profile fields
        </Link>
      </div>
    </div>
  );
}

function LinkRow({
  title,
  value,
  status,
  confirmed,
}: {
  title: string;
  value: string;
  status: string;
  confirmed: boolean;
}) {
  return (
    <div className="wc-frame rounded-2xl p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-base font-bold text-foreground">{title}</p>
          <p className="mt-0.5 truncate text-sm text-muted">{value}</p>
        </div>
        <span
          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
            confirmed ? "bg-cool/15 text-cool" : "bg-muted/15 text-muted"
          }`}
        >
          {confirmed ? "✓ " : ""}
          {status}
        </span>
      </div>
    </div>
  );
}

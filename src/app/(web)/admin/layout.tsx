import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { AdminShell } from "@/components/admin/admin-shell";
import { signOut } from "@/features/auth/actions";
import { requireAdmin } from "@/lib/toolbox/admin";

export const metadata: Metadata = {
  title: "Wondavu Admin",
  robots: { index: false, follow: false },
};

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, isAdmin } = await requireAdmin();

  // Middleware already bounces anonymous visitors to /login, but in case
  // anything slipped through, do the same check here.
  if (!user) redirect("/login?next=/admin");

  // Signed in but the account isn't flagged is_admin — show a clean
  // not-authorized screen instead of empty pages.
  if (!isAdmin) {
    return (
      <div className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-background p-8 text-center">
        <span className="rounded-full bg-heat/15 px-3 py-1 text-xs font-bold uppercase tracking-wider text-heat">
          Admin only
        </span>
        <h1 className="text-2xl font-bold">This account isn&apos;t an admin.</h1>
        <p className="max-w-sm text-sm text-muted">
          You&apos;re signed in as <code className="font-mono">{user.email}</code>,
          but this account doesn&apos;t have admin access. Ask another admin
          to flag it, or sign in with an admin account.
        </p>
        <div className="flex items-center gap-2">
          <form action={signOut}>
            <button
              type="submit"
              className="rounded-full bg-foreground/10 px-4 py-2 text-sm font-bold text-foreground hover:bg-foreground/15"
            >
              Sign out
            </button>
          </form>
          <Link
            href="/"
            className="rounded-full bg-sunset px-4 py-2 text-sm font-bold text-white"
          >
            Back to app
          </Link>
        </div>
      </div>
    );
  }

  return <AdminShell>{children}</AdminShell>;
}

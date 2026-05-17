import Link from "next/link";

import { siteConfig } from "@/config/site";
import { publicEnv } from "@/lib/env";
import { createClient } from "@/lib/supabase/server";

/** Top navigation bar. Reflects the current auth session. */
export async function SiteHeader() {
  let user = null;

  // Skip the Supabase call until env vars are configured.
  if (publicEnv.supabaseUrl && publicEnv.supabaseAnonKey) {
    const supabase = await createClient();
    user = (await supabase.auth.getUser()).data.user;
  }

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur">
      <nav className="mx-auto flex h-14 max-w-2xl items-center justify-between px-6">
        <div className="flex items-center gap-5">
          <Link
            href="/"
            className="font-mono text-sm font-semibold uppercase tracking-[0.2em] text-foreground"
          >
            {siteConfig.name}
          </Link>
          <Link
            href="/map"
            className="text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            Live map
          </Link>
          <Link
            href="/discover"
            className="text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            Discover
          </Link>
          <Link
            href="/chat"
            className="text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            Chat
          </Link>
          <Link
            href="/events"
            className="text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            Events
          </Link>
          <Link
            href="/vibe"
            className="text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            Vibe
          </Link>
          <Link
            href="/for-you"
            className="text-sm font-medium text-muted transition-colors hover:text-foreground"
          >
            For you
          </Link>
        </div>

        {user ? (
          <Link
            href="/profile"
            className="rounded-lg border border-border px-3 py-1.5 text-sm
                       font-medium text-muted transition-colors hover:text-foreground"
          >
            Profile
          </Link>
        ) : (
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="px-3 py-1.5 text-sm font-medium text-muted
                         transition-colors hover:text-foreground"
            >
              Sign in
            </Link>
            <Link
              href="/signup"
              className="rounded-lg bg-glow px-3 py-1.5 text-sm font-medium
                         text-white transition-opacity hover:opacity-90"
            >
              Join
            </Link>
          </div>
        )}
      </nav>
    </header>
  );
}

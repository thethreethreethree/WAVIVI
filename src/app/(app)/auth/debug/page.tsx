import { cookies } from "next/headers";

import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

/**
 * Plain-text auth state dump. DO NOT REDIRECT from here — this exists
 * specifically so we can read the state when other pages are looping.
 * Visit /auth/debug after a sign-in loop to see exactly what's wrong.
 */
export default async function AuthDebug() {
  const supabase = await createClient();
  const cookieStore = await cookies();

  const allCookies = cookieStore.getAll();
  const supaCookies = allCookies.filter((c) =>
    c.name.startsWith("sb-") || c.name.includes("supabase") || c.name.includes("auth"),
  );

  let userInfo: unknown = null;
  let userError: string | null = null;
  try {
    const { data, error } = await supabase.auth.getUser();
    userInfo = data?.user
      ? {
          id: data.user.id,
          email: data.user.email,
          app_metadata: data.user.app_metadata,
          user_metadata: data.user.user_metadata,
          confirmed_at: data.user.confirmed_at,
          created_at: data.user.created_at,
        }
      : null;
    if (error) userError = error.message;
  } catch (e) {
    userError = e instanceof Error ? e.message : String(e);
  }

  let sessionInfo: unknown = null;
  let sessionError: string | null = null;
  try {
    const { data, error } = await supabase.auth.getSession();
    sessionInfo = data?.session
      ? {
          expires_at: data.session.expires_at,
          token_type: data.session.token_type,
          provider_token_present: Boolean(data.session.provider_token),
          access_token_length: data.session.access_token?.length ?? 0,
        }
      : null;
    if (error) sessionError = error.message;
  } catch (e) {
    sessionError = e instanceof Error ? e.message : String(e);
  }

  let profileInfo: unknown = null;
  let profileError: string | null = null;
  if (
    userInfo &&
    typeof userInfo === "object" &&
    "id" in userInfo &&
    typeof (userInfo as { id: unknown }).id === "string"
  ) {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", (userInfo as { id: string }).id)
        .maybeSingle();
      profileInfo = data ?? null;
      if (error) profileError = error.message;
    } catch (e) {
      profileError = e instanceof Error ? e.message : String(e);
    }
  }

  const dump = {
    cookies: {
      total: allCookies.length,
      names: allCookies.map((c) => c.name),
      supabase_related: supaCookies.map((c) => ({
        name: c.name,
        value_length: c.value.length,
        value_starts_with: c.value.slice(0, 20),
      })),
    },
    auth_getUser: {
      result: userInfo,
      error: userError,
    },
    auth_getSession: {
      result: sessionInfo,
      error: sessionError,
    },
    profiles_table: {
      result: profileInfo,
      error: profileError,
    },
  };

  return (
    <main className="p-6">
      <h1 className="mb-4 text-2xl font-bold">Auth Debug</h1>
      <p className="mb-4 text-sm text-muted">
        Share this output (screenshot is fine) so we can see what&apos;s
        actually happening.
      </p>
      <pre
        style={{
          whiteSpace: "pre-wrap",
          wordBreak: "break-word",
          fontFamily: "monospace",
          fontSize: 12,
          background: "#fff",
          color: "#000",
          padding: 12,
          borderRadius: 8,
          border: "1px solid #ccc",
        }}
      >
        {JSON.stringify(dump, null, 2)}
      </pre>
    </main>
  );
}

"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signIn, signUp } from "@/features/auth/actions";
import { GoogleButton } from "@/features/auth/components/google-button";
import {
  type AuthState,
  initialAuthState,
  PASSWORD_RULE_HINT,
  USERNAME_RULE_HINT,
} from "@/features/auth/types";

type Mode = "login" | "signup";

const fieldClass =
  "wc-frame w-full rounded-lg bg-transparent px-3 py-2.5 text-lg " +
  "outline-none transition-colors placeholder:text-muted focus-visible:border-glow";

export function AuthForm({
  mode,
  next,
}: {
  mode: Mode;
  /** Path to send the user to on successful auth (e.g. "/admin"). */
  next?: string;
}) {
  const action = mode === "login" ? signIn : signUp;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    initialAuthState,
  );

  return (
    <div className="flex flex-col gap-3">
      {/* Google OAuth — client-side trigger so the PKCE code_verifier
          cookie lands in the browser BEFORE the redirect to Google. */}
      <GoogleButton mode={mode} next={next} />

      <div className="my-1 flex items-center gap-3 text-xs font-semibold uppercase tracking-wider text-muted">
        <span className="h-px flex-1 bg-border" />
        or
        <span className="h-px flex-1 bg-border" />
      </div>

      <form action={formAction} className="flex flex-col gap-3">
      {next && <input type="hidden" name="next" value={next} />}
      {mode === "signup" && (
        <>
          <Field
            label="Display name"
            name="display_name"
            type="text"
            placeholder="Alex Rivera"
            autoComplete="name"
            defaultValue={state.values?.displayName ?? ""}
          />
          <Field
            label="Username"
            name="username"
            type="text"
            placeholder="alexrivera"
            autoComplete="username"
            defaultValue={state.values?.username ?? ""}
            // Surface the rule UP FRONT so users don't fail the server
            // check silently — the regex (/^[a-z0-9_]{3,24}$/) rejects
            // anything with capitals / hyphens / dots, and learning
            // that AFTER submit feels like an arbitrary error.
            hint={USERNAME_RULE_HINT}
          />
        </>
      )}

      <Field
        label="Email"
        name="email"
        type="email"
        placeholder="you@example.com"
        autoComplete="email"
        defaultValue={state.values?.email ?? ""}
      />
      <Field
        label="Password"
        name="password"
        type="password"
        placeholder="••••••••"
        autoComplete={mode === "login" ? "current-password" : "new-password"}
        // Surface the password rule UP FRONT for signup so users see it
        // BEFORE submit. Skipped for login — the existing-password rule
        // isn't enforced at sign-in.
        hint={mode === "signup" ? PASSWORD_RULE_HINT : undefined}
      />

      {state.error && (
        <p className="text-base text-heat" role="alert">
          {state.error}
        </p>
      )}
      {state.message && (
        // After a successful signup the server returns
        //   "Check your inbox to confirm your email, then sign in."
        // The old UI just showed that string and stranded the user on
        // the signup page wondering what to do next. The CTA below
        // sends them straight to /login (or /login?next=… when one
        // was supplied) so they're never stuck after the success.
        <div
          className="flex flex-col gap-2 rounded-lg bg-cool/10 px-4 py-3 ring-1 ring-cool/30"
          role="status"
        >
          <p className="text-base text-cool">{state.message}</p>
          {mode === "signup" && (
            <Link
              href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
              className="self-start rounded-full bg-cool px-4 py-1.5 text-sm font-bold text-white hover:opacity-90"
            >
              Go to sign in →
            </Link>
          )}
        </div>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-lg bg-glow px-4 py-2.5 text-lg font-semibold text-white
                   transition-opacity hover:opacity-90 active:opacity-80
                   disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending
          ? "Please wait…"
          : mode === "login"
            ? "Sign in"
            : "Create account"}
      </button>

      <p className="mt-2 text-center text-base text-muted">
        {mode === "login" ? (
          <>
            New to Wondavu?{" "}
            <Link
              href={next ? `/signup?next=${encodeURIComponent(next)}` : "/signup"}
              className="text-glow hover:underline"
            >
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link
              href={next ? `/login?next=${encodeURIComponent(next)}` : "/login"}
              className="text-glow hover:underline"
            >
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
    </div>
  );
}

function Field({
  label,
  name,
  hint,
  ...props
}: {
  label: string;
  name: string;
  /** Optional one-liner shown beneath the input — used to show the
   *  password complexity rule BEFORE the user submits. */
  hint?: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-base font-semibold text-muted">{label}</span>
      <input name={name} required className={fieldClass} {...props} />
      {hint && (
        <span className="text-xs text-muted/80">{hint}</span>
      )}
    </label>
  );
}

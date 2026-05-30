"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signIn, signInWithGoogle, signUp } from "@/features/auth/actions";
import { type AuthState, initialAuthState } from "@/features/auth/types";

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
      {/* Google OAuth — frictionless path. Lives in its own <form> so it
          can POST to the OAuth Server Action without nesting under the
          email/password form below. */}
      <form action={signInWithGoogle}>
        {next && <input type="hidden" name="next" value={next} />}
        <button
          type="submit"
          className="wc-frame flex w-full items-center justify-center gap-3 rounded-lg bg-white px-4 py-2.5 text-lg font-semibold text-foreground transition-opacity hover:opacity-90 active:opacity-80"
        >
          <GoogleGlyph />
          {mode === "login" ? "Sign in with Google" : "Continue with Google"}
        </button>
      </form>

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
          />
          <Field
            label="Username"
            name="username"
            type="text"
            placeholder="alexrivera"
            autoComplete="username"
          />
        </>
      )}

      <Field
        label="Email"
        name="email"
        type="email"
        placeholder="you@example.com"
        autoComplete="email"
      />
      <Field
        label="Password"
        name="password"
        type="password"
        placeholder="••••••••"
        autoComplete={mode === "login" ? "current-password" : "new-password"}
      />

      {state.error && (
        <p className="text-base text-heat" role="alert">
          {state.error}
        </p>
      )}
      {state.message && (
        <p className="text-base text-cool" role="status">
          {state.message}
        </p>
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

/** Multi-colour Google "G" mark. Inline SVG so we don't ship a PNG. */
function GoogleGlyph() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" aria-hidden>
      <path
        fill="#4285F4"
        d="M23.4 12.27c0-.84-.07-1.65-.21-2.42H12v4.59h6.4c-.28 1.5-1.13 2.77-2.4 3.62v3.01h3.88c2.27-2.09 3.58-5.17 3.58-8.8z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.96-1.07 7.95-2.91l-3.88-3.01c-1.08.72-2.46 1.15-4.07 1.15-3.13 0-5.78-2.12-6.73-4.97H1.25v3.12C3.23 21.31 7.32 24 12 24z"
      />
      <path
        fill="#FBBC04"
        d="M5.27 14.26A7.21 7.21 0 014.9 12c0-.78.13-1.55.37-2.26V6.62H1.25A12 12 0 000 12c0 1.93.46 3.76 1.25 5.38l4.02-3.12z"
      />
      <path
        fill="#EA4335"
        d="M12 4.77c1.77 0 3.35.61 4.6 1.8l3.43-3.43C17.95 1.19 15.24 0 12 0 7.32 0 3.23 2.69 1.25 6.62l4.02 3.12C6.22 6.89 8.87 4.77 12 4.77z"
      />
    </svg>
  );
}

function Field({
  label,
  name,
  ...props
}: {
  label: string;
  name: string;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-base font-semibold text-muted">{label}</span>
      <input name={name} required className={fieldClass} {...props} />
    </label>
  );
}

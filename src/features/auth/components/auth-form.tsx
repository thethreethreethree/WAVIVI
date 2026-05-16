"use client";

import Link from "next/link";
import { useActionState } from "react";

import { signIn, signUp } from "@/features/auth/actions";
import { type AuthState, initialAuthState } from "@/features/auth/types";

type Mode = "login" | "signup";

const fieldClass =
  "w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-sm " +
  "outline-none transition-colors placeholder:text-muted focus-visible:border-glow";

export function AuthForm({ mode }: { mode: Mode }) {
  const action = mode === "login" ? signIn : signUp;
  const [state, formAction, pending] = useActionState<AuthState, FormData>(
    action,
    initialAuthState,
  );

  return (
    <form action={formAction} className="flex flex-col gap-3">
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
        <p className="text-sm text-heat" role="alert">
          {state.error}
        </p>
      )}
      {state.message && (
        <p className="text-sm text-cool" role="status">
          {state.message}
        </p>
      )}

      <button
        type="submit"
        disabled={pending}
        className="mt-1 rounded-lg bg-glow px-4 py-2.5 text-sm font-medium text-white
                   transition-opacity hover:opacity-90 active:opacity-80
                   disabled:cursor-not-allowed disabled:opacity-50"
      >
        {pending
          ? "Please wait…"
          : mode === "login"
            ? "Sign in"
            : "Create account"}
      </button>

      <p className="mt-2 text-center text-sm text-muted">
        {mode === "login" ? (
          <>
            New to WAVIVI?{" "}
            <Link href="/signup" className="text-glow hover:underline">
              Create an account
            </Link>
          </>
        ) : (
          <>
            Already have an account?{" "}
            <Link href="/login" className="text-glow hover:underline">
              Sign in
            </Link>
          </>
        )}
      </p>
    </form>
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
      <span className="text-xs font-medium text-muted">{label}</span>
      <input name={name} required className={fieldClass} {...props} />
    </label>
  );
}

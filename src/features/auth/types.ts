/** Shape returned to `useActionState` in the auth form.
 *
 *  `values` is the echo-back of what the user typed so the inputs can
 *  re-populate on a validation failure instead of clearing out. The
 *  password is intentionally NOT echoed — passwords never round-trip
 *  through React state. */
export interface AuthState {
  error: string | null;
  message: string | null;
  values?: {
    email?: string;
    username?: string;
    displayName?: string;
  };
}

export const initialAuthState: AuthState = { error: null, message: null };

/** Single source of truth for the project's password rule. Mirrors the
 *  Supabase Auth project policy (Authentication → Policies → Passwords
 *  → "Letters and digits and symbols and lower and upper case"). When
 *  the dashboard policy changes, update both this regex and the
 *  human-readable string below. */
export const PASSWORD_RULE_REGEX =
  /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,}$/;

/** Human-readable description of the same rule. Surfaced UNDER the
 *  password field as a hint so users see it BEFORE they submit. */
export const PASSWORD_RULE_HINT =
  "At least 8 characters with a lowercase letter, an uppercase letter, a number, and a symbol.";

/** Friendly translation of the Supabase Auth verbose password error. */
export const PASSWORD_RULE_ERROR = `Password must have ${PASSWORD_RULE_HINT.replace(/^At least /, "")}`;

/** Username validation rule — kept in sync with the server check in
 *  `signUp` (src/features/auth/actions.ts) which rejects anything
 *  outside /^[a-z0-9_]{3,24}$/. Surfaced under the field so users
 *  don't fail validation silently and only learn the constraint AFTER
 *  hitting submit. */
export const USERNAME_RULE_HINT =
  "3–24 characters: lowercase letters, numbers, underscores.";

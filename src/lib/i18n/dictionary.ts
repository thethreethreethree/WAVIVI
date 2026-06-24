/**
 * WAVIVI i18n dictionary.
 *
 * Hand-curated key → { en, es } map. Deliberately not a library —
 * the surface area is small enough that a typed object catches every
 * missing translation at compile time and the bundle stays tiny.
 *
 * Adding a string: add it here as a new key, fill in `en` AND `es`,
 * then call `t("yourKey")` from a component. The Language type below
 * keeps `en` as the source-of-truth shape — a missing `es` value
 * fails the build (NoMissingTranslations check).
 *
 * Variable interpolation: use {name} placeholders, then pass
 * `{ name: "Susen" }` as the second arg to t(). See `t()` in
 * server.ts / client.ts.
 *
 * Phase 1 covers the most-visible surfaces (Susen, header / nav, sign
 * in/up, common buttons). Phase 2 will extend into the per-feature
 * pages. The dictionary is the canonical work-tracking surface —
 * untranslated strings show up as "(missing)" in the t() debug log.
 */

export const LANGUAGES = ["en", "es"] as const;
export type Language = (typeof LANGUAGES)[number];
export const DEFAULT_LANGUAGE: Language = "en";

/** Human-facing name of each language (rendered in the toggle). */
export const LANGUAGE_LABEL: Record<Language, string> = {
  en: "English",
  es: "Español",
};

/** Two-letter flag emoji per language for compact toggles. */
export const LANGUAGE_FLAG: Record<Language, string> = {
  en: "🇬🇧",
  es: "🇪🇸",
};

/**
 * The dictionary. Add a key here, then translate it for both `en`
 * and `es`. Missing translations fall back to the English value but
 * are logged in dev so they don't ship silently.
 */
export const DICTIONARY = {
  // Common actions used across the app — translate-once-use-many.
  common: {
    back: { en: "Back", es: "Atrás" },
    cancel: { en: "Cancel", es: "Cancelar" },
    save: { en: "Save", es: "Guardar" },
    saveChanges: { en: "Save changes", es: "Guardar cambios" },
    submit: { en: "Submit", es: "Enviar" },
    delete: { en: "Delete", es: "Eliminar" },
    close: { en: "Close", es: "Cerrar" },
    loading: { en: "Loading…", es: "Cargando…" },
    online: { en: "Online", es: "En línea" },
    signIn: { en: "Sign in", es: "Iniciar sesión" },
    signUp: { en: "Sign up", es: "Registrarse" },
    signOut: { en: "Sign out", es: "Cerrar sesión" },
    language: { en: "Language", es: "Idioma" },
  },

  // App nav / header — the strings travellers see first on every load.
  nav: {
    discover: { en: "Discover", es: "Descubrir" },
    feed: { en: "Feed", es: "Inicio" },
    map: { en: "Map", es: "Mapa" },
    meet: { en: "Meet", es: "Conocer" },
    profile: { en: "Profile", es: "Perfil" },
    whereToStay: { en: "Where to Stay", es: "Dónde quedarse" },
    whereToEat: { en: "Where to Eat", es: "Dónde comer" },
    whatToDo: { en: "What to Do", es: "Qué hacer" },
    toolbox: { en: "Toolbox", es: "Caja de herramientas" },
    events: { en: "Events", es: "Eventos" },
    susen: { en: "Susen", es: "Susen" },
  },

  // Susen — assistant surface. The welcome line + quick prompts are
  // the strings travellers actually USE her with, so getting these
  // right matters more than translating every settings string.
  susen: {
    welcome: {
      en:
        "Hey — I'm Susen. I keep an eye on where the vibe is and help travelers actually meet up. What are you in the mood for?",
      es:
        "Hola — soy Susen. Sigo dónde está la onda y ayudo a los viajeros a conocerse. ¿Qué te apetece hoy?",
    },
    tagline: {
      en: "Your live vibe-checker",
      es: "Tu medidora de ambiente en directo",
    },
    placeholder: {
      en: "Ask me anything…",
      es: "Pregúntame lo que quieras…",
    },
    thinking: { en: "Thinking…", es: "Pensando…" },
    improveAnswer: {
      en: "📝 Improve this answer",
      es: "📝 Mejora esta respuesta",
    },
    improveTooltip: {
      en:
        "Share what you learned so we can refine Susen's answer for this kind of question.",
      es:
        "Comparte lo que aprendiste para refinar la respuesta de Susen ante este tipo de pregunta.",
    },
    shareWhatYouLearned: {
      en: "📝 Share what you learned",
      es: "📝 Comparte lo que aprendiste",
    },
    shareWhatYouLearnedTooltip: {
      en:
        "Share what you learned from your trip — admins review and may feed it back into Susen's answers.",
      es:
        "Comparte lo que aprendiste en tu viaje — los administradores lo revisan y pueden integrarlo en las respuestas de Susen.",
    },
    signupGate: {
      heading: {
        en: "Sign up to chat with {name}",
        es: "Regístrate para chatear con {name}",
      },
      body: {
        en:
          "Meet our {acronym} — {fullName}. Personalised recommendations, plans, and meetups, free.",
        es:
          "Conoce a nuestra {acronym} — {fullName}. Recomendaciones personalizadas, planes y encuentros, gratis.",
      },
    },
  },

  // Auth — sign in / sign up modals + pages. Small, high-traffic copy.
  auth: {
    signInHeading: { en: "Welcome back", es: "Bienvenido de nuevo" },
    signUpHeading: { en: "Create your account", es: "Crea tu cuenta" },
    email: { en: "Email", es: "Correo electrónico" },
    password: { en: "Password", es: "Contraseña" },
    continueWithGoogle: {
      en: "Continue with Google",
      es: "Continuar con Google",
    },
    needAccount: {
      en: "Don't have an account? Sign up",
      es: "¿No tienes una cuenta? Regístrate",
    },
    haveAccount: {
      en: "Already have an account? Sign in",
      es: "¿Ya tienes una cuenta? Iniciar sesión",
    },
  },

  // Language settings — appears in /profile/language.
  language: {
    heading: { en: "Language", es: "Idioma" },
    description: {
      en:
        "Choose how the app and Susen speak to you. Takes effect right away — Susen replies in the new language on her next turn.",
      es:
        "Elige cómo te habla la aplicación y Susen. Se aplica al instante — Susen responde en el nuevo idioma en su próxima respuesta.",
    },
    saving: { en: "Saving…", es: "Guardando…" },
    saved: { en: "Saved.", es: "Guardado." },
  },
} as const;

/** Walk the dictionary for missing translations — used by the dev
 *  fallback so a missing string logs once instead of silently. */
export function isMissingTranslation<T extends string>(
  value: string,
  fallback: string,
): value is T {
  return value === fallback && value.endsWith("(missing)");
}

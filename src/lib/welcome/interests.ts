/** Cookie used by Susen + the feed ranker to skew recommendations
 *  toward what the user picked in welcome step 2 (vibe). Stored as a
 *  comma-separated string so the read path is a single split — no
 *  JSON.parse on every request.
 *
 *  Lives in its own module (rather than alongside the welcome server
 *  actions) because Next.js' "use server" files can only export async
 *  functions; a plain string export from there is rejected at build
 *  time with "module has no exports." Same constraint that bit the
 *  Turbopack "use server" type re-export trap. */
export const INTERESTS_COOKIE = "wv-interests";

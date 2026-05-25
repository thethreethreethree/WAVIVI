"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";

import { flagImage } from "@/lib/travejor/account";
import { photoThumb } from "@/lib/utils/images";

/** A row returned by /api/users/search. Kept thin on purpose — the search
 *  endpoint only returns the fields we render in the dropdown. */
export interface SearchHit {
  id: string;
  username: string;
  display_name: string;
  avatar_url: string | null;
  home_country: string | null;
  bio: string | null;
  instagram_username: string | null;
  instagram_verified: boolean;
}

/**
 * User search dropdown for the Meet Travelers page. Searches across
 * three columns simultaneously: Wondavu username, Instagram handle, and
 * WhatsApp number (digits-only normalised on the server). Debounced
 * to ~250 ms so we don't spam the API on every keystroke.
 */
export function MeetUserSearch() {
  const [q, setQ] = useState("");
  const [hits, setHits] = useState<SearchHit[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  // Close on outside-click / Escape.
  useEffect(() => {
    function onDown(e: MouseEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // Debounced fetch. Short queries simply don't run; stale `hits`/`error`
  // stay in state but the dropdown is gated on `q.trim().length >= 2`, so
  // they aren't rendered. The next fetch overwrites them.
  useEffect(() => {
    const trimmed = q.trim();
    if (trimmed.length < 2) return;
    const ctrl = new AbortController();
    // eslint-disable-next-line react-hooks/set-state-in-effect -- pre-fetch UI flag for the debounced async lookup below
    setLoading(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/users/search?q=${encodeURIComponent(trimmed)}`,
          { signal: ctrl.signal },
        );
        const body = (await res.json()) as {
          results: SearchHit[];
          error?: string;
        };
        if (ctrl.signal.aborted) return;
        if (body.error) setError(body.error);
        else setError(null);
        setHits(body.results ?? []);
      } catch (e) {
        if ((e as { name?: string })?.name === "AbortError") return;
        setError("Search failed.");
      } finally {
        if (!ctrl.signal.aborted) setLoading(false);
      }
    }, 250);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [q]);

  return (
    <div ref={wrapRef} className="relative px-5 pt-2">
      <div className="wc-frame flex items-center gap-2 rounded-full bg-background px-3 py-1">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="h-4 w-4 text-muted"
          aria-hidden
        >
          <circle cx="11" cy="11" r="7" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          value={q}
          onChange={(e) => {
            setQ(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          placeholder="Find a traveler — @username, Instagram, or WhatsApp"
          className="flex-1 bg-transparent py-1.5 text-sm outline-none placeholder:text-muted"
        />
        {q && (
          <button
            type="button"
            aria-label="Clear"
            onClick={() => {
              setQ("");
              setHits([]);
            }}
            className="rounded-full px-1 text-muted hover:text-foreground"
          >
            ×
          </button>
        )}
      </div>

      {open && q.trim().length >= 2 && (
        <div className="wc-frame absolute inset-x-5 top-full z-40 mt-2 overflow-hidden rounded-2xl bg-surface shadow-card">
          {loading && (
            <p className="px-4 py-3 text-center text-xs font-semibold text-muted">
              Searching…
            </p>
          )}
          {!loading && error && (
            <p className="px-4 py-3 text-center text-xs font-semibold text-heat">
              {error}
            </p>
          )}
          {!loading && !error && hits.length === 0 && (
            <p className="px-4 py-3 text-center text-xs font-semibold text-muted">
              No travelers match &ldquo;{q.trim()}&rdquo;. Try a full @username
              or paste a WhatsApp number.
            </p>
          )}
          {!loading && hits.length > 0 && (
            <ul>
              {hits.map((h, i) => (
                <li
                  key={h.id}
                  className={i > 0 ? "border-t border-border" : ""}
                >
                  <Link
                    href={`/u/${h.username}`}
                    onClick={() => setOpen(false)}
                    className="flex items-start gap-3 px-3 py-2.5 hover:bg-foreground/5"
                  >
                    <span className="relative h-10 w-10 shrink-0">
                      <span className="block h-full w-full overflow-hidden rounded-full bg-surface ring-1 ring-border">
                        {h.avatar_url ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={photoThumb(h.avatar_url, 96)}
                            alt=""
                            loading="lazy"
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          <span className="flex h-full w-full items-center justify-center text-sm font-bold text-glow">
                            {h.display_name.slice(0, 1).toUpperCase()}
                          </span>
                        )}
                      </span>
                      {h.home_country && (
                        <span
                          className="pointer-events-none absolute -bottom-0.5 -right-0.5 block h-4 w-4 overflow-hidden rounded-full bg-white ring-1 ring-background"
                          title={h.home_country}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={flagImage(h.home_country)}
                            alt={h.home_country}
                            referrerPolicy="no-referrer"
                            className="h-full w-full object-cover"
                          />
                        </span>
                      )}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1 truncate text-sm font-bold">
                        {h.display_name}
                        {h.instagram_verified && (
                          <span
                            title="Verified Instagram"
                            className="flex h-4 w-4 items-center justify-center rounded-full bg-cool text-[9px] text-white"
                          >
                            ✓
                          </span>
                        )}
                      </span>
                      <span className="block truncate text-xs text-muted">
                        @{h.username}
                        {h.instagram_username && (
                          <>
                            {" · "}
                            <span className="text-glow">
                              📷 {h.instagram_username}
                            </span>
                          </>
                        )}
                      </span>
                      {h.bio && (
                        <span className="block truncate text-[11px] italic text-muted">
                          {h.bio}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

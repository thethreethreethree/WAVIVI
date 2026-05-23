import type { Metadata } from "next";
import Link from "next/link";

import { ScreenHeader } from "@/components/ui/screen-header";
import { getNotesForRecipient } from "@/lib/notes";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Traveler Notes" };
export const dynamic = "force-dynamic";

export default async function NotesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Logged-out visitors get a soft prompt — notes are tied to a recipient,
  // so there's nothing meaningful to show without an account.
  if (!user) {
    return (
      <div className="flex flex-1 flex-col">
        <ScreenHeader title="Traveler Notes" />
        <div className="px-5 pb-8 pt-2">
          <p className="rounded-2xl bg-surface/70 px-4 py-8 text-center text-sm text-muted ring-1 ring-border">
            Sign in to see the notes other travelers have left for you.
            <br />
            <Link
              href="/login?next=/notes"
              className="mt-2 inline-block font-bold text-glow underline-offset-4 hover:underline"
            >
              Sign in →
            </Link>
          </p>
        </div>
      </div>
    );
  }

  const notes = await getNotesForRecipient(user.id, 50);

  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Traveler Notes" />

      <p className="px-5 pb-2 text-sm text-muted">
        Notes other travelers have left on your profile. Community-written notes
        build real, traveler-to-traveler trust.
      </p>

      {notes.length === 0 ? (
        <div className="px-5 py-6">
          <p className="rounded-2xl bg-surface/70 px-4 py-8 text-center text-sm text-muted ring-1 ring-border">
            No notes yet — they&apos;ll show up here once another traveler leaves
            one on your profile.
          </p>
        </div>
      ) : (
        <ul className="flex flex-col gap-3 px-5 pb-8 pt-2">
          {notes.map((note) => (
            <li key={note.id} className="wc-frame rounded-2xl p-4">
              <div className="flex items-center gap-2">
                <Link
                  href={`/u/${note.author_username}`}
                  className="flex items-center gap-2 transition-opacity active:opacity-70"
                >
                  <span className="wc-frame relative h-8 w-8 rounded-full p-1">
                    <span className="relative block h-full w-full overflow-hidden rounded-full bg-surface">
                      {note.author_avatar_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={note.author_avatar_url}
                          alt={note.author_display_name}
                          loading="lazy"
                          referrerPolicy="no-referrer"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <span className="flex h-full w-full items-center justify-center text-[11px] font-bold text-glow">
                          {note.author_display_name.slice(0, 1).toUpperCase()}
                        </span>
                      )}
                    </span>
                  </span>
                  <span className="text-sm font-semibold">
                    {note.author_display_name}
                  </span>
                </Link>
                <span className="ml-auto text-xs text-muted">
                  {fmtRelative(note.created_at)}
                </span>
              </div>
              <p className="mt-2 text-sm text-foreground/90">
                &ldquo;{note.body}&rdquo;
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function fmtRelative(iso: string): string {
  try {
    const ms = Date.now() - new Date(iso).getTime();
    const m = Math.floor(ms / 60_000);
    if (m < 1) return "just now";
    if (m < 60) return `${m} min ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return new Date(iso).toLocaleDateString();
  } catch {
    return "";
  }
}

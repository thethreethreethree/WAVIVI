import type { Metadata } from "next";
import Image from "next/image";

import { ScreenHeader } from "@/components/ui/screen-header";
import { travelerNotes } from "@/lib/travejor/account";

export const metadata: Metadata = { title: "Traveler Notes" };

export default function NotesPage() {
  return (
    <div className="flex flex-1 flex-col">
      <ScreenHeader title="Traveler Notes" />

      <p className="px-5 pb-2 text-sm text-muted">
        Community-written notes build real, traveler-to-traveler trust.
      </p>

      <ul className="flex flex-col gap-3 px-5 pb-8 pt-2">
        {travelerNotes.map((note) => (
          <li
            key={note.id}
            className="wc-frame rounded-2xl p-4"
          >
            <div className="flex items-center gap-2">
              <span className="wc-frame relative h-8 w-8 rounded-full p-1">
                <span className="relative block h-full w-full overflow-hidden rounded-full">
                  <Image
                    src={note.fromAvatar}
                    alt={note.from}
                    fill
                    sizes="28px"
                    className="object-cover"
                  />
                </span>
              </span>
              <span className="text-sm font-semibold">{note.from}</span>
              <span className="ml-auto text-xs text-muted">{note.time}</span>
            </div>
            <p className="mt-2 text-sm text-foreground/90">
              &ldquo;{note.text}&rdquo;
            </p>
          </li>
        ))}
      </ul>
    </div>
  );
}

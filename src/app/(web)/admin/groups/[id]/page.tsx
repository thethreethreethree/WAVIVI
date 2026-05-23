import Link from "next/link";
import { notFound } from "next/navigation";

import { GroupMembersList } from "@/components/admin/groups/members-list";
import { getChatGroup, getChatGroupMembers } from "@/lib/chat";

export const dynamic = "force-dynamic";

export default async function AdminGroupMembersPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const [group, members] = await Promise.all([
    getChatGroup(id),
    getChatGroupMembers(id),
  ]);
  if (!group) notFound();

  const featuredCount = members.filter((m) => m.featured).length;

  return (
    <div className="flex flex-col gap-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">
            Group members
          </p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight">
            {group.name}
          </h1>
          <p className="text-sm text-muted">
            {members.length} traveler{members.length === 1 ? "" : "s"}
            {featuredCount > 0 ? ` · ${featuredCount} featured` : ""}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin/groups"
            className="rounded-full bg-foreground/10 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-foreground/15"
          >
            ← All groups
          </Link>
          <Link
            href={`/meet/${id}`}
            target="_blank"
            className="rounded-full bg-foreground/10 px-3 py-1.5 text-xs font-bold text-foreground hover:bg-foreground/15"
          >
            View public page ↗
          </Link>
        </div>
      </header>

      <p className="rounded-2xl bg-surface px-4 py-3 text-xs text-muted shadow-card ring-1 ring-border">
        <strong className="text-foreground">Featured</strong> members appear in
        the Group Vibes "Featured Travelers" strip on{" "}
        <code className="rounded bg-background px-1">/meet/{id}</code>.{" "}
        <strong className="text-foreground">Kick</strong> removes the member —
        they can rejoin later from the group page.
      </p>

      <GroupMembersList groupId={id} members={members} />
    </div>
  );
}

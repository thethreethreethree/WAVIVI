import { GroupsList } from "@/components/admin/groups/groups-list";
import { listChatGroups } from "@/lib/chat";

export const dynamic = "force-dynamic";

export default async function AdminGroupsPage() {
  const groups = await listChatGroups();
  return <GroupsList groups={groups} />;
}

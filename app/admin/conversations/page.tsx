import { ConversationsClient } from "@/components/admin/clients/ConversationsClient";
import { getAdminConversationsData } from "@/lib/admin/metrics";
import { requireAdmin } from "@/lib/admin/guards";

export const dynamic = "force-dynamic";

export default async function AdminConversationsPage() {
  await requireAdmin("/admin/conversations");
  const rows = await getAdminConversationsData();
  return <ConversationsClient initialRows={rows} />;
}

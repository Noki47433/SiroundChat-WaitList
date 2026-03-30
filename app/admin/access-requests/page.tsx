import { requireAdmin } from "@/lib/admin/guards";
import { listPendingBusinessApprovals } from "@/lib/server/business-approvals";
import { AccessRequestsClient } from "@/components/admin/clients/AccessRequestsClient";

export const dynamic = "force-dynamic";

export default async function AdminAccessRequestsPage() {
  await requireAdmin("/admin/access-requests");

  const initialRequests = await listPendingBusinessApprovals();

  return <AccessRequestsClient initialRequests={initialRequests} />;
}

import { requireAdmin } from "@/lib/admin/guards";
import {
  listAccessRequests,
  listRecentManualInviteCodes
} from "@/lib/server/invite-access";
import { AccessRequestsClient } from "@/components/admin/clients/AccessRequestsClient";

export const dynamic = "force-dynamic";

export default async function AdminAccessRequestsPage() {
  await requireAdmin("/admin/access-requests");

  const [initialRequests, initialManualInvites] = await Promise.all([
    listAccessRequests("all"),
    listRecentManualInviteCodes(10)
  ]);

  return (
    <AccessRequestsClient
      initialRequests={initialRequests}
      initialManualInvites={initialManualInvites}
    />
  );
}

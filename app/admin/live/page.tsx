import { getAdminLiveData } from "@/lib/admin/metrics";
import { LiveClient } from "@/components/admin/clients/LiveClient";
import { requireAdmin } from "@/lib/admin/guards";

export const dynamic = "force-dynamic";

export default async function AdminLivePage() {
  await requireAdmin("/admin/live");
  const initialData = await getAdminLiveData();
  return <LiveClient initialData={initialData} />;
}

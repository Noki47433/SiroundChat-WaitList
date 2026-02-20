import { getAdminOverviewData } from "@/lib/admin/metrics";
import { OverviewClient } from "@/components/admin/clients/OverviewClient";
import { requireAdmin } from "@/lib/admin/guards";

export const dynamic = "force-dynamic";

export default async function AdminOverviewPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  await requireAdmin("/admin/overview");
  const range = typeof searchParams?.range === "string" ? searchParams.range : "30d";
  const initialData = await getAdminOverviewData(range);

  return <OverviewClient initialData={initialData} />;
}

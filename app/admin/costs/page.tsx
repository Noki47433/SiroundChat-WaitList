import { CostsClient } from "@/components/admin/clients/CostsClient";
import { getAdminCostsData } from "@/lib/admin/metrics";
import { requireAdmin } from "@/lib/admin/guards";

export const dynamic = "force-dynamic";

export default async function AdminCostsPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  await requireAdmin("/admin/costs");
  const range = typeof searchParams?.range === "string" ? searchParams.range : "30d";
  const initialData = await getAdminCostsData(range);
  return <CostsClient initialData={initialData} />;
}

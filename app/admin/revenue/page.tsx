import { RevenueClient } from "@/components/admin/clients/RevenueClient";
import { getAdminRevenueData } from "@/lib/admin/metrics";
import { requireAdmin } from "@/lib/admin/guards";

export const dynamic = "force-dynamic";

export default async function AdminRevenuePage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  await requireAdmin("/admin/revenue");
  const range = typeof searchParams?.range === "string" ? searchParams.range : "90d";
  const initialData = await getAdminRevenueData(range);
  return <RevenueClient initialData={initialData} />;
}

import { getAdminBusinessesData } from "@/lib/admin/metrics";
import { BusinessesClient } from "@/components/admin/clients/BusinessesClient";
import { requireAdmin } from "@/lib/admin/guards";

export const dynamic = "force-dynamic";

export default async function AdminBusinessesPage({
  searchParams
}: {
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  await requireAdmin("/admin/businesses");
  const range = typeof searchParams?.range === "string" ? searchParams.range : "7d";
  const initialData = await getAdminBusinessesData(range);

  return <BusinessesClient initialData={initialData} />;
}

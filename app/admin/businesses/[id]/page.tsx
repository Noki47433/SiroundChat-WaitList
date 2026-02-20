import { notFound } from "next/navigation";
import { getAdminBusinessDetailData } from "@/lib/admin/metrics";
import { BusinessDetailClient } from "@/components/admin/clients/BusinessDetailClient";
import { requireAdmin } from "@/lib/admin/guards";

export const dynamic = "force-dynamic";

export default async function AdminBusinessDetailPage({
  params,
  searchParams
}: {
  params: { id: string };
  searchParams?: Record<string, string | string[] | undefined>;
}) {
  await requireAdmin(`/admin/businesses/${params.id}`);
  const range = typeof searchParams?.range === "string" ? searchParams.range : "90d";
  const initialData = await getAdminBusinessDetailData(params.id, range);

  if (!initialData) {
    notFound();
  }

  return <BusinessDetailClient businessId={params.id} initialData={initialData} />;
}

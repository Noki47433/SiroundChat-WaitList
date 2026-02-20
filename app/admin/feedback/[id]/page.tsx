import { requireAdmin } from "@/lib/admin/guards";
import { adminGetFeedbackReport } from "@/lib/feedback/queries";
import { AdminFeedbackDetailClient } from "@/app/admin/feedback/_components/AdminFeedbackDetail.client";

export const dynamic = "force-dynamic";

export default async function AdminFeedbackDetailPage({
  params
}: {
  params: { id: string };
}) {
  await requireAdmin(`/admin/feedback/${params.id}`);
  const initialData = await adminGetFeedbackReport(params.id);
  return <AdminFeedbackDetailClient initialData={initialData} />;
}

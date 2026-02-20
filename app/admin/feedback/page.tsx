import { requireAdmin } from "@/lib/admin/guards";
import { adminListFeedbackReports } from "@/lib/feedback/queries";
import { AdminFeedbackBoard } from "@/app/admin/feedback/_components/AdminFeedbackBoard.client";

export const dynamic = "force-dynamic";

export default async function AdminFeedbackPage() {
  await requireAdmin("/admin/feedback");
  const initialData = await adminListFeedbackReports(
    { queue: "new", sort: "last_activity_desc" },
    { page: 1, pageSize: 25 }
  );

  return <AdminFeedbackBoard initialData={initialData} />;
}

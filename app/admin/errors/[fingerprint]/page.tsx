import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin/guards";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { AdminErrorDetail } from "@/app/admin/errors/_components/AdminErrorDetail.client";

export const dynamic = "force-dynamic";

export default async function AdminErrorDetailPage({
  params
}: {
  params: { fingerprint: string };
}) {
  await requireAdmin(`/admin/errors/${params.fingerprint}`);
  const supabase = getSupabaseServerClient();
  const fingerprint = decodeURIComponent(params.fingerprint);

  const [groupResult, eventsResult] = await Promise.all([
    (supabase as any).from("error_groups").select("*").eq("fingerprint", fingerprint).maybeSingle(),
    (supabase as any)
      .from("error_events")
      .select("id, created_at, severity, environment, source, message, stack, route, url, user_agent, business_id")
      .eq("fingerprint", fingerprint)
      .order("created_at", { ascending: false })
      .limit(20)
  ]);

  if (!groupResult.data) {
    notFound();
  }

  const businessIds = Array.from(new Set((eventsResult.data ?? []).map((event: any) => event.business_id).filter(Boolean)));
  const { data: businesses } = businessIds.length
    ? await (supabase as any).from("businesses").select("id, name, business_name").in("id", businessIds)
    : { data: [] as any[] };
  const businessMap = new Map(
    (businesses ?? []).map((business: any) => [business.id, business.name ?? business.business_name ?? "Unknown business"])
  );

  const linkedFeedbackId = groupResult.data.linked_feedback_id as string | null;
  const { data: linkedFeedback } = linkedFeedbackId
    ? await (supabase as any).from("feedback_reports").select("id, title, status").eq("id", linkedFeedbackId).maybeSingle()
    : { data: null };

  return (
    <AdminErrorDetail
      initialData={{
        group: groupResult.data as any,
        linked_feedback: (linkedFeedback as any) ?? null,
        events: (eventsResult.data ?? []).map((event: any) => ({
          ...event,
          business_name: event.business_id ? businessMap.get(event.business_id) ?? null : null
        })) as any
      }}
    />
  );
}


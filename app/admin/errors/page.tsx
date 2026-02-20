import { requireAdmin } from "@/lib/admin/guards";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { AdminErrorsBoard } from "@/app/admin/errors/_components/AdminErrorsBoard.client";

export const dynamic = "force-dynamic";

export default async function AdminErrorsPage() {
  await requireAdmin("/admin/errors");
  const supabase = getSupabaseServerClient();

  const [groupsResult, eventsResult, businessesResult] = await Promise.all([
    (supabase as any).from("error_groups").select("*").order("last_seen_at", { ascending: false }).limit(200),
    (supabase as any)
      .from("error_events")
      .select("fingerprint, severity, environment, business_id, created_at")
      .order("created_at", { ascending: false })
      .limit(4000),
    (supabase as any).from("businesses").select("id, name, business_name").order("created_at", { ascending: false }).limit(500)
  ]);

  const latestByFingerprint = new Map<string, any>();
  const recentCountByFingerprint = new Map<string, number>();
  const last24Ms = Date.now() - 24 * 60 * 60 * 1000;

  for (const event of eventsResult.data ?? []) {
    if (!latestByFingerprint.has(event.fingerprint)) {
      latestByFingerprint.set(event.fingerprint, event);
    }
    const stamp = new Date(event.created_at).getTime();
    if (Number.isFinite(stamp) && stamp >= last24Ms) {
      recentCountByFingerprint.set(event.fingerprint, (recentCountByFingerprint.get(event.fingerprint) ?? 0) + 1);
    }
  }

  const businessMap = new Map(
    (businessesResult.data ?? []).map((business: any) => [business.id, business.name ?? business.business_name ?? "Unknown business"])
  );

  const groups = (groupsResult.data ?? []).map((group: any) => {
    const latest = latestByFingerprint.get(group.fingerprint);
    return {
      ...group,
      severity: latest?.severity ?? "error",
      environment: latest?.environment ?? "prod",
      business_id: latest?.business_id ?? null,
      business_name: latest?.business_id ? businessMap.get(latest.business_id) ?? null : null,
      recent_24h_count: recentCountByFingerprint.get(group.fingerprint) ?? 0
    };
  });

  return (
    <AdminErrorsBoard
      initialGroups={groups as any}
      initialBusinesses={Array.from(businessMap.entries()).map(([id, name]) => ({ id: id as string, name: name as string }))}
    />
  );
}


import { requireAdmin } from "@/lib/admin/guards";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { AdminActivityFeed } from "@/app/admin/activity/_components/AdminActivityFeed.client";

export const dynamic = "force-dynamic";

export default async function AdminActivityPage() {
  await requireAdmin("/admin/activity");
  const supabase = getSupabaseServerClient();

  const [eventsResult, businessesResult] = await Promise.all([
    (supabase as any).from("activity_events").select("*").order("created_at", { ascending: false }).limit(300),
    (supabase as any).from("businesses").select("id, name, business_name").order("created_at", { ascending: false }).limit(500)
  ]);

  const businessMap = new Map(
    (businessesResult.data ?? []).map((business: any) => [business.id, business.name ?? business.business_name ?? "Unknown business"])
  );

  const rows = (eventsResult.data ?? []).map((event: any) => ({
    ...event,
    business_name: businessMap.get(event.business_id) ?? null
  }));

  const eventTypes: string[] = Array.from(
    new Set<string>(rows.map((row: any) => String(row.event_type ?? "")).filter(Boolean))
  ).sort();

  return (
    <AdminActivityFeed
      initialRows={rows as any}
      initialBusinesses={Array.from(businessMap.entries()).map(([id, name]) => ({ id: id as string, name: name as string }))}
      initialEventTypes={eventTypes}
    />
  );
}

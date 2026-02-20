import { requireAdmin } from "@/lib/admin/guards";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { AdminStatusClient } from "@/app/admin/status/_components/AdminStatusClient";

export const dynamic = "force-dynamic";

export default async function AdminStatusPage() {
  await requireAdmin("/admin/status");
  const supabase = getSupabaseServerClient();

  const [componentsResult, incidentsResult, linksResult, updatesResult] = await Promise.all([
    (supabase as any).from("system_components").select("*").order("sort_order", { ascending: true }),
    (supabase as any).from("status_incidents").select("*").order("started_at", { ascending: false }).limit(200),
    (supabase as any).from("status_incident_components").select("*"),
    (supabase as any).from("status_updates").select("*").order("created_at", { ascending: false }).limit(500)
  ]);

  return (
    <AdminStatusClient
      initialData={{
        components: (componentsResult.data ?? []) as any,
        incidents: (incidentsResult.data ?? []) as any,
        incident_components: (linksResult.data ?? []) as any,
        updates: (updatesResult.data ?? []) as any
      }}
    />
  );
}


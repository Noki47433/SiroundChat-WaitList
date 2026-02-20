import { requireAdmin } from "@/lib/admin/guards";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { AdminAnnouncementsClient } from "@/app/admin/announcements/_components/AdminAnnouncementsClient";

export const dynamic = "force-dynamic";

export default async function AdminAnnouncementsPage() {
  await requireAdmin("/admin/announcements");
  const supabase = getSupabaseServerClient();

  const [announcementsResult, businessesResult] = await Promise.all([
    (supabase as any).from("announcements").select("*").order("starts_at", { ascending: false }).limit(200),
    (supabase as any).from("businesses").select("id, name, business_name").order("created_at", { ascending: false }).limit(500)
  ]);

  return (
    <AdminAnnouncementsClient
      initialAnnouncements={(announcementsResult.data ?? []) as any}
      businesses={(businessesResult.data ?? []).map((business: any) => ({
        id: business.id,
        name: business.name ?? business.business_name ?? "Unknown business"
      }))}
    />
  );
}


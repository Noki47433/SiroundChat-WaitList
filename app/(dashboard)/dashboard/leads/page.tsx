import { Card } from "@/components/ui/card";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { log } from "@/lib/utils/log";
import { LeadsList, type LeadRow } from "@/app/(dashboard)/dashboard/leads/_components/LeadsList.client";

export const dynamic = "force-dynamic";

const getWeekAgoIso = () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

export default async function LeadsPage() {
  const supabase = getSupabaseServerClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) {
    log("error", "Failed to resolve auth session", { error: userError });
    return <p className="text-sm text-white/60">Unable to load leads.</p>;
  }

  if (!user) {
    return <p className="text-sm text-white/60">Please sign in.</p>;
  }

  const { data: business, error: businessError } = await (supabase as any)
    .from("businesses")
    .select("id, business_name, industry")
    .eq("owner_id", user.id)
    .maybeSingle();

  if (businessError) {
    log("error", "Failed to load business for leads", { error: businessError });
    return <p className="text-sm text-white/60">Unable to load leads.</p>;
  }

  if (!business?.id) {
    return <p className="text-sm text-white/60">No business found.</p>;
  }

  const weekAgo = getWeekAgoIso();

  const [leadsResult, totalResult, recentResult] = await Promise.all([
    (supabase as any)
      .from("leads")
      .select("id, name, email, phone, conversation_id, source, created_at")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(200),
    (supabase as any)
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id),
    (supabase as any)
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .gte("created_at", weekAgo)
  ]);

  if (leadsResult.error || totalResult.error || recentResult.error) {
    log("error", "Failed to load leads data", {
      leadsError: leadsResult.error,
      totalError: totalResult.error,
      recentError: recentResult.error
    });
    return <p className="text-sm text-white/60">Unable to load leads.</p>;
  }

  const leads = (leadsResult.data ?? []) as LeadRow[];
  const totalLeads = totalResult.count ?? 0;
  const leadsLast7Days = recentResult.count ?? 0;

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs uppercase tracking-[0.2em] text-white/40">Leads</p>
        <h2 className="mt-2 text-3xl font-semibold text-white">Leads</h2>
        <p className="mt-2 text-sm text-white/60">
          Captured automatically from chat when visitors share contact details.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Total leads</p>
          <p className="mt-2 text-2xl font-semibold text-white">{totalLeads}</p>
          <p className="mt-1 text-xs text-white/50">All time</p>
        </div>
        <div className="rounded-2xl border border-white/10 bg-white/5 p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Leads last 7 days</p>
          <p className="mt-2 text-2xl font-semibold text-white">{leadsLast7Days}</p>
          <p className="mt-1 text-xs text-white/50">Recent momentum</p>
        </div>
      </div>

      <Card>
        <LeadsList leads={leads} />
      </Card>
    </div>
  );
}

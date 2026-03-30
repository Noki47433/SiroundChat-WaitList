import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { log } from "@/lib/utils/log";
import { LeadsList, type LeadRow } from "@/app/(dashboard)/dashboard/leads/_components/LeadsList.client";
import { formatLeadRelativeTime } from "@/app/(dashboard)/dashboard/leads/_components/lead-presenter";

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
    .or(`owner_id.eq.${user.id},owner_user_id.eq.${user.id}`)
    .eq("launch_access", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (businessError) {
    log("error", "Failed to load business for leads", { error: businessError });
    return <p className="text-sm text-white/60">Unable to load leads.</p>;
  }

  if (!business?.id) {
    return <p className="text-sm text-white/60">No business found.</p>;
  }

  const weekAgo = getWeekAgoIso();

  const [leadsResult, totalResult, recentResult, chatbotResult, contactFormResult] = await Promise.all([
    (supabase as any)
      .from("leads")
      .select("id, name, email, phone, conversation_id, source, lead_type, payload, created_at")
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
      .gte("created_at", weekAgo),
    (supabase as any)
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .or("lead_type.eq.chat,source.eq.widget,conversation_id.not.is.null"),
    (supabase as any)
      .from("leads")
      .select("id", { count: "exact", head: true })
      .eq("business_id", business.id)
      .or("lead_type.eq.contact_form,source.eq.website_form")
  ]);

  if (leadsResult.error || totalResult.error || recentResult.error || chatbotResult.error || contactFormResult.error) {
    log("error", "Failed to load leads data", {
      leadsError: leadsResult.error,
      totalError: totalResult.error,
      recentError: recentResult.error,
      chatbotError: chatbotResult.error,
      contactFormError: contactFormResult.error
    });
    return <p className="text-sm text-white/60">Unable to load leads.</p>;
  }

  const leads = (leadsResult.data ?? []) as LeadRow[];
  const totalLeads = totalResult.count ?? 0;
  const leadsLast7Days = recentResult.count ?? 0;
  const chatbotLeads = chatbotResult.count ?? 0;
  const contactFormLeads = contactFormResult.count ?? 0;
  const latestLead = leads[0] ?? null;
  const headline = business.business_name?.trim() || "Your business";
  const summaryCards = [
    {
      label: "Total leads",
      value: totalLeads,
      note: "All captured opportunities",
      accent: "bg-[#00A3FF]"
    },
    {
      label: "Last 7 days",
      value: leadsLast7Days,
      note: "Recent inbound momentum",
      accent: "bg-emerald-400"
    },
    {
      label: "Chatbot leads",
      value: chatbotLeads,
      note: "Captured after live conversations",
      accent: "bg-violet-400"
    },
    {
      label: "Contact forms",
      value: contactFormLeads,
      note: "Direct website submissions",
      accent: "bg-amber-400"
    }
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-3">
            <p className="text-[11px] uppercase tracking-[0.28em] text-white/38">Leads</p>
            {business.industry ? (
              <Badge className="border border-white/10 bg-white/[0.04] text-white/62">{business.industry}</Badge>
            ) : null}
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-semibold tracking-tight text-white">Lead pipeline for {headline}</h2>
            <p className="max-w-3xl text-sm leading-6 text-white/58">
              High-intent chatbot captures and website submissions in one operational view, with clearer routing into follow-up.
            </p>
          </div>
        </div>

        <Card className="rounded-2xl border-transparent bg-[#10161e] px-5 py-4 shadow-[0_18px_40px_rgba(0,0,0,0.24)] xl:max-w-sm">
          <p className="text-[11px] uppercase tracking-[0.22em] text-white/38">Most recent activity</p>
          <p className="mt-2 text-sm font-medium text-white">
            {latestLead ? `${latestLead.name?.trim() || latestLead.email?.trim() || "New lead"} came in ${formatLeadRelativeTime(latestLead.created_at)}.` : "No leads captured yet."}
          </p>
          <p className="mt-2 text-xs text-white/48">
            Keep this queue tight so new opportunities do not sit without a follow-up path.
          </p>
        </Card>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {summaryCards.map((card) => (
          <Card
            key={card.label}
            className="rounded-2xl border-transparent bg-[#10161e] p-4 shadow-[0_16px_34px_rgba(0,0,0,0.2)]"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-1.5">
                <p className="text-[11px] uppercase tracking-[0.2em] text-white/38">{card.label}</p>
                <p className="text-2xl font-semibold tracking-tight text-white">{card.value}</p>
                <p className="text-xs text-white/48">{card.note}</p>
              </div>
              <span className={`mt-1 h-2.5 w-2.5 rounded-full ${card.accent}`} />
            </div>
          </Card>
        ))}
      </div>

      <LeadsList leads={leads} />
    </div>
  );
}

import Link from "next/link";
import { ArrowLeft, ArrowUpRight, Mail, MessageSquareText, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { buttonVariants } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSupabaseServerClient } from "@/lib/supabase/server";
import { log } from "@/lib/utils/log";
import {
  formatLeadDateTime,
  getLeadMessage,
  getLeadPayloadEntries,
  getLeadPresentation,
  resolveLeadName
} from "@/app/(dashboard)/dashboard/leads/_components/lead-presenter";

export const dynamic = "force-dynamic";

export default async function LeadDetailPage({ params }: { params: { id: string } }) {
  const supabase = getSupabaseServerClient();
  const {
    data: { user },
    error: userError
  } = await supabase.auth.getUser();

  if (userError) {
    log("error", "Failed to resolve auth session for lead detail", { error: userError });
    return <p className="text-sm text-white/60">Unable to load lead.</p>;
  }

  if (!user) {
    return <p className="text-sm text-white/60">Please sign in.</p>;
  }

  const { data: business, error: businessError } = await (supabase as any)
    .from("businesses")
    .select("id, business_name")
    .or(`owner_id.eq.${user.id},owner_user_id.eq.${user.id}`)
    .eq("launch_access", true)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (businessError) {
    log("error", "Failed to load business for lead detail", { error: businessError });
    return <p className="text-sm text-white/60">Unable to load lead.</p>;
  }

  if (!business?.id) {
    return <p className="text-sm text-white/60">No business found.</p>;
  }

  const { data: lead, error: leadError } = await (supabase as any)
    .from("leads")
    .select("id, name, email, phone, conversation_id, source, lead_type, payload, created_at")
    .eq("id", params.id)
    .eq("business_id", business.id)
    .maybeSingle();

  if (leadError) {
    log("error", "Failed to load lead detail", { error: leadError, leadId: params.id });
    return <p className="text-sm text-white/60">Unable to load lead.</p>;
  }

  if (!lead?.id) {
    return (
      <Card className="rounded-2xl border-white/8 bg-[#0f131a]">
        <p className="text-sm text-white/70">Lead not found.</p>
        <Link href="/dashboard/leads" className="mt-4 inline-flex text-sm font-medium text-[#00A3FF] hover:underline">
          Back to leads
        </Link>
      </Card>
    );
  }

  const presentation = getLeadPresentation(lead);
  const payloadEntries = getLeadPayloadEntries(lead);
  const message = getLeadMessage(lead);
  const hasDirectContact = Boolean(lead.email?.trim() || lead.phone?.trim());
  const businessName = business.business_name?.trim() || "Your business";

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3">
        <Link
          href="/dashboard/leads"
          className="inline-flex items-center gap-2 text-sm font-medium text-white/55 transition hover:text-white"
        >
          <ArrowLeft className="h-4 w-4" />
          Back to leads
        </Link>

        <Card className="overflow-hidden rounded-[28px] border-transparent bg-[#10161e] p-0 shadow-[0_22px_50px_rgba(0,0,0,0.24)]">
          <div className="px-6 py-6">
            <div className="flex flex-col gap-5">
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-[11px] uppercase tracking-[0.26em] text-white/38">Lead detail</p>
                  <Badge variant={presentation.kindVariant}>{presentation.kindLabel}</Badge>
                  <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/42">{presentation.statusLabel}</span>
                </div>
                <div className="space-y-2">
                  <h1 className="text-3xl font-semibold tracking-tight text-white">{resolveLeadName(lead.name)}</h1>
                  <p className="max-w-3xl text-sm leading-6 text-white/58">
                    {presentation.summary} Routed into {businessName}&rsquo;s lead pipeline for follow-up and qualification.
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-white/56">
                <span>{presentation.sourceLabel}</span>
                <span>{presentation.contactLabel}</span>
                <span>{formatLeadDateTime(lead.created_at)}</span>
              </div>
            </div>
          </div>
        </Card>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="space-y-5">
          {message ? (
            <Card className="rounded-[24px] border-transparent bg-[linear-gradient(180deg,rgba(0,163,255,0.12),rgba(16,22,30,0.94))] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
              <div className="flex items-start gap-3">
                <div className="mt-0.5 rounded-xl bg-[#00A3FF]/12 p-2 text-[#78d1ff]">
                  <MessageSquareText className="h-4 w-4" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] uppercase tracking-[0.22em] text-[#9edfff]">Submission message</p>
                  <p className="mt-3 text-base leading-7 text-white/88">{message}</p>
                </div>
              </div>
            </Card>
          ) : null}

          <Card className="rounded-[24px] border-transparent bg-[#10161e] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-white">Submission details</p>
                <p className="mt-1 text-sm text-white/52">
                  Cleaned and grouped fields captured with this lead.
                </p>
              </div>
            </div>

            {payloadEntries.length ? (
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {payloadEntries.map((entry) => (
                  <div key={entry.key} className="rounded-2xl bg-[#0b1016] px-4 py-4">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-white/38">{entry.label}</p>
                    <p className="mt-2 text-sm leading-6 text-white/82">{entry.value}</p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-5 text-sm text-white/55">No additional submission fields were captured for this lead.</p>
            )}
          </Card>
        </div>

        <div>
          <Card className="rounded-[24px] border-transparent bg-[#10161e] p-5 shadow-[0_18px_40px_rgba(0,0,0,0.18)]">
            <p className="text-sm font-semibold text-white">Lead snapshot</p>

            <div className="mt-5 space-y-5">
              <div className="space-y-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/38">Contact info</p>
                <div className="space-y-3">
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-[#00A3FF]/12 p-2 text-[#78d1ff]">
                      <Mail className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/38">Email</p>
                      <p className="mt-1 truncate text-sm text-white">{lead.email?.trim() || "No email submitted"}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <div className="rounded-xl bg-emerald-400/12 p-2 text-emerald-300">
                      <Phone className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[11px] uppercase tracking-[0.18em] text-white/38">Phone</p>
                      <p className="mt-1 truncate text-sm text-white">{lead.phone?.trim() || "No phone submitted"}</p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="h-px bg-white/[0.06]" />

              <div className="space-y-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/38">Metadata</p>
                <div className="space-y-3 text-sm">
                  <div className="flex items-center justify-between gap-4 text-white/62">
                    <span>Lead type</span>
                    <span className="text-white">{presentation.kindLabel}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-white/62">
                    <span>Route</span>
                    <span className="text-white">{presentation.statusLabel}</span>
                  </div>
                  <div className="flex items-center justify-between gap-4 text-white/62">
                    <span>Received</span>
                    <span className="text-right text-white">{formatLeadDateTime(lead.created_at)}</span>
                  </div>
                </div>
              </div>

              <div className="h-px bg-white/[0.06]" />

              <div className="space-y-3">
                <p className="text-[11px] uppercase tracking-[0.18em] text-white/38">Actions</p>
                <div className="space-y-3">
              {lead.conversation_id ? (
                <Link
                  href={`/dashboard/conversations/${lead.conversation_id}`}
                  className={buttonVariants({
                    variant: "secondary",
                    size: "md",
                    className: "w-full justify-between border-transparent bg-white/[0.07] hover:bg-white/[0.11]"
                  })}
                >
                  View conversation
                  <ArrowUpRight className="h-4 w-4" />
                </Link>
              ) : null}
              <Link
                href="/dashboard/leads"
                className={buttonVariants({
                  variant: "outline",
                  size: "md",
                  className: "w-full justify-between border-white/[0.06] bg-transparent"
                })}
              >
                Back to lead inbox
                <ArrowLeft className="h-4 w-4" />
              </Link>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-2xl bg-[#0b1016] px-4 py-4 text-sm text-white/58">
              {hasDirectContact
                ? "This lead has direct contact info and is ready for follow-up."
                : "This lead does not include direct contact info yet, so the conversation context matters more than outreach."}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

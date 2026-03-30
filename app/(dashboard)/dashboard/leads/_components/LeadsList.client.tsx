"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Clock3, Download, Mail, Phone, Search } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { PaywallGate } from "@/src/components/billing/PaywallGate";
import {
  formatLeadDateTime,
  formatLeadRelativeTime,
  getLeadMessage,
  getLeadPresentation,
  resolveLeadName
} from "@/app/(dashboard)/dashboard/leads/_components/lead-presenter";

export type LeadRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  conversation_id: string | null;
  source: string;
  lead_type?: string | null;
  payload?: Record<string, unknown> | null;
  created_at: string;
};

const csvEscape = (value: string) => `"${value.replace(/"/g, '""')}"`;

const truncate = (value: string, maxLength = 180) => {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1).trimEnd()}…`;
};

export function LeadsList({ leads }: { leads: LeadRow[] }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const filteredLeads = useMemo(() => {
    if (!normalizedQuery) return leads;
    return leads.filter((lead) => {
      const presentation = getLeadPresentation(lead);
      const message = getLeadMessage(lead) ?? "";
      const haystack = [
        lead.name,
        lead.email,
        lead.phone,
        presentation.kindLabel,
        presentation.sourceLabel,
        presentation.statusLabel,
        message
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [leads, normalizedQuery]);

  const exportCsv = () => {
    const headers = ["Name", "Email", "Phone", "Lead Type", "Source", "Created At", "Conversation Id"];
    const rows = filteredLeads.map((lead) => {
      const presentation = getLeadPresentation(lead);
      return [
        resolveLeadName(lead.name),
        lead.email?.trim() || "",
        lead.phone?.trim() || "",
        presentation.kindLabel,
        presentation.sourceLabel,
        lead.created_at,
        lead.conversation_id ?? ""
      ];
    });

    const csv = [headers, ...rows]
      .map((row) => row.map((value) => csvEscape(String(value))).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "leads-export.csv";
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="overflow-hidden rounded-[28px] border border-white/[0.04] bg-[#10151c] shadow-[0_20px_50px_rgba(0,0,0,0.22)]">
      <div className="border-b border-white/[0.05] px-5 py-5 sm:px-6">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-3">
              <p className="text-base font-semibold text-white">Lead inbox</p>
              <Badge className="border-transparent bg-white/[0.06] text-white/70">
                {filteredLeads.length} visible
              </Badge>
            </div>
            <p className="max-w-2xl text-sm text-white/58">
              Review high-intent chatbot captures and website submissions in one operational queue.
            </p>
          </div>

          <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center xl:w-auto">
            <label className="relative block w-full sm:w-80">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/35" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search name, contact, source, or message"
                className="h-11 border-white/[0.05] bg-[#0c1117] pl-10 text-white placeholder:text-white/30"
                data-tutorial-target="leads-search"
              />
            </label>
            <PaywallGate
              entitlementKey="export_data"
              fallback={
                <Link href="/billing" className={buttonVariants({ variant: "outline", size: "sm", className: "h-11" })}>
                  Upgrade to export
                </Link>
              }
            >
              <button
                type="button"
                className={buttonVariants({ variant: "secondary", size: "sm", className: "h-11 border-transparent bg-white/[0.07] hover:bg-white/[0.11]" })}
                onClick={exportCsv}
                data-tutorial-target="leads-export"
              >
                <Download className="mr-2 h-4 w-4" />
                Export CSV
              </button>
            </PaywallGate>
          </div>
        </div>
      </div>

      {leads.length === 0 ? (
        <div className="px-6 py-14 text-center">
          <p className="text-base font-semibold text-white">No leads yet</p>
          <p className="mt-2 text-sm text-white/55">
            New chatbot captures and contact form submissions will appear here as soon as they come in.
          </p>
        </div>
      ) : filteredLeads.length === 0 ? (
        <div className="px-6 py-14 text-center">
          <p className="text-base font-semibold text-white">No leads match that search</p>
          <p className="mt-2 text-sm text-white/55">Try a name, email, phone number, or lead source.</p>
        </div>
      ) : (
        <div className="divide-y divide-white/[0.05]">
          {filteredLeads.map((lead, index) => {
            const presentation = getLeadPresentation(lead);
            const message = getLeadMessage(lead);
            const email = lead.email?.trim() || null;
            const phone = lead.phone?.trim() || null;

            return (
              <div
                key={lead.id}
                className="px-5 py-5 transition-colors hover:bg-white/[0.02] sm:px-6"
                data-tutorial-target={index === 0 ? "leads-open-conversation" : undefined}
              >
                <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_240px]">
                  <div className="min-w-0 space-y-3">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="text-base font-semibold tracking-tight text-white">{resolveLeadName(lead.name)}</p>
                      <Badge variant={presentation.kindVariant}>{presentation.kindLabel}</Badge>
                      <span className="text-[11px] font-medium uppercase tracking-[0.14em] text-white/40">{presentation.statusLabel}</span>
                    </div>

                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-white/62">
                      <span className="inline-flex items-center gap-2">
                        <Mail className="h-3.5 w-3.5 text-[#00A3FF]" />
                        {email ?? "No email"}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <Phone className="h-3.5 w-3.5 text-emerald-300" />
                        {phone ?? "No phone"}
                      </span>
                      <span className="inline-flex items-center gap-2">
                        <Clock3 className="h-3.5 w-3.5 text-white/35" />
                        {formatLeadRelativeTime(lead.created_at)}
                      </span>
                      <span className="text-white/38">{presentation.sourceLabel}</span>
                      <span className="text-white/38">{presentation.contactLabel}</span>
                    </div>

                    <div className="rounded-2xl bg-[#0b1016] px-4 py-3">
                      <p className="text-sm leading-relaxed text-white/74">
                        {message ? truncate(message) : presentation.summary}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col gap-3 xl:items-end">
                    <div className="text-sm text-white/46 xl:text-right">
                      <p>{formatLeadDateTime(lead.created_at)}</p>
                    </div>

                    <Link
                      href={presentation.href}
                      className={buttonVariants({
                        variant: "secondary",
                        size: "sm",
                        className: "h-10 border-transparent bg-white/[0.07] text-white hover:bg-white/[0.11]"
                      })}
                    >
                      {presentation.actionLabel}
                      <ChevronRight className="ml-2 h-4 w-4" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

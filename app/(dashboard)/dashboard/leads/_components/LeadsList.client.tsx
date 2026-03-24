"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Download } from "lucide-react";
import { Input } from "@/components/ui/input";
import { buttonVariants } from "@/components/ui/button";
import { PaywallGate } from "@/src/components/billing/PaywallGate";

export type LeadRow = {
  id: string;
  name: string;
  email: string | null;
  phone: string | null;
  conversation_id: string | null;
  source: string;
  created_at: string;
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });
};

const resolveLeadName = (value?: string | null) => {
  const trimmed = (value ?? "").trim();
  return trimmed || "Website visitor";
};

const csvEscape = (value: string) => `"${value.replace(/"/g, '""')}"`;

export function LeadsList({ leads }: { leads: LeadRow[] }) {
  const [query, setQuery] = useState("");
  const normalizedQuery = query.trim().toLowerCase();

  const filteredLeads = useMemo(() => {
    if (!normalizedQuery) return leads;
    return leads.filter((lead) => {
      const haystack = [lead.name, lead.email, lead.phone]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();
      return haystack.includes(normalizedQuery);
    });
  }, [leads, normalizedQuery]);

  const exportCsv = () => {
    const headers = ["Name", "Email", "Phone", "Source", "CreatedAt", "ConversationId"];
    const rows = filteredLeads.map((lead) => [
      resolveLeadName(lead.name),
      lead.email?.trim() || "",
      lead.phone?.trim() || "",
      lead.source ?? "",
      lead.created_at,
      lead.conversation_id ?? ""
    ]);

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

  if (leads.length === 0) {
    return <p className="text-sm text-white/60">No leads yet.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-sm font-semibold text-white">Leads list</p>
          <p className="text-xs text-white/60">Filter by name, email, or phone.</p>
        </div>
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
          <PaywallGate
            entitlementKey="export_data"
            fallback={
              <Link href="/billing" className={buttonVariants({ variant: "secondary", size: "sm" })}>
                Upgrade to export CSV
              </Link>
            }
          >
            <button
              type="button"
              className={buttonVariants({ variant: "secondary", size: "sm" })}
              onClick={exportCsv}
              data-tutorial-target="leads-export"
            >
              <Download className="mr-2 h-4 w-4" />
              Export CSV
            </button>
          </PaywallGate>
          <div className="w-full sm:w-64">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search leads"
              data-tutorial-target="leads-search"
            />
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {filteredLeads.map((lead, index) => {
          const email = lead.email?.trim() || "—";
          const phone = lead.phone?.trim() || "—";
          const conversationUrl = lead.conversation_id
            ? `/dashboard/conversations/${lead.conversation_id}`
            : "/dashboard/conversations";

          return (
            <div
              key={lead.id}
              className="flex flex-col gap-4 rounded-2xl border border-white/10 bg-neutral-950/60 p-4 sm:flex-row sm:items-center sm:justify-between"
            >
              <div>
                <p className="text-sm font-semibold text-white">{resolveLeadName(lead.name)}</p>
                <p className="mt-1 text-xs text-white/60">
                  {email} • {phone}
                </p>
              </div>
              <div className="flex flex-col items-start gap-3 text-left sm:items-end">
                <p className="text-xs text-white/50">{formatDateTime(lead.created_at)}</p>
                <Link
                  href={conversationUrl}
                  className={buttonVariants({ variant: "secondary", size: "sm" })}
                  data-tutorial-target={index === 0 ? "leads-open-conversation" : undefined}
                >
                  View conversation →
                </Link>
              </div>
            </div>
          );
        })}
        {filteredLeads.length === 0 ? (
          <p className="text-sm text-white/60">No leads match your search.</p>
        ) : null}
      </div>
    </div>
  );
}

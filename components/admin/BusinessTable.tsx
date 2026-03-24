"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Copy, ExternalLink, Phone } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/admin/GlassCard";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { AdminBusinessRow } from "@/lib/admin/metrics";

const riskBadge = (risk: AdminBusinessRow["risk"]) => {
  if (risk === "at_risk") return <Badge variant="warning">At Risk</Badge>;
  if (risk === "high_performer") return <Badge variant="success">High Performer</Badge>;
  return <Badge variant="info">Healthy</Badge>;
};

const statusBadge = (status: string) => {
  const normalized = status.toLowerCase();
  if (normalized === "active") return <Badge variant="success">active</Badge>;
  if (normalized === "past_due") return <Badge variant="warning">past_due</Badge>;
  if (normalized === "canceled") return <Badge variant="default">canceled</Badge>;
  return <Badge variant="info">{normalized}</Badge>;
};

const money = (value: number, currency: "EUR" | "USD") =>
  new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: currency === "USD" ? 2 : 0 }).format(
    value
  );

const compact = (value: number) =>
  new Intl.NumberFormat("en-US", {
    notation: value >= 1000 ? "compact" : "standard",
    maximumFractionDigits: 1
  }).format(value);

const copyToClipboard = async (value: string) => {
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    // ignore clipboard failures
  }
};

export function BusinessTable({ rows }: { rows: AdminBusinessRow[] }) {
  const [search, setSearch] = useState("");

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.trim().toLowerCase();
    return rows.filter((row) => {
      return (
        row.name.toLowerCase().includes(q) ||
        row.industry?.toLowerCase().includes(q) ||
        row.phone?.toLowerCase().includes(q) ||
        row.plan.toLowerCase().includes(q)
      );
    });
  }, [rows, search]);

  return (
    <GlassCard accent="green">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold text-[var(--adm-text)]">Performance</p>
          <p className="text-xs text-[var(--adm-muted)]">Website demand, outcomes, AI usage, and health score by business</p>
        </div>
        <Input
          placeholder="Search business, industry, phone, plan"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="h-9 max-w-xs border-white/10 bg-white/[0.02] text-white placeholder:text-white/35"
        />
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Business</TableHead>
            <TableHead>Plan</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Sessions</TableHead>
            <TableHead>Leads</TableHead>
            <TableHead>Reservations</TableHead>
            <TableHead>Conversations</TableHead>
            <TableHead>AI Usage</TableHead>
            <TableHead>Trend</TableHead>
            <TableHead>Health</TableHead>
            <TableHead>Phone</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredRows.length ? (
            filteredRows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>
                  <div>
                    <p className="font-medium text-white">{row.name}</p>
                    <p className="text-xs text-white/55">{row.industry ?? "Unknown industry"}</p>
                  </div>
                  <div className="mt-1">{riskBadge(row.risk)}</div>
                </TableCell>
                <TableCell className="capitalize">{row.plan}</TableCell>
                <TableCell>{statusBadge(row.status)}</TableCell>
                <TableCell>{compact(row.websiteSessions)}</TableCell>
                <TableCell>{compact(row.leads)}</TableCell>
                <TableCell>{compact(row.reservations)}</TableCell>
                <TableCell>{compact(row.conversations)}</TableCell>
                <TableCell>
                  <div className="space-y-0.5">
                    <p>{money(row.aiCostUsd, "USD")}</p>
                    <p className="text-[11px] text-white/45">{compact(row.aiTokens)} tokens</p>
                  </div>
                </TableCell>
                <TableCell className={row.trendPct != null && row.trendPct >= 0 ? "text-emerald-300" : "text-rose-300"}>
                  {row.trendPct == null ? "0%" : `${row.trendPct > 0 ? "+" : ""}${row.trendPct}%`}
                </TableCell>
                <TableCell>
                  <div className="inline-flex min-w-[58px] items-center justify-center rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-sm font-semibold text-white">
                    {row.healthScore}/100
                  </div>
                  <p className="mt-1 text-[11px] text-white/45">
                    D {row.scoreBreakdown.demand} • C {row.scoreBreakdown.conversions} • O {row.scoreBreakdown.operations}
                  </p>
                </TableCell>
                <TableCell>
                  {row.phone ? (
                    <button
                      type="button"
                      className="inline-flex items-center gap-1 text-xs text-white/70 hover:text-white"
                      onClick={() => copyToClipboard(row.phone ?? "")}
                    >
                      {row.phone}
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  ) : (
                    <span className="text-white/40">-</span>
                  )}
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2 text-xs">
                    <Link href={`/admin/businesses/${row.id}`} className="text-[#8FFFB8] hover:underline">
                      View ROI
                    </Link>
                    {row.phone ? (
                      <a href={`tel:${row.phone}`} className="text-white/70 hover:text-white" title="Call">
                        <Phone className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                    {row.websiteUrl ? (
                      <a href={row.websiteUrl} target="_blank" rel="noreferrer" className="text-white/70 hover:text-white" title="Open site">
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={12} className="text-center text-white/55">
                No businesses found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </GlassCard>
  );
}

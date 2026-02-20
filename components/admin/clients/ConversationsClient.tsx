"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { GlassCard } from "@/components/admin/GlassCard";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { useRealtimeTable } from "@/hooks/useRealtime";
import type { AdminConversationRow } from "@/lib/admin/metrics";

const statusVariant = (status: string): "default" | "success" | "warning" | "info" => {
  if (status === "open") return "success";
  if (status === "escalated") return "warning";
  if (status === "closed") return "info";
  return "default";
};

export function ConversationsClient({ initialRows }: { initialRows: AdminConversationRow[] }) {
  const [rows, setRows] = useState(initialRows);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [businessId, setBusinessId] = useState<string>("all");

  const businessOptions = useMemo(() => {
    const map = new Map<string, string>();
    rows.forEach((row) => {
      if (!map.has(row.businessId)) map.set(row.businessId, row.businessName);
    });
    return Array.from(map.entries()).sort((a, b) => a[1].localeCompare(b[1]));
  }, [rows]);

  const refresh = useCallback(async () => {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (businessId !== "all") params.set("businessId", businessId);
    const response = await fetch(`/api/admin/conversations?${params.toString()}`, { cache: "no-store" });
    if (!response.ok) return;
    const payload = (await response.json()) as { rows: AdminConversationRow[] };
    setRows(payload.rows);
  }, [businessId, status]);

  useRealtimeTable({
    table: "messages",
    onChange: () => void refresh(),
    onPoll: refresh,
    pollingMs: 15000
  });

  useRealtimeTable({
    table: "conversations",
    onChange: () => void refresh(),
    onPoll: refresh,
    pollingMs: 15000
  });

  const filtered = useMemo(() => {
    const text = query.trim().toLowerCase();
    return rows.filter((row) => {
      const byStatus = status === "all" || row.status === status;
      const byBusiness = businessId === "all" || row.businessId === businessId;
      const byQuery =
        !text ||
        row.businessName.toLowerCase().includes(text) ||
        row.channel.toLowerCase().includes(text) ||
        row.latestMessage?.toLowerCase().includes(text) ||
        row.visitorId?.toLowerCase().includes(text);
      return byStatus && byBusiness && byQuery;
    });
  }, [businessId, query, rows, status]);

  return (
    <GlassCard accent="blue">
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search business, visitor, message"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="h-9 max-w-xs border-white/10 bg-white/[0.02] text-white placeholder:text-white/35"
        />

        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="h-9 rounded-lg border border-white/10 bg-white/[0.02] px-3 text-sm text-white"
        >
          <option value="all">All status</option>
          <option value="open">Open</option>
          <option value="escalated">Escalated</option>
          <option value="closed">Closed</option>
        </select>

        <select
          value={businessId}
          onChange={(event) => setBusinessId(event.target.value)}
          className="h-9 rounded-lg border border-white/10 bg-white/[0.02] px-3 text-sm text-white"
        >
          <option value="all">All businesses</option>
          {businessOptions.map(([id, name]) => (
            <option key={id} value={id}>
              {name}
            </option>
          ))}
        </select>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Business</TableHead>
            <TableHead>Visitor</TableHead>
            <TableHead>Channel</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Messages</TableHead>
            <TableHead>Last Message</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {filtered.length ? (
            filtered.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.businessName}</TableCell>
                <TableCell>{row.visitorId ?? "anonymous"}</TableCell>
                <TableCell className="capitalize text-white/65">{row.channel}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                </TableCell>
                <TableCell>{row.messageCount}</TableCell>
                <TableCell className="max-w-[320px] truncate">{row.latestMessage ?? "-"}</TableCell>
                <TableCell>
                  <Link href={`/admin/businesses/${row.businessId}`} className="text-xs text-[#8FFFB8] hover:underline">
                    Open
                  </Link>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-white/55">
                No conversations found.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </GlassCard>
  );
}

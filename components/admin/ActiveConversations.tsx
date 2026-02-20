"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/admin/GlassCard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import type { LiveConversation } from "@/lib/admin/metrics";

const statusVariant = (status: string): "default" | "success" | "warning" | "info" => {
  if (status === "open") return "success";
  if (status === "escalated") return "warning";
  if (status === "closed") return "info";
  return "default";
};

export function ActiveConversations({ rows }: { rows: LiveConversation[] }) {
  return (
    <GlassCard accent="green">
      <div className="mb-3 flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--adm-text)]">Active Conversations</p>
          <p className="text-xs text-[var(--adm-muted)]">Real-time open threads in progress</p>
        </div>
        <p className="text-xs text-white/55">{rows.length} open</p>
      </div>

      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Business</TableHead>
            <TableHead>Channel</TableHead>
            <TableHead>Last message</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Duration</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.length ? (
            rows.map((row) => (
              <TableRow key={row.id}>
                <TableCell>{row.businessName}</TableCell>
                <TableCell className="capitalize text-white/65">{row.channel}</TableCell>
                <TableCell className="max-w-[280px] truncate">{row.latestMessage ?? "Waiting for next message"}</TableCell>
                <TableCell>
                  <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                </TableCell>
                <TableCell>{row.durationMinutes}m</TableCell>
                <TableCell>
                  <Link href={`/admin/conversations?conversationId=${row.id}`} className="text-xs text-[#8FFFB8] hover:underline">
                    Open
                  </Link>
                </TableCell>
              </TableRow>
            ))
          ) : (
            <TableRow>
              <TableCell colSpan={6} className="text-center text-white/55">
                No active conversations right now.
              </TableCell>
            </TableRow>
          )}
        </TableBody>
      </Table>
    </GlassCard>
  );
}

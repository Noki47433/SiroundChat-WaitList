"use client";

import { useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import { FeedbackReportDetailModal, NewFeedbackReportModal, type FeedbackReportView } from "./FeedbackModal";

type FeedbackListRow = {
  id: string;
  created_at: string;
  title: string;
  category: string;
  importance: string;
  status: string;
  triage_status: string;
  priority: string;
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "2-digit", year: "numeric" }).format(date);
};

const importanceVariant = (importance: string): "default" | "success" | "warning" | "info" => {
  if (importance === "critical" || importance === "high") return "warning";
  if (importance === "medium") return "info";
  return "default";
};

const statusVariant = (status: string): "default" | "success" | "warning" | "info" => {
  if (status === "resolved") return "success";
  if (status === "in_progress") return "warning";
  if (status === "closed") return "default";
  return "info";
};

export function FeedbackCard({
  initialRows,
  initialContactEmail
}: {
  initialRows: FeedbackListRow[];
  initialContactEmail?: string | null;
}) {
  const { push } = useToast();
  const [rows, setRows] = useState<FeedbackListRow[]>(initialRows);
  const [newOpen, setNewOpen] = useState(false);
  const [detailOpen, setDetailOpen] = useState(false);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailReport, setDetailReport] = useState<FeedbackReportView | null>(null);

  const hasRows = useMemo(() => rows.length > 0, [rows.length]);

  const refreshRows = async () => {
    const response = await fetch("/api/feedback?limit=10", { cache: "no-store" });
    const payload = (await response.json()) as { rows?: FeedbackListRow[]; error?: string };
    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to refresh feedback reports");
    }
    setRows(payload.rows ?? []);
  };

  const handleCreated = async (reportId: string) => {
    try {
      await refreshRows();
      await openDetail(reportId);
    } catch {
      // Ignore refresh failures after successful create.
    }
  };

  const openDetail = async (id: string) => {
    setDetailOpen(true);
    setDetailLoading(true);
    try {
      const response = await fetch(`/api/feedback/${id}`, { cache: "no-store" });
      const payload = (await response.json()) as { row?: FeedbackReportView; error?: string };
      if (!response.ok || !payload.row) {
        throw new Error(payload.error ?? "Failed to load report details");
      }
      setDetailReport(payload.row);
    } catch (error) {
      setDetailOpen(false);
      push({
        title: "Unable to open report",
        message: error instanceof Error ? error.message : "Please try again.",
        variant: "error"
      });
    } finally {
      setDetailLoading(false);
    }
  };

  return (
    <>
      <Card className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Feedback & Bug Reports</h3>
            <p className="mt-1 text-sm text-white/60">Report bugs, request features, and tell us what&apos;s broken.</p>
          </div>
          <Button type="button" size="sm" onClick={() => setNewOpen(true)}>
            New Report
          </Button>
        </div>

        <div className="rounded-2xl border border-white/10">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Created</TableHead>
                <TableHead>Title</TableHead>
                <TableHead>Category</TableHead>
                <TableHead>Importance</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {hasRows ? (
                rows.map((row) => (
                  <TableRow key={row.id} className="cursor-pointer" onClick={() => void openDetail(row.id)}>
                    <TableCell className="text-white/65">{formatDate(row.created_at)}</TableCell>
                    <TableCell className="max-w-[260px] truncate font-medium text-white">{row.title}</TableCell>
                    <TableCell className="text-white/70">{row.category}</TableCell>
                    <TableCell>
                      <Badge variant={importanceVariant(row.importance)}>{row.importance}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-white/55">
                    No reports yet. Use &quot;New Report&quot; to submit feedback.
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      <NewFeedbackReportModal
        open={newOpen}
        onClose={() => setNewOpen(false)}
        initialContactEmail={initialContactEmail}
        onCreated={(reportId) => void handleCreated(reportId)}
      />
      <FeedbackReportDetailModal
        open={detailOpen}
        onClose={() => {
          setDetailOpen(false);
          setDetailReport(null);
        }}
        report={detailLoading ? null : detailReport}
      />
    </>
  );
}

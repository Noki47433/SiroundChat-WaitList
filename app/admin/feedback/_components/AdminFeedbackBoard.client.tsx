"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/admin/GlassCard";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/components/ui/toast";
import type { FeedbackAdminListResult } from "@/lib/feedback/queries";

type FiltersState = {
  queue: string;
  status: string;
  importance: string;
  category: string;
  triage_status: string;
  priority: string;
  assigned_to: string;
  overdue: boolean;
  tag: string;
  search: string;
  sort: string;
};

const initialFilters: FiltersState = {
  queue: "new",
  status: "all",
  importance: "all",
  category: "all",
  triage_status: "all",
  priority: "all",
  assigned_to: "all",
  overdue: false,
  tag: "",
  search: "",
  sort: "last_activity_desc"
};

const queueTabs: Array<{ key: string; label: string }> = [
  { key: "new", label: "New" },
  { key: "needs_repro", label: "Needs repro" },
  { key: "planned", label: "Planned" },
  { key: "in_progress", label: "In progress" },
  { key: "overdue", label: "Overdue" },
  { key: "resolved_recent", label: "Resolved (14d)" }
];

const formatDate = (value: string | null | undefined) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric"
  }).format(date);
};

const formatFirstResponse = (seconds: number | null) => {
  if (seconds === null) return "-";
  if (seconds < 60) return `${Math.round(seconds)}s`;
  if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
  return `${(seconds / 3600).toFixed(1)}h`;
};

const isClosedTriage = (triage: string) => ["resolved", "closed", "wontfix", "duplicate"].includes(triage);

const priorityVariant = (priority: string): "default" | "success" | "warning" | "info" => {
  if (priority === "p0" || priority === "p1") return "warning";
  if (priority === "p2") return "info";
  return "default";
};

const triageVariant = (triage: string): "default" | "success" | "warning" | "info" => {
  if (triage === "resolved") return "success";
  if (triage === "in_progress" || triage === "needs_repro") return "warning";
  if (triage === "new") return "info";
  return "default";
};

const importanceVariant = (importance: string): "default" | "success" | "warning" | "info" => {
  if (importance === "critical" || importance === "high") return "warning";
  if (importance === "medium") return "info";
  return "default";
};

const statusVariant = (status: string): "default" | "success" | "warning" | "info" => {
  if (status === "resolved") return "success";
  if (status === "in_progress") return "warning";
  if (status === "open") return "info";
  return "default";
};

export function AdminFeedbackBoard({ initialData }: { initialData: FeedbackAdminListResult }) {
  const router = useRouter();
  const { push } = useToast();
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState<FiltersState>(initialFilters);
  const [page, setPage] = useState(initialData.page);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkStatus, setBulkStatus] = useState("");
  const [bulkPriority, setBulkPriority] = useState("");
  const [bulkAssignedTo, setBulkAssignedTo] = useState("");
  const [bulkTag, setBulkTag] = useState("");

  const totalPages = useMemo(() => Math.max(1, Math.ceil(data.total / data.pageSize)), [data.pageSize, data.total]);
  const hasSelection = selectedIds.length > 0;

  const fetchRows = useCallback(
    async (nextPage: number, activeFilters: FiltersState) => {
      setLoading(true);
      try {
        const params = new URLSearchParams();
        params.set("page", String(nextPage));
        params.set("pageSize", String(data.pageSize));
        if (activeFilters.queue) params.set("queue", activeFilters.queue);
        if (activeFilters.status !== "all") params.set("status", activeFilters.status);
        if (activeFilters.importance !== "all") params.set("importance", activeFilters.importance);
        if (activeFilters.category !== "all") params.set("category", activeFilters.category);
        if (activeFilters.triage_status !== "all") params.set("triage_status", activeFilters.triage_status);
        if (activeFilters.priority !== "all") params.set("priority", activeFilters.priority);
        if (activeFilters.assigned_to !== "all") params.set("assigned_to", activeFilters.assigned_to);
        if (activeFilters.overdue) params.set("overdue", "true");
        if (activeFilters.tag.trim()) params.set("tag", activeFilters.tag.trim());
        if (activeFilters.search.trim()) params.set("search", activeFilters.search.trim());
        if (activeFilters.sort) params.set("sort", activeFilters.sort);

        const response = await fetch(`/api/admin/feedback?${params.toString()}`, { cache: "no-store" });
        const payload = (await response.json()) as FeedbackAdminListResult & { error?: string };
        if (!response.ok) {
          throw new Error(payload.error ?? "Failed to load feedback queue");
        }
        setData(payload);
      } catch (error) {
        push({
          title: "Failed to load feedback reports",
          message: error instanceof Error ? error.message : "Please try again.",
          variant: "error"
        });
      } finally {
        setLoading(false);
      }
    },
    [data.pageSize, push]
  );

  useEffect(() => {
    const timeout = setTimeout(() => {
      void fetchRows(page, filters);
    }, 150);
    return () => clearTimeout(timeout);
  }, [fetchRows, filters, page]);

  const toggleSelectAll = () => {
    if (selectedIds.length === data.rows.length) {
      setSelectedIds([]);
      return;
    }
    setSelectedIds(data.rows.map((row) => row.id));
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((value) => value !== id) : [...prev, id]));
  };

  const applyBulkAction = async (mode: "set" | "addTag" | "removeTag") => {
    if (!selectedIds.length) return;

    const patch: Record<string, unknown> = {};
    if (mode === "set") {
      if (bulkStatus) patch.triage_status = bulkStatus;
      if (bulkPriority) patch.priority = bulkPriority;
      if (bulkAssignedTo) patch.assigned_to = bulkAssignedTo === "unassigned" ? null : bulkAssignedTo;
    }
    if (mode === "addTag" && bulkTag.trim()) patch.add_tag = bulkTag.trim();
    if (mode === "removeTag" && bulkTag.trim()) patch.remove_tag = bulkTag.trim();

    if (!Object.keys(patch).length) return;

    try {
      const response = await fetch("/api/admin/feedback", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selectedIds, patch })
      });
      const payload = (await response.json()) as { updated?: number; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to apply bulk action");
      }

      push({
        title: "Bulk update applied",
        message: `${payload.updated ?? selectedIds.length} report(s) updated.`,
        variant: "success"
      });
      setSelectedIds([]);
      setBulkTag("");
      await fetchRows(page, filters);
    } catch (error) {
      push({
        title: "Bulk update failed",
        message: error instanceof Error ? error.message : "Please try again.",
        variant: "error"
      });
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-5">
        <GlassCard accent="blue" className="p-3">
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">New</p>
          <p className="mt-2 text-2xl font-semibold text-white">{data.metrics.newCount}</p>
        </GlassCard>
        <GlassCard accent="warning" className="p-3">
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Needs repro</p>
          <p className="mt-2 text-2xl font-semibold text-white">{data.metrics.needsReproCount}</p>
        </GlassCard>
        <GlassCard accent="danger" className="p-3">
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Overdue</p>
          <p className="mt-2 text-2xl font-semibold text-white">{data.metrics.overdueCount}</p>
        </GlassCard>
        <GlassCard accent="warning" className="p-3">
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Critical open</p>
          <p className="mt-2 text-2xl font-semibold text-white">{data.metrics.criticalOpenCount}</p>
        </GlassCard>
        <GlassCard accent="green" className="p-3">
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Avg first response</p>
          <p className="mt-2 text-2xl font-semibold text-white">{formatFirstResponse(data.metrics.avgFirstResponseSeconds)}</p>
        </GlassCard>
      </div>

      <GlassCard accent="green">
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            {queueTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                  filters.queue === tab.key ? "bg-[#55FF95]/20 text-[#c7ffdf]" : "border border-white/10 text-white/70 hover:text-white"
                }`}
                onClick={() => {
                  setPage(1);
                  setFilters((prev) => ({ ...prev, queue: tab.key }));
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="grid gap-2 lg:grid-cols-6">
            <select
              value={filters.status}
              onChange={(event) => {
                setPage(1);
                setFilters((prev) => ({ ...prev, status: event.target.value }));
              }}
              className="h-9 rounded-lg border border-white/10 bg-white/[0.02] px-3 text-sm text-white"
            >
              <option value="all">All status</option>
              <option value="open">open</option>
              <option value="in_progress">in_progress</option>
              <option value="resolved">resolved</option>
              <option value="closed">closed</option>
            </select>
            <select
              value={filters.importance}
              onChange={(event) => {
                setPage(1);
                setFilters((prev) => ({ ...prev, importance: event.target.value }));
              }}
              className="h-9 rounded-lg border border-white/10 bg-white/[0.02] px-3 text-sm text-white"
            >
              <option value="all">All importance</option>
              <option value="low">low</option>
              <option value="medium">medium</option>
              <option value="high">high</option>
              <option value="critical">critical</option>
            </select>
            <select
              value={filters.category}
              onChange={(event) => {
                setPage(1);
                setFilters((prev) => ({ ...prev, category: event.target.value }));
              }}
              className="h-9 rounded-lg border border-white/10 bg-white/[0.02] px-3 text-sm text-white"
            >
              <option value="all">All category</option>
              <option value="bug">bug</option>
              <option value="feature_request">feature_request</option>
              <option value="ux_issue">ux_issue</option>
              <option value="billing_issue">billing_issue</option>
              <option value="other">other</option>
            </select>
            <select
              value={filters.triage_status}
              onChange={(event) => {
                setPage(1);
                setFilters((prev) => ({ ...prev, triage_status: event.target.value }));
              }}
              className="h-9 rounded-lg border border-white/10 bg-white/[0.02] px-3 text-sm text-white"
            >
              <option value="all">All triage</option>
              <option value="new">new</option>
              <option value="needs_repro">needs_repro</option>
              <option value="acknowledged">acknowledged</option>
              <option value="planned">planned</option>
              <option value="in_progress">in_progress</option>
              <option value="resolved">resolved</option>
              <option value="closed">closed</option>
              <option value="wontfix">wontfix</option>
              <option value="duplicate">duplicate</option>
            </select>
            <select
              value={filters.priority}
              onChange={(event) => {
                setPage(1);
                setFilters((prev) => ({ ...prev, priority: event.target.value }));
              }}
              className="h-9 rounded-lg border border-white/10 bg-white/[0.02] px-3 text-sm text-white"
            >
              <option value="all">All priority</option>
              <option value="p0">p0</option>
              <option value="p1">p1</option>
              <option value="p2">p2</option>
              <option value="p3">p3</option>
            </select>
            <select
              value={filters.assigned_to}
              onChange={(event) => {
                setPage(1);
                setFilters((prev) => ({ ...prev, assigned_to: event.target.value }));
              }}
              className="h-9 rounded-lg border border-white/10 bg-white/[0.02] px-3 text-sm text-white"
            >
              <option value="all">All assignees</option>
              <option value="unassigned">Unassigned</option>
              {data.admins.map((admin) => (
                <option key={admin.id} value={admin.id}>
                  {admin.full_name ?? admin.id}
                </option>
              ))}
            </select>
            <label className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 bg-white/[0.02] px-3 text-xs text-white/80">
              <input
                type="checkbox"
                checked={filters.overdue}
                onChange={(event) => {
                  setPage(1);
                  setFilters((prev) => ({ ...prev, overdue: event.target.checked }));
                }}
              />
              Overdue
            </label>
            <Input
              placeholder="Tag"
              value={filters.tag}
              onChange={(event) => {
                setPage(1);
                setFilters((prev) => ({ ...prev, tag: event.target.value }));
              }}
              className="h-9 border-white/10 bg-white/[0.02] text-white"
            />
            <select
              value={filters.sort}
              onChange={(event) => setFilters((prev) => ({ ...prev, sort: event.target.value }))}
              className="h-9 rounded-lg border border-white/10 bg-white/[0.02] px-3 text-sm text-white"
            >
              <option value="last_activity_desc">Last activity (desc)</option>
              <option value="created_at_desc">Created at (desc)</option>
              <option value="due_at_asc">Due at (asc)</option>
              <option value="priority_asc">Priority (p0 first)</option>
            </select>
          </div>

          <Input
            placeholder="Search title or description"
            value={filters.search}
            onChange={(event) => {
              setPage(1);
              setFilters((prev) => ({ ...prev, search: event.target.value }));
            }}
            className="h-9 border-white/10 bg-white/[0.02] text-white"
          />
        </div>
      </GlassCard>

      {hasSelection ? (
        <GlassCard accent="warning" className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm text-white/85">{selectedIds.length} selected</p>
            <select
              value={bulkStatus}
              onChange={(event) => setBulkStatus(event.target.value)}
              className="h-8 rounded-lg border border-white/10 bg-white/[0.02] px-2 text-xs text-white"
            >
              <option value="">Set triage status</option>
              <option value="new">new</option>
              <option value="needs_repro">needs_repro</option>
              <option value="acknowledged">acknowledged</option>
              <option value="planned">planned</option>
              <option value="in_progress">in_progress</option>
              <option value="closed">closed</option>
            </select>
            <select
              value={bulkPriority}
              onChange={(event) => setBulkPriority(event.target.value)}
              className="h-8 rounded-lg border border-white/10 bg-white/[0.02] px-2 text-xs text-white"
            >
              <option value="">Set priority</option>
              <option value="p0">p0</option>
              <option value="p1">p1</option>
              <option value="p2">p2</option>
              <option value="p3">p3</option>
            </select>
            <select
              value={bulkAssignedTo}
              onChange={(event) => setBulkAssignedTo(event.target.value)}
              className="h-8 rounded-lg border border-white/10 bg-white/[0.02] px-2 text-xs text-white"
            >
              <option value="">Assign to</option>
              <option value="unassigned">Unassigned</option>
              {data.admins.map((admin) => (
                <option key={admin.id} value={admin.id}>
                  {admin.full_name ?? admin.id}
                </option>
              ))}
            </select>
            <Button type="button" size="xs" variant="secondary" onClick={() => void applyBulkAction("set")}>
              Apply fields
            </Button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Input
              placeholder="Tag"
              value={bulkTag}
              onChange={(event) => setBulkTag(event.target.value)}
              className="h-8 max-w-[220px] border-white/10 bg-white/[0.02] text-xs text-white"
            />
            <Button type="button" size="xs" variant="secondary" onClick={() => void applyBulkAction("addTag")}>
              Add tag
            </Button>
            <Button type="button" size="xs" variant="outline" onClick={() => void applyBulkAction("removeTag")}>
              Remove tag
            </Button>
          </div>
        </GlassCard>
      ) : null}

      <GlassCard accent="blue">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[34px]">
                <input type="checkbox" checked={data.rows.length > 0 && selectedIds.length === data.rows.length} onChange={toggleSelectAll} />
              </TableHead>
              <TableHead>Created</TableHead>
              <TableHead>Business</TableHead>
              <TableHead>Title</TableHead>
              <TableHead>Category</TableHead>
              <TableHead>Importance</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Priority</TableHead>
              <TableHead>Triage</TableHead>
              <TableHead>Assigned</TableHead>
              <TableHead>Due</TableHead>
              <TableHead>Comments</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.rows.length ? (
              data.rows.map((row) => {
                const dueDate = row.due_at ? new Date(row.due_at) : null;
                const isOverdue = Boolean(dueDate && dueDate.getTime() < Date.now() && !isClosedTriage(row.triage_status));
                return (
                  <TableRow key={row.id} className="cursor-pointer" onClick={() => router.push(`/admin/feedback/${row.id}`)}>
                    <TableCell
                      onClick={(event) => {
                        event.stopPropagation();
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.id)}
                        onChange={() => toggleSelected(row.id)}
                      />
                    </TableCell>
                    <TableCell className="text-white/65">{formatDate(row.created_at)}</TableCell>
                    <TableCell className="max-w-[170px] truncate">{row.business_name ?? row.business_id ?? "-"}</TableCell>
                    <TableCell className="max-w-[260px] truncate font-medium text-white">{row.title}</TableCell>
                    <TableCell>{row.category}</TableCell>
                    <TableCell>
                      <Badge variant={importanceVariant(row.importance)}>{row.importance}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={statusVariant(row.status)}>{row.status}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={priorityVariant(row.priority)}>{row.priority}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={triageVariant(row.triage_status)}>{row.triage_status}</Badge>
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate text-white/75">{row.assigned_to_name ?? "-"}</TableCell>
                    <TableCell className={isOverdue ? "font-semibold text-rose-300" : "text-white/70"}>
                      {formatDate(row.due_at)}
                    </TableCell>
                    <TableCell>{row.internal_comments_count}</TableCell>
                  </TableRow>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={12} className="text-center text-white/55">
                  {loading ? "Loading..." : "No feedback reports found for current filters."}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>

        <div className="mt-4 flex items-center justify-between">
          <p className="text-xs text-white/55">
            Page {page} / {totalPages} · {data.total} total
          </p>
          <div className="flex items-center gap-2">
            <Button type="button" size="xs" variant="secondary" disabled={page <= 1} onClick={() => setPage((prev) => Math.max(1, prev - 1))}>
              Previous
            </Button>
            <Button
              type="button"
              size="xs"
              variant="secondary"
              disabled={page >= totalPages}
              onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            >
              Next
            </Button>
          </div>
        </div>
      </GlassCard>
    </div>
  );
}

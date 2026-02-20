"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/admin/GlassCard";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";
import type { FeedbackAdminDetail } from "@/lib/feedback/queries";
import { normalizeTag, suggestedDueAtForPriority, type FeedbackPriority } from "@/lib/feedback/validation";

const formatDateTime = (value: string | null | undefined) => {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
};

const toDateInputValue = (value: string | null | undefined) => {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
};

const fromDateInputValue = (value: string) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString();
};

const NOTICE_PRESETS = {
  bug_fixed: {
    label: "Bug fixed and shipped",
    title: "Update: Bug fix shipped",
    message: "Thanks for reporting this. We fixed the issue and deployed an update. Please refresh and try again."
  },
  improvement_shipped: {
    label: "Improvement shipped",
    title: "Update: Improvement shipped",
    message: "We shipped an improvement based on your feedback. Thanks for helping us make the product better."
  },
  active_work: {
    label: "Work in progress update",
    title: "Update: We’re actively improving this",
    message: "We reviewed your report and started work. Thanks for your patience while we improve this area."
  }
} as const;

type NoticePresetKey = keyof typeof NOTICE_PRESETS;

export function AdminFeedbackDetailClient({ initialData }: { initialData: FeedbackAdminDetail }) {
  const { push } = useToast();
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const [comment, setComment] = useState("");
  const [duplicateSearch, setDuplicateSearch] = useState("");
  const [duplicateResults, setDuplicateResults] = useState<Array<{ id: string; title: string; created_at: string }>>([]);
  const [resolveModalOpen, setResolveModalOpen] = useState(false);
  const [resolveSummaryDraft, setResolveSummaryDraft] = useState("");
  const [notifyModalOpen, setNotifyModalOpen] = useState(false);
  const [notifyPreset, setNotifyPreset] = useState<NoticePresetKey>("bug_fixed");
  const [notifyTitle, setNotifyTitle] = useState<string>(NOTICE_PRESETS.bug_fixed.title);
  const [notifyMessage, setNotifyMessage] = useState<string>(NOTICE_PRESETS.bug_fixed.message);
  const [notifying, setNotifying] = useState(false);

  const report = data.report;

  const [draft, setDraft] = useState(() => ({
    triage_status: report?.triage_status ?? "new",
    priority: report?.priority ?? "p3",
    assigned_to: report?.assigned_to ?? "",
    due_at: toDateInputValue(report?.due_at),
    duplicate_of_id: report?.duplicate_of_id ?? "",
    tags: report?.tags ?? [],
    admin_notes: report?.admin_notes ?? "",
    resolution_summary: report?.resolution_summary ?? "",
    repro_checklist: {
      reproduced: Boolean(report?.repro_checklist?.reproduced),
      environment: report?.repro_checklist?.environment ?? "",
      notes: report?.repro_checklist?.notes ?? "",
      steps_verified: Boolean(report?.repro_checklist?.steps_verified)
    }
  }));

  useEffect(() => {
    if (!report) return;
    setDraft({
      triage_status: report.triage_status,
      priority: report.priority,
      assigned_to: report.assigned_to ?? "",
      due_at: toDateInputValue(report.due_at),
      duplicate_of_id: report.duplicate_of_id ?? "",
      tags: report.tags ?? [],
      admin_notes: report.admin_notes ?? "",
      resolution_summary: report.resolution_summary ?? "",
      repro_checklist: {
        reproduced: Boolean(report.repro_checklist?.reproduced),
        environment: report.repro_checklist?.environment ?? "",
        notes: report.repro_checklist?.notes ?? "",
        steps_verified: Boolean(report.repro_checklist?.steps_verified)
      }
    });
  }, [report]);

  const refresh = async () => {
    if (!report) return;
    setLoading(true);
    try {
      const response = await fetch(`/api/admin/feedback/${report.id}`, { cache: "no-store" });
      const payload = (await response.json()) as FeedbackAdminDetail & { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to refresh report");
      }
      setData(payload);
    } catch (error) {
      push({
        title: "Failed to refresh report",
        message: error instanceof Error ? error.message : "Please try again.",
        variant: "error"
      });
    } finally {
      setLoading(false);
    }
  };

  const validationError = useMemo(() => {
    if (draft.triage_status === "resolved" && draft.resolution_summary.trim().length < 10) {
      return "Resolution summary is required (min 10 chars) when resolving.";
    }
    if (draft.triage_status === "wontfix" && draft.admin_notes.trim().length < 10) {
      return "Admin notes are required (min 10 chars) when marking wontfix.";
    }
    if (draft.triage_status === "duplicate" && !draft.duplicate_of_id) {
      return "A duplicate report must be selected when triage status is duplicate.";
    }
    return null;
  }, [draft.admin_notes, draft.duplicate_of_id, draft.resolution_summary, draft.triage_status]);

  const saveChanges = async (overridePatch?: Record<string, unknown>) => {
    if (!report) return;
    const patch = overridePatch ?? {
      triage_status: draft.triage_status,
      priority: draft.priority,
      assigned_to: draft.assigned_to || null,
      due_at: draft.due_at ? fromDateInputValue(draft.due_at) : null,
      duplicate_of_id: draft.duplicate_of_id || null,
      tags: draft.tags,
      admin_notes: draft.admin_notes || null,
      resolution_summary: draft.resolution_summary || null,
      repro_checklist: draft.repro_checklist
    };

    if (!overridePatch && validationError) {
      push({ title: "Unable to save", message: validationError, variant: "error" });
      return;
    }

    setSaving(true);
    try {
      const response = await fetch(`/api/admin/feedback/${report.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch)
      });
      const payload = (await response.json()) as { row?: unknown; error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to save triage changes");
      }
      await refresh();
      push({ title: "Feedback report updated", variant: "success" });
    } catch (error) {
      push({
        title: "Failed to save changes",
        message: error instanceof Error ? error.message : "Please try again.",
        variant: "error"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleQuickAction = async (triageStatus: string) => {
    setDraft((prev) => ({ ...prev, triage_status: triageStatus }));
    await saveChanges({ triage_status: triageStatus });
  };

  const addTag = () => {
    const normalized = normalizeTag(tagInput);
    if (!normalized) return;
    if (normalized.length > 24) {
      push({ title: "Tag too long", message: "Tags must be 24 characters or less.", variant: "error" });
      return;
    }
    setDraft((prev) => {
      if (prev.tags.includes(normalized) || prev.tags.length >= 20) return prev;
      return { ...prev, tags: [...prev.tags, normalized] };
    });
    setTagInput("");
  };

  const removeTag = (value: string) => {
    setDraft((prev) => ({ ...prev, tags: prev.tags.filter((tag) => tag !== value) }));
  };

  const applyNotifyPreset = (preset: NoticePresetKey) => {
    setNotifyPreset(preset);
    setNotifyTitle(NOTICE_PRESETS[preset].title);
    setNotifyMessage(NOTICE_PRESETS[preset].message);
  };

  const sendBusinessUpdate = async () => {
    if (!report || !report.business_id) {
      push({
        title: "Business not linked",
        message: "This report is not linked to a business account.",
        variant: "error"
      });
      return;
    }

    const title = notifyTitle.trim();
    const message = notifyMessage.trim();
    if (title.length < 4 || title.length > 120) {
      push({
        title: "Invalid title",
        message: "Title must be between 4 and 120 characters.",
        variant: "error"
      });
      return;
    }
    if (message.length < 10 || message.length > 1000) {
      push({
        title: "Invalid message",
        message: "Message must be between 10 and 1000 characters.",
        variant: "error"
      });
      return;
    }

    setNotifying(true);
    try {
      const response = await fetch(`/api/admin/feedback/${report.id}/notify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          preset: notifyPreset,
          title,
          message
        })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to send business update.");
      }
      setNotifyModalOpen(false);
      push({
        title: "Business update sent",
        message: "The notice will appear on the business dashboard and notifications.",
        variant: "success"
      });
      await refresh();
    } catch (error) {
      push({
        title: "Unable to send update",
        message: error instanceof Error ? error.message : "Please try again.",
        variant: "error"
      });
    } finally {
      setNotifying(false);
    }
  };

  const postComment = async () => {
    if (!report || !comment.trim()) return;
    try {
      const response = await fetch(`/api/admin/feedback/${report.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: comment.trim() })
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to post comment");
      }
      setComment("");
      await refresh();
    } catch (error) {
      push({
        title: "Unable to post comment",
        message: error instanceof Error ? error.message : "Please try again.",
        variant: "error"
      });
    }
  };

  useEffect(() => {
    if (!report || draft.triage_status !== "duplicate" || !duplicateSearch.trim()) {
      setDuplicateResults([]);
      return;
    }

    const timeout = setTimeout(async () => {
      try {
        const params = new URLSearchParams();
        params.set("q", duplicateSearch.trim());
        params.set("excludeId", report.id);
        const response = await fetch(`/api/admin/feedback/search?${params.toString()}`, { cache: "no-store" });
        const payload = (await response.json()) as {
          rows?: Array<{ id: string; title: string; created_at: string }>;
          error?: string;
        };
        if (!response.ok) throw new Error(payload.error ?? "Search failed");
        setDuplicateResults(payload.rows ?? []);
      } catch {
        setDuplicateResults([]);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [draft.triage_status, duplicateSearch, report]);

  if (!report) {
    return (
      <GlassCard accent="danger">
        <p className="text-sm text-white/75">Feedback report not found.</p>
        <Link href="/admin/feedback" className="mt-3 inline-flex text-sm text-[#8FFFB8] hover:underline">
          Back to feedback queue
        </Link>
      </GlassCard>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Admin / Feedback</p>
          <h2 className="mt-1 text-2xl font-semibold text-white">{report.title}</h2>
        </div>
        <Link href="/admin/feedback" className="text-sm text-[#8FFFB8] hover:underline">
          Back to queue
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_420px]">
        <GlassCard accent="blue" className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="info">{report.category}</Badge>
            <Badge variant="warning">{report.importance}</Badge>
            <Badge variant="default">{report.status}</Badge>
          </div>

          <div className="grid gap-3 md:grid-cols-2">
            <p className="text-xs text-white/60">Created: {formatDateTime(report.created_at)}</p>
            <p className="text-xs text-white/60">Updated: {formatDateTime(report.updated_at)}</p>
            <p className="text-xs text-white/60">Business: {data.business_name ?? report.business_id ?? "-"}</p>
            <p className="text-xs text-white/60">Reporter user: {report.user_id ?? "-"}</p>
            <p className="text-xs text-white/60">First response: {formatDateTime(report.first_response_at)}</p>
            <p className="text-xs text-white/60">Resolved at: {formatDateTime(report.resolved_at)}</p>
          </div>

          <div>
            <p className="text-xs uppercase tracking-wide text-white/45">Description</p>
            <p className="mt-1 whitespace-pre-wrap text-sm text-white/85">{report.description}</p>
          </div>

          {report.steps_to_reproduce ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-white/45">Steps to reproduce</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-white/80">{report.steps_to_reproduce}</p>
            </div>
          ) : null}

          {report.expected_behavior ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-white/45">Expected behavior</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-white/80">{report.expected_behavior}</p>
            </div>
          ) : null}

          {report.actual_behavior ? (
            <div>
              <p className="text-xs uppercase tracking-wide text-white/45">Actual behavior</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-white/80">{report.actual_behavior}</p>
            </div>
          ) : null}

          <div className="grid gap-3 md:grid-cols-2">
            <p className="text-xs text-white/60">Page URL: {report.url || "-"}</p>
            <p className="text-xs text-white/60">Contact email: {report.contact_email || "-"}</p>
            <p className="text-xs text-white/60">Browser: {report.browser_info || "-"}</p>
            <p className="text-xs text-white/60">Internal comments: {report.internal_comments_count}</p>
          </div>
        </GlassCard>

        <div className="space-y-4">
          <GlassCard accent="green" className="space-y-3">
            <h3 className="text-sm font-semibold text-white">Triage</h3>

            <div className="grid gap-3 md:grid-cols-2">
              <label className="space-y-1 text-xs text-white/65">
                Triage status
                <select
                  value={draft.triage_status}
                  onChange={(event) => setDraft((prev) => ({ ...prev, triage_status: event.target.value }))}
                  className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.02] px-2 text-sm text-white"
                >
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
              </label>

              <label className="space-y-1 text-xs text-white/65">
                Priority
                <select
                  value={draft.priority}
                  onChange={(event) => setDraft((prev) => ({ ...prev, priority: event.target.value }))}
                  className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.02] px-2 text-sm text-white"
                >
                  <option value="p0">p0</option>
                  <option value="p1">p1</option>
                  <option value="p2">p2</option>
                  <option value="p3">p3</option>
                </select>
              </label>

              <label className="space-y-1 text-xs text-white/65 md:col-span-2">
                Assigned to
                <select
                  value={draft.assigned_to}
                  onChange={(event) => setDraft((prev) => ({ ...prev, assigned_to: event.target.value }))}
                  className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.02] px-2 text-sm text-white"
                >
                  <option value="">Unassigned</option>
                  {data.admins.map((admin) => (
                    <option key={admin.id} value={admin.id}>
                      {admin.full_name ?? admin.id}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div className="space-y-2">
              <p className="text-xs text-white/65">Tags</p>
              <div className="flex flex-wrap gap-2">
                {draft.tags.map((tag) => (
                  <button
                    key={tag}
                    type="button"
                    className="rounded-full border border-white/10 bg-white/[0.04] px-2 py-1 text-xs text-white/85"
                    onClick={() => removeTag(tag)}
                  >
                    {tag} ×
                  </button>
                ))}
              </div>
              <Input
                value={tagInput}
                onChange={(event) => setTagInput(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    addTag();
                  }
                }}
                placeholder="Add tag and press Enter"
                className="h-9 border-white/10 bg-white/[0.02]"
              />
            </div>

            <div className="space-y-2">
              <p className="text-xs text-white/65">Due date</p>
              <div className="flex items-center gap-2">
                <Input
                  type="date"
                  value={draft.due_at}
                  onChange={(event) => setDraft((prev) => ({ ...prev, due_at: event.target.value }))}
                  className="h-9 border-white/10 bg-white/[0.02]"
                />
                <Button
                  type="button"
                  size="xs"
                  variant="secondary"
                  onClick={() =>
                    setDraft((prev) => ({
                      ...prev,
                      due_at: toDateInputValue(suggestedDueAtForPriority(prev.priority as FeedbackPriority))
                    }))
                  }
                >
                  Set suggested due date
                </Button>
              </div>
            </div>

            {draft.triage_status === "duplicate" ? (
              <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <p className="text-xs text-white/65">Duplicate of</p>
                <Input
                  value={duplicateSearch}
                  onChange={(event) => setDuplicateSearch(event.target.value)}
                  placeholder="Search report by title"
                  className="h-9 border-white/10 bg-white/[0.02]"
                />
                <div className="max-h-36 space-y-1 overflow-y-auto">
                  {duplicateResults.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      className={`block w-full rounded-md border px-2 py-1 text-left text-xs ${
                        draft.duplicate_of_id === item.id
                          ? "border-[#55FF95]/35 bg-[#55FF95]/15 text-[#c7ffdf]"
                          : "border-white/10 bg-white/[0.03] text-white/75"
                      }`}
                      onClick={() => setDraft((prev) => ({ ...prev, duplicate_of_id: item.id }))}
                    >
                      <p className="truncate">{item.title}</p>
                      <p className="text-[11px] text-white/45">{formatDateTime(item.created_at)}</p>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <label className="space-y-1 text-xs text-white/65">
              Admin notes
              <Textarea
                value={draft.admin_notes}
                onChange={(event) => setDraft((prev) => ({ ...prev, admin_notes: event.target.value }))}
                rows={4}
                className="border-white/10 bg-white/[0.02]"
              />
            </label>

            <label className="space-y-1 text-xs text-white/65">
              Resolution summary
              <Textarea
                value={draft.resolution_summary}
                onChange={(event) => setDraft((prev) => ({ ...prev, resolution_summary: event.target.value }))}
                rows={3}
                className="border-white/10 bg-white/[0.02]"
              />
            </label>

            {draft.triage_status === "needs_repro" ? (
              <div className="space-y-2 rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <p className="text-xs font-medium text-white/80">Needs repro checklist</p>
                <label className="flex items-center gap-2 text-xs text-white/75">
                  <input
                    type="checkbox"
                    checked={draft.repro_checklist.reproduced}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        repro_checklist: { ...prev.repro_checklist, reproduced: event.target.checked }
                      }))
                    }
                  />
                  Reproduced
                </label>
                <label className="flex items-center gap-2 text-xs text-white/75">
                  <input
                    type="checkbox"
                    checked={draft.repro_checklist.steps_verified}
                    onChange={(event) =>
                      setDraft((prev) => ({
                        ...prev,
                        repro_checklist: { ...prev.repro_checklist, steps_verified: event.target.checked }
                      }))
                    }
                  />
                  Steps verified
                </label>
                <Input
                  value={draft.repro_checklist.environment}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      repro_checklist: { ...prev.repro_checklist, environment: event.target.value }
                    }))
                  }
                  placeholder="Environment"
                  className="h-8 border-white/10 bg-white/[0.02]"
                />
                <Textarea
                  value={draft.repro_checklist.notes}
                  onChange={(event) =>
                    setDraft((prev) => ({
                      ...prev,
                      repro_checklist: { ...prev.repro_checklist, notes: event.target.value }
                    }))
                  }
                  rows={3}
                  placeholder="Reproduction notes"
                  className="border-white/10 bg-white/[0.02]"
                />
              </div>
            ) : null}

            {validationError ? <p className="text-xs text-rose-300">{validationError}</p> : null}

            <div className="flex flex-wrap gap-2">
              <Button type="button" size="sm" onClick={() => void saveChanges()} disabled={saving || loading}>
                {saving ? "Saving..." : "Save changes"}
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => void handleQuickAction("acknowledged")}>
                Mark Acknowledged
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => void handleQuickAction("needs_repro")}>
                Needs Repro
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => void handleQuickAction("planned")}>
                Move to Planned
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => void handleQuickAction("in_progress")}>
                Start Work
              </Button>
              <Button type="button" size="sm" variant="secondary" onClick={() => void handleQuickAction("closed")}>
                Close
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setResolveModalOpen(true)}>
                Resolve
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={!report.business_id}
                onClick={() => setNotifyModalOpen(true)}
              >
                Notify Business
              </Button>
            </div>
            {!report.business_id ? (
              <p className="text-[11px] text-white/45">This report is not linked to a business, so notices cannot be sent.</p>
            ) : null}
          </GlassCard>

          <GlassCard accent="blue" className="space-y-3">
            <h3 className="text-sm font-semibold text-white">Internal comments</h3>
            <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
              {data.comments.length ? (
                data.comments.map((item) => (
                  <div key={item.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-2">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-xs font-medium text-white/85">{item.admin_name ?? item.admin_user_id}</p>
                      <p className="text-[11px] text-white/45">{formatDateTime(item.created_at)}</p>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm text-white/75">{item.message}</p>
                  </div>
                ))
              ) : (
                <p className="text-sm text-white/55">No internal comments yet.</p>
              )}
            </div>
            <Textarea
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              rows={3}
              placeholder="Add an internal note"
              className="border-white/10 bg-white/[0.02]"
            />
            <div className="flex justify-end">
              <Button type="button" size="sm" variant="secondary" onClick={() => void postComment()} disabled={!comment.trim()}>
                Post
              </Button>
            </div>
          </GlassCard>
        </div>
      </div>

      <Modal
        open={resolveModalOpen}
        onClose={() => setResolveModalOpen(false)}
        title="Resolve feedback report"
        footer={
          <>
            <Button type="button" size="sm" variant="secondary" onClick={() => setResolveModalOpen(false)}>
              Cancel
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={async () => {
                if (resolveSummaryDraft.trim().length < 10) {
                  push({
                    title: "Resolution summary required",
                    message: "Provide at least 10 characters before resolving.",
                    variant: "error"
                  });
                  return;
                }
                setResolveModalOpen(false);
                setDraft((prev) => ({
                  ...prev,
                  triage_status: "resolved",
                  resolution_summary: resolveSummaryDraft
                }));
                await saveChanges({
                  triage_status: "resolved",
                  resolution_summary: resolveSummaryDraft
                });
              }}
            >
              Confirm resolve
            </Button>
          </>
        }
      >
        <Textarea
          value={resolveSummaryDraft}
          onChange={(event) => setResolveSummaryDraft(event.target.value)}
          rows={4}
          placeholder="How was this issue resolved?"
          className="border-white/10 bg-white/[0.02]"
        />
      </Modal>

      <Modal
        open={notifyModalOpen}
        onClose={() => setNotifyModalOpen(false)}
        title="Send business update"
        footer={
          <>
            <Button type="button" size="sm" variant="secondary" onClick={() => setNotifyModalOpen(false)} disabled={notifying}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={() => void sendBusinessUpdate()} disabled={notifying}>
              {notifying ? "Sending..." : "Send update"}
            </Button>
          </>
        }
      >
        <p className="text-xs text-white/65">This notice appears in the business notifications and as a dashboard banner.</p>
        <label className="space-y-1 text-xs text-white/65">
          Preset
          <select
            value={notifyPreset}
            onChange={(event) => applyNotifyPreset(event.target.value as NoticePresetKey)}
            className="h-9 w-full rounded-lg border border-white/10 bg-white/[0.02] px-2 text-sm text-white"
          >
            {(Object.keys(NOTICE_PRESETS) as NoticePresetKey[]).map((key) => (
              <option key={key} value={key}>
                {NOTICE_PRESETS[key].label}
              </option>
            ))}
          </select>
        </label>
        <label className="space-y-1 text-xs text-white/65">
          Title
          <Input
            value={notifyTitle}
            onChange={(event) => setNotifyTitle(event.target.value)}
            maxLength={120}
            className="h-9 border-white/10 bg-white/[0.02]"
          />
        </label>
        <label className="space-y-1 text-xs text-white/65">
          Message
          <Textarea
            value={notifyMessage}
            onChange={(event) => setNotifyMessage(event.target.value)}
            rows={4}
            maxLength={1000}
            className="border-white/10 bg-white/[0.02]"
          />
        </label>
      </Modal>
    </div>
  );
}

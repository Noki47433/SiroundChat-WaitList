"use client";

import Link from "next/link";
import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/admin/GlassCard";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/components/ui/toast";

type ErrorEventRow = {
  id: string;
  created_at: string;
  severity: "info" | "warn" | "error" | "fatal";
  environment: "dev" | "staging" | "prod";
  source: string;
  message: string;
  stack: string | null;
  route: string | null;
  url: string | null;
  user_agent: string | null;
  business_id: string | null;
  business_name: string | null;
};

type DetailState = {
  group: {
    fingerprint: string;
    created_at: string;
    last_seen_at: string;
    occurrences: number;
    status: "open" | "muted" | "resolved";
    linked_feedback_id: string | null;
    title: string;
    sample_message: string;
    sample_stack: string | null;
    sample_route: string | null;
  };
  linked_feedback: {
    id: string;
    title: string;
    status: string;
  } | null;
  events: ErrorEventRow[];
};

const formatDateTime = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
};

export function AdminErrorDetail({ initialData }: { initialData: DetailState }) {
  const { push } = useToast();
  const [data, setData] = useState(initialData);
  const [busy, setBusy] = useState(false);
  const [search, setSearch] = useState("");
  const [searchRows, setSearchRows] = useState<Array<{ id: string; title: string; status: string }>>([]);
  const [selectedFeedbackId, setSelectedFeedbackId] = useState("");

  const reload = async () => {
    const response = await fetch(`/api/admin/errors/${encodeURIComponent(data.group.fingerprint)}`, { cache: "no-store" });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? "Failed to refresh error group.");
    setData(payload);
  };

  const updateStatus = async (status: "open" | "muted" | "resolved") => {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/errors/${encodeURIComponent(data.group.fingerprint)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to update group.");
      await reload();
      push({ title: "Group updated", variant: "success" });
    } catch (error) {
      push({ title: "Update failed", message: error instanceof Error ? error.message : "", variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const createFeedback = async () => {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/errors/${encodeURIComponent(data.group.fingerprint)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ create_feedback_report: true })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to create feedback report.");
      await reload();
      push({ title: "Feedback report linked", variant: "success" });
    } catch (error) {
      push({ title: "Action failed", message: error instanceof Error ? error.message : "", variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const searchFeedback = async () => {
    if (!search.trim()) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/feedback/search?q=${encodeURIComponent(search.trim())}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to search feedback.");
      setSearchRows(payload.rows ?? []);
    } catch (error) {
      push({ title: "Search failed", message: error instanceof Error ? error.message : "", variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const linkFeedback = async () => {
    if (!selectedFeedbackId) return;
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/errors/${encodeURIComponent(data.group.fingerprint)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ linked_feedback_id: selectedFeedbackId })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to link feedback report.");
      await reload();
      push({ title: "Linked feedback report", variant: "success" });
    } catch (error) {
      push({ title: "Link failed", message: error instanceof Error ? error.message : "", variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <GlassCard accent="blue">
        <Link href="/admin/errors" className="text-xs text-white/60 hover:text-white">
          ← Back to errors
        </Link>
        <h1 className="mt-2 text-xl font-semibold text-white">{data.group.title}</h1>
        <p className="mt-1 break-all text-xs text-white/55">fingerprint: {data.group.fingerprint}</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Badge variant={data.group.status === "resolved" ? "success" : "warning"}>{data.group.status}</Badge>
          <Badge variant="info">{data.group.occurrences} occurrences</Badge>
          <Badge variant="default">last seen {formatDateTime(data.group.last_seen_at)}</Badge>
        </div>
      </GlassCard>

      <div className="grid gap-4 lg:grid-cols-[1fr,320px]">
        <GlassCard accent="none" className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Recent events</h2>
          <div className="space-y-2">
            {data.events.map((event) => (
              <div key={event.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={event.severity === "fatal" || event.severity === "error" ? "warning" : "info"}>
                      {event.severity}
                    </Badge>
                    <Badge variant="default">{event.environment}</Badge>
                  </div>
                  <p className="text-xs text-white/55">{formatDateTime(event.created_at)}</p>
                </div>
                <p className="mt-2 text-sm text-white/80">{event.message}</p>
                {event.route ? <p className="mt-1 text-xs text-white/55">route: {event.route}</p> : null}
                {event.business_name ? <p className="mt-1 text-xs text-white/55">business: {event.business_name}</p> : null}
                {event.stack ? (
                  <Textarea value={event.stack} readOnly rows={6} className="mt-2 font-mono text-[11px]" />
                ) : null}
              </div>
            ))}
            {!data.events.length ? <p className="text-sm text-white/60">No recent events.</p> : null}
          </div>
        </GlassCard>

        <GlassCard accent="danger" className="space-y-3">
          <h2 className="text-lg font-semibold text-white">Actions</h2>
          <div className="grid gap-2">
            <Button size="sm" variant="secondary" disabled={busy} onClick={() => void updateStatus("open")}>
              Mark Open
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void updateStatus("muted")}>
              Mute
            </Button>
            <Button size="sm" variant="outline" disabled={busy} onClick={() => void updateStatus("resolved")}>
              Resolve
            </Button>
          </div>

          <div className="border-t border-white/10 pt-3">
            <p className="text-sm font-medium text-white">Feedback linking</p>
            {data.linked_feedback ? (
              <p className="mt-1 text-xs text-white/60">
                Linked:{" "}
                <Link href={`/admin/feedback/${data.linked_feedback.id}`} className="text-[#9ed6ff] hover:underline">
                  {data.linked_feedback.title}
                </Link>
              </p>
            ) : (
              <p className="mt-1 text-xs text-white/60">No linked feedback report.</p>
            )}
            <Button size="sm" className="mt-2 w-full" disabled={busy} onClick={() => void createFeedback()}>
              Create Feedback Report
            </Button>
          </div>

          <div className="border-t border-white/10 pt-3">
            <p className="text-sm font-medium text-white">Link existing feedback</p>
            <div className="mt-2 flex gap-2">
              <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search title" />
              <Button size="sm" variant="secondary" disabled={busy} onClick={() => void searchFeedback()}>
                Search
              </Button>
            </div>
            {searchRows.length ? (
              <select
                className="mt-2 h-10 w-full rounded-xl border border-white/15 bg-[#0f1520] px-3 text-sm text-white"
                value={selectedFeedbackId}
                onChange={(event) => setSelectedFeedbackId(event.target.value)}
              >
                <option value="">Select report</option>
                {searchRows.map((row) => (
                  <option key={row.id} value={row.id}>
                    {row.title} ({row.status})
                  </option>
                ))}
              </select>
            ) : null}
            <Button size="sm" variant="outline" className="mt-2 w-full" disabled={busy || !selectedFeedbackId} onClick={() => void linkFeedback()}>
              Link selected
            </Button>
          </div>
        </GlassCard>
      </div>
    </div>
  );
}


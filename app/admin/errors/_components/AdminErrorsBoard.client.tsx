"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { GlassCard } from "@/components/admin/GlassCard";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";

type ErrorGroupRow = {
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
  severity: "info" | "warn" | "error" | "fatal";
  environment: "dev" | "staging" | "prod";
  business_id: string | null;
  business_name: string | null;
  recent_24h_count: number;
};

type BusinessOption = {
  id: string;
  name: string;
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

export function AdminErrorsBoard({
  initialGroups,
  initialBusinesses
}: {
  initialGroups: ErrorGroupRow[];
  initialBusinesses: BusinessOption[];
}) {
  const { push } = useToast();
  const [groups, setGroups] = useState(initialGroups);
  const [businesses, setBusinesses] = useState(initialBusinesses);
  const [busy, setBusy] = useState(false);
  const [filters, setFilters] = useState({
    status: "open",
    severity: "all",
    environment: "all",
    business_id: "all",
    search: ""
  });

  const load = async () => {
    setBusy(true);
    try {
      const params = new URLSearchParams();
      params.set("status", filters.status);
      params.set("severity", filters.severity);
      params.set("environment", filters.environment);
      params.set("business_id", filters.business_id);
      if (filters.search.trim()) params.set("search", filters.search.trim());
      const response = await fetch(`/api/admin/errors?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to load error groups.");
      setGroups(payload.groups ?? []);
      setBusinesses(payload.businesses ?? []);
    } catch (error) {
      push({ title: "Load failed", message: error instanceof Error ? error.message : "", variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.status, filters.severity, filters.environment, filters.business_id]);

  const setGroupStatus = async (fingerprint: string, status: "open" | "muted" | "resolved") => {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/errors/${encodeURIComponent(fingerprint)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to update error group.");
      await load();
      push({ title: "Group updated", variant: "success" });
    } catch (error) {
      push({ title: "Update failed", message: error instanceof Error ? error.message : "", variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  const createFeedbackFromGroup = async (fingerprint: string) => {
    setBusy(true);
    try {
      const response = await fetch(`/api/admin/errors/${encodeURIComponent(fingerprint)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ create_feedback_report: true })
      });
      const payload = await response.json();
      if (!response.ok) throw new Error(payload.error ?? "Failed to create feedback report.");
      await load();
      push({ title: "Feedback report linked", variant: "success" });
    } catch (error) {
      push({ title: "Action failed", message: error instanceof Error ? error.message : "", variant: "error" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <GlassCard accent="danger">
        <p className="text-xs uppercase tracking-[0.2em] text-white/45">Auto bug detection</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Error groups</h1>
        <p className="mt-1 text-sm text-white/65">Triage grouped runtime issues and link them to feedback reports.</p>
      </GlassCard>

      <GlassCard accent="blue" className="space-y-3">
        <div className="grid gap-2 lg:grid-cols-5">
          <select
            className="h-10 rounded-xl border border-white/15 bg-[#0f1520] px-3 text-sm text-white"
            value={filters.status}
            onChange={(event) => setFilters((prev) => ({ ...prev, status: event.target.value }))}
          >
            <option value="all">All statuses</option>
            <option value="open">Open</option>
            <option value="muted">Muted</option>
            <option value="resolved">Resolved</option>
          </select>
          <select
            className="h-10 rounded-xl border border-white/15 bg-[#0f1520] px-3 text-sm text-white"
            value={filters.severity}
            onChange={(event) => setFilters((prev) => ({ ...prev, severity: event.target.value }))}
          >
            <option value="all">All severities</option>
            <option value="fatal">Fatal</option>
            <option value="error">Error</option>
            <option value="warn">Warn</option>
            <option value="info">Info</option>
          </select>
          <select
            className="h-10 rounded-xl border border-white/15 bg-[#0f1520] px-3 text-sm text-white"
            value={filters.environment}
            onChange={(event) => setFilters((prev) => ({ ...prev, environment: event.target.value }))}
          >
            <option value="all">All env</option>
            <option value="prod">Prod</option>
            <option value="staging">Staging</option>
            <option value="dev">Dev</option>
          </select>
          <select
            className="h-10 rounded-xl border border-white/15 bg-[#0f1520] px-3 text-sm text-white"
            value={filters.business_id}
            onChange={(event) => setFilters((prev) => ({ ...prev, business_id: event.target.value }))}
          >
            <option value="all">All businesses</option>
            {businesses.map((business) => (
              <option key={business.id} value={business.id}>
                {business.name}
              </option>
            ))}
          </select>
          <Input
            value={filters.search}
            onChange={(event) => setFilters((prev) => ({ ...prev, search: event.target.value }))}
            placeholder="Search title/message"
            onBlur={() => void load()}
          />
        </div>
      </GlassCard>

      <GlassCard accent="none" className="space-y-3">
        <div className="space-y-2">
          {groups.map((group) => (
            <div key={group.fingerprint} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div>
                  <p className="text-sm font-medium text-white">{group.title}</p>
                  <p className="text-xs text-white/55">
                    {group.business_name ?? "Unscoped"} · seen {formatDateTime(group.last_seen_at)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={group.severity === "fatal" || group.severity === "error" ? "warning" : "info"}>
                    {group.severity}
                  </Badge>
                  <Badge variant={group.status === "resolved" ? "success" : "default"}>{group.status}</Badge>
                </div>
              </div>
              <p className="mt-2 text-sm text-white/75">{group.sample_message}</p>
              <p className="mt-1 text-xs text-white/55">
                occurrences: {group.occurrences} · 24h: {group.recent_24h_count} · env: {group.environment}
              </p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <Link
                  href={`/admin/errors/${encodeURIComponent(group.fingerprint)}`}
                  className="inline-flex h-8 items-center rounded-lg border border-white/15 px-3 text-xs text-white/85 hover:bg-white/10"
                >
                  View details
                </Link>
                <Button size="xs" variant="secondary" disabled={busy} onClick={() => void createFeedbackFromGroup(group.fingerprint)}>
                  Create feedback report
                </Button>
                {group.status !== "muted" ? (
                  <Button size="xs" variant="outline" disabled={busy} onClick={() => void setGroupStatus(group.fingerprint, "muted")}>
                    Mute
                  </Button>
                ) : null}
                {group.status !== "resolved" ? (
                  <Button size="xs" variant="outline" disabled={busy} onClick={() => void setGroupStatus(group.fingerprint, "resolved")}>
                    Resolve
                  </Button>
                ) : null}
                {group.linked_feedback_id ? (
                  <Link href={`/admin/feedback/${group.linked_feedback_id}`} className="text-xs text-[#9ed6ff] hover:underline">
                    Linked feedback
                  </Link>
                ) : null}
              </div>
            </div>
          ))}
          {!groups.length ? <p className="text-sm text-white/60">{busy ? "Loading..." : "No error groups found."}</p> : null}
        </div>
      </GlassCard>
    </div>
  );
}


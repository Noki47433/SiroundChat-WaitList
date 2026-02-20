"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { GlassCard } from "@/components/admin/GlassCard";

type ActivityRow = {
  id: string;
  created_at: string;
  business_id: string;
  business_name: string | null;
  user_id: string | null;
  actor_type: "business_user" | "system" | "admin";
  event_type: string;
  summary: string;
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

export function AdminActivityFeed({
  initialRows,
  initialBusinesses,
  initialEventTypes
}: {
  initialRows: ActivityRow[];
  initialBusinesses: BusinessOption[];
  initialEventTypes: string[];
}) {
  const [rows, setRows] = useState(initialRows);
  const [businesses, setBusinesses] = useState(initialBusinesses);
  const [eventTypes, setEventTypes] = useState(initialEventTypes);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({
    business_id: "all",
    event_type: "all",
    range: "7d"
  });

  const load = async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("business_id", filters.business_id);
      params.set("event_type", filters.event_type);
      params.set("range", filters.range);
      const response = await fetch(`/api/admin/activity?${params.toString()}`, { cache: "no-store" });
      const payload = await response.json();
      if (!response.ok) {
        throw new Error(payload.error ?? "Failed to load activity feed.");
      }
      setRows(payload.events ?? []);
      setBusinesses(payload.businesses ?? []);
      setEventTypes(payload.event_types ?? []);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.business_id, filters.event_type, filters.range]);

  return (
    <div className="space-y-4">
      <GlassCard accent="blue">
        <p className="text-xs uppercase tracking-[0.2em] text-white/45">Admin feed</p>
        <h1 className="mt-2 text-2xl font-semibold text-white">Client Activity</h1>
        <p className="mt-1 text-sm text-white/65">Audit stream of key business events across the platform.</p>
      </GlassCard>

      <GlassCard accent="none">
        <div className="grid gap-2 lg:grid-cols-3">
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
          <select
            className="h-10 rounded-xl border border-white/15 bg-[#0f1520] px-3 text-sm text-white"
            value={filters.event_type}
            onChange={(event) => setFilters((prev) => ({ ...prev, event_type: event.target.value }))}
          >
            <option value="all">All event types</option>
            {eventTypes.map((eventType) => (
              <option key={eventType} value={eventType}>
                {eventType}
              </option>
            ))}
          </select>
          <select
            className="h-10 rounded-xl border border-white/15 bg-[#0f1520] px-3 text-sm text-white"
            value={filters.range}
            onChange={(event) => setFilters((prev) => ({ ...prev, range: event.target.value }))}
          >
            <option value="24h">Last 24h</option>
            <option value="7d">Last 7d</option>
            <option value="30d">Last 30d</option>
          </select>
        </div>
      </GlassCard>

      <GlassCard accent="green" className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <Badge variant="default">{row.event_type}</Badge>
                <Badge variant="info">{row.actor_type}</Badge>
              </div>
              <p className="text-xs text-white/55">{formatDateTime(row.created_at)}</p>
            </div>
            <p className="mt-2 text-sm text-white/85">{row.summary}</p>
            <p className="mt-1 text-xs text-white/55">
              {row.business_name ?? row.business_id}
              {row.business_id ? (
                <>
                  {" "}
                  ·{" "}
                  <Link href={`/admin/businesses/${row.business_id}`} className="text-[#9ed6ff] hover:underline">
                    Open business
                  </Link>
                </>
              ) : null}
            </p>
          </div>
        ))}
        {!rows.length ? <p className="text-sm text-white/60">{loading ? "Loading..." : "No activity events found."}</p> : null}
      </GlassCard>
    </div>
  );
}


"use client";

import Link from "next/link";
import { AlertTriangle, CheckCircle2, Circle, Info, Siren, ShieldAlert } from "lucide-react";
import { GlassCard } from "@/components/admin/GlassCard";
import type { AdminNotification } from "@/lib/admin/metrics";

const iconForSeverity = (severity: AdminNotification["severity"]) => {
  switch (severity) {
    case "success":
      return <CheckCircle2 className="h-4 w-4 text-emerald-300" />;
    case "warn":
      return <AlertTriangle className="h-4 w-4 text-amber-300" />;
    case "danger":
      return <ShieldAlert className="h-4 w-4 text-rose-300" />;
    default:
      return <Info className="h-4 w-4 text-sky-300" />;
  }
};

const badgeClassForSeverity = (severity: AdminNotification["severity"]) => {
  switch (severity) {
    case "success":
      return "bg-emerald-500/15 text-emerald-200 border-emerald-400/20";
    case "warn":
      return "bg-amber-500/15 text-amber-200 border-amber-400/20";
    case "danger":
      return "bg-rose-500/15 text-rose-200 border-rose-400/20";
    default:
      return "bg-sky-500/15 text-sky-200 border-sky-400/20";
  }
};

const relativeTime = (value: string) => {
  const diff = Date.now() - new Date(value).getTime();
  const minutes = Math.max(1, Math.round(diff / 60000));
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
};

export function LiveFeed({ events }: { events: AdminNotification[] }) {
  return (
    <GlassCard accent="blue" className="h-full">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold text-[var(--adm-text)]">Live Feed</p>
          <p className="text-xs text-[var(--adm-muted)]">Newest events across all businesses</p>
        </div>
        <div className="inline-flex items-center gap-1 rounded-full border border-[#55FF95]/25 bg-[#55FF95]/10 px-2 py-1 text-[11px] text-[#a9ffca]">
          <Circle className="h-2.5 w-2.5 fill-current text-[#55FF95] admin-live-dot" />
          LIVE
        </div>
      </div>

      <div className="mt-4 max-h-[560px] space-y-2 overflow-auto pr-1">
        {events.length ? (
          events.map((event) => (
            <div key={event.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="flex items-start gap-2">
                  <span className="mt-0.5 inline-flex">{iconForSeverity(event.severity)}</span>
                  <div>
                    <p className="text-sm text-[var(--adm-text)]">{event.title}</p>
                    <p className="text-[11px] text-white/60">{event.businessName}</p>
                  </div>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] ${badgeClassForSeverity(event.severity)}`}>
                  {event.severity}
                </span>
              </div>
              {event.body ? <p className="mt-2 text-xs text-white/70">{event.body}</p> : null}
              <div className="mt-2 flex items-center justify-between">
                <p className="text-[11px] text-white/40">{relativeTime(event.createdAt)}</p>
                <Link href={`/admin/businesses/${event.businessId}`} className="text-[11px] text-[#9BFFBF] hover:underline">
                  Open
                </Link>
              </div>
            </div>
          ))
        ) : (
          <div className="rounded-xl border border-dashed border-white/15 p-4 text-xs text-white/60">
            No events yet. Use the dev simulation endpoint to test live updates.
          </div>
        )}
      </div>
    </GlassCard>
  );
}

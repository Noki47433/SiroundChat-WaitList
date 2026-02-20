"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { BellRing, PhoneCall, Trophy } from "lucide-react";
import { KpiCard } from "@/components/admin/KpiCard";
import { GlassCard } from "@/components/admin/GlassCard";
import { RevenueMessagesChart } from "@/components/admin/Charts/RevenueMessagesChart";
import { PlanDonut } from "@/components/admin/Charts/PlanDonut";
import type { AdminOverviewData } from "@/lib/admin/metrics";
import { useRealtimeTable } from "@/hooks/useRealtime";

export function OverviewClient({ initialData }: { initialData: AdminOverviewData }) {
  const [data, setData] = useState(initialData);

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/admin/kpis?range=${data.range}`, { cache: "no-store" });
    if (!response.ok) return;
    const next = (await response.json()) as AdminOverviewData;
    setData(next);
  }, [data.range]);

  const { connected, lastEventAt } = useRealtimeTable({
    table: "events",
    onChange: () => void refresh(),
    onPoll: refresh,
    pollingMs: 15000
  });

  useRealtimeTable({
    table: "business_metrics_daily",
    onChange: () => void refresh(),
    onPoll: refresh,
    pollingMs: 20000
  });

  useRealtimeTable({
    table: "business_metrics_realtime",
    onChange: () => void refresh(),
    onPoll: refresh,
    pollingMs: 20000
  });

  const lastEventLabel = useMemo(() => {
    if (!lastEventAt) return "Awaiting event stream";
    return new Date(lastEventAt).toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit"
    });
  }, [lastEventAt]);

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {data.kpis.map((kpi) => (
          <KpiCard
            key={kpi.key}
            label={kpi.label}
            value={kpi.value}
            displayValue={kpi.displayValue}
            delta={kpi.delta}
            series={kpi.series}
          />
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.9fr,1fr]">
        <div className="space-y-4">
          <GlassCard accent="blue">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-[var(--adm-text)]">Revenue & Messages</p>
                <p className="text-xs text-[var(--adm-muted)]">MRR, message volume, and leads over time</p>
              </div>
              <div className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-white/[0.02] px-3 py-1 text-[11px] text-white/60">
                <span className={`h-2 w-2 rounded-full ${connected ? "bg-[#55FF95] admin-live-dot" : "bg-rose-400"}`} />
                {connected ? "Realtime connected" : "Polling fallback"}
                <span className="text-white/30">•</span>
                <span>{lastEventLabel}</span>
              </div>
            </div>
            <RevenueMessagesChart data={data.chartSeries} />
          </GlassCard>

          <GlassCard accent="green">
            <div className="mb-3">
              <p className="text-sm font-semibold text-[var(--adm-text)]">Plan Distribution</p>
              <p className="text-xs text-[var(--adm-muted)]">Current subscription mix</p>
            </div>
            <div className="grid gap-4 lg:grid-cols-[1fr,1fr]">
              <PlanDonut data={data.planDistribution} />
              <div className="space-y-2 self-center">
                {data.planDistribution.map((item) => (
                  <div key={item.name} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2">
                    <span className="h-2.5 w-2.5 rounded-full" style={{ background: item.color }} />
                    <span className="text-sm text-white/80">{item.name}</span>
                    <span className="ml-auto text-sm text-[var(--adm-text)]">{item.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </GlassCard>
        </div>

        <div className="space-y-4">
          <GlassCard accent="blue">
            <div className="mb-2 flex items-center gap-2">
              <BellRing className="h-4 w-4 text-[#84F8BC]" />
              <p className="text-sm font-semibold text-[var(--adm-text)]">Notifications</p>
            </div>
            <div className="max-h-72 space-y-2 overflow-auto pr-1">
              {data.notifications.length ? (
                data.notifications.map((event) => (
                  <div key={event.id} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                    <p className="text-sm text-white/90">{event.title}</p>
                    <p className="text-xs text-white/55">{event.businessName}</p>
                    {event.body ? <p className="mt-1 text-xs text-white/70">{event.body}</p> : null}
                  </div>
                ))
              ) : (
                <p className="text-xs text-white/60">No notifications yet.</p>
              )}
            </div>
          </GlassCard>

          <GlassCard accent="warning">
            <div className="mb-2 flex items-center gap-2">
              <PhoneCall className="h-4 w-4 text-amber-300" />
              <p className="text-sm font-semibold text-[var(--adm-text)]">At Risk</p>
            </div>
            <div className="space-y-2">
              {data.atRisk.length ? (
                data.atRisk.map((item) => (
                  <div key={item.businessId} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm text-white">{item.businessName}</p>
                      <span className="rounded-full border border-amber-300/30 bg-amber-500/10 px-2 py-0.5 text-[11px] text-amber-200">
                        score {item.score}
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-white/60">{item.reasons[0] ?? "Needs review"}</p>
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <Link href={`/admin/businesses/${item.businessId}`} className="text-[#9BFFBF] hover:underline">
                        View
                      </Link>
                      {item.phone ? (
                        <a href={`tel:${item.phone}`} className="text-white/75 hover:text-white">
                          Call
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-white/60">No risky accounts by current rules.</p>
              )}
            </div>
          </GlassCard>

          <GlassCard accent="green">
            <div className="mb-2 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-emerald-300" />
              <p className="text-sm font-semibold text-[var(--adm-text)]">High Performers</p>
            </div>
            <div className="space-y-2">
              {data.highPerformers.length ? (
                data.highPerformers.map((item) => (
                  <div key={item.businessId} className="rounded-xl border border-white/10 bg-white/[0.03] p-3">
                    <p className="text-sm text-white">{item.businessName}</p>
                    <p className="mt-1 text-xs text-white/60">{item.highlights[0] ?? "Strong growth trend"}</p>
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <Link href={`/admin/businesses/${item.businessId}`} className="text-[#9BFFBF] hover:underline">
                        View
                      </Link>
                      {item.phone ? (
                        <a href={`tel:${item.phone}`} className="text-white/75 hover:text-white">
                          Call
                        </a>
                      ) : null}
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-xs text-white/60">No high performers yet.</p>
              )}
            </div>
          </GlassCard>
        </div>
      </div>
    </div>
  );
}

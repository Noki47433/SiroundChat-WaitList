"use client";

import { useCallback, useState } from "react";
import { GlassCard } from "@/components/admin/GlassCard";
import { PlanDonut } from "@/components/admin/Charts/PlanDonut";
import { RevenueChart } from "@/components/admin/Charts/RevenueChart";
import { useRealtimeTable } from "@/hooks/useRealtime";
import type { RevenueData } from "@/lib/admin/metrics";

const eur = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "EUR",
    maximumFractionDigits: 0
  }).format(value);

export function RevenueClient({ initialData }: { initialData: RevenueData }) {
  const [data, setData] = useState(initialData);

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/admin/revenue?range=${data.range}`, { cache: "no-store" });
    if (!response.ok) return;
    const next = (await response.json()) as RevenueData;
    setData(next);
  }, [data.range]);

  useRealtimeTable({
    table: "subscriptions",
    onChange: () => void refresh(),
    onPoll: refresh,
    pollingMs: 20000
  });

  return (
    <div className="space-y-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <GlassCard accent="green">
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Current MRR</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--adm-text)]">{eur(data.summary.mrrEur)}</p>
        </GlassCard>
        <GlassCard accent="blue">
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">New MRR</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--adm-text)]">{eur(data.summary.newMrrEur)}</p>
        </GlassCard>
        <GlassCard accent="danger">
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Churned MRR</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--adm-text)]">{eur(data.summary.churnedMrrEur)}</p>
        </GlassCard>
        <GlassCard accent="warning">
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">Trials → Paid</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--adm-text)]">{data.summary.conversionRate.toFixed(1)}%</p>
        </GlassCard>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.7fr,1fr]">
        <GlassCard accent="blue">
          <p className="text-sm font-semibold text-[var(--adm-text)]">Revenue Momentum</p>
          <p className="text-xs text-[var(--adm-muted)]">MRR vs new/churned movement</p>
          <div className="mt-3">
            <RevenueChart data={data.series} />
          </div>
        </GlassCard>

        <GlassCard accent="green">
          <p className="text-sm font-semibold text-[var(--adm-text)]">Plan Mix</p>
          <p className="text-xs text-[var(--adm-muted)]">Current plan distribution</p>
          <div className="mt-3">
            <PlanDonut
              data={data.planDistribution.map((item, index) => ({
                ...item,
                color: ["#55FF95", "#4DD6FF", "#FFC547", "#79FFE1"][index % 4]
              }))}
            />
          </div>
        </GlassCard>
      </div>
    </div>
  );
}

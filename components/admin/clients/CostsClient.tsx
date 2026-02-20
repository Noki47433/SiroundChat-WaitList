"use client";

import { useCallback, useState } from "react";
import { AlertTriangle } from "lucide-react";
import { GlassCard } from "@/components/admin/GlassCard";
import { CostBarChart } from "@/components/admin/Charts/CostBarChart";
import { CostTrendChart } from "@/components/admin/Charts/CostTrendChart";
import { useRealtimeTable } from "@/hooks/useRealtime";
import type { CostsData } from "@/lib/admin/metrics";

const usd = (value: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2
  }).format(value);

export function CostsClient({ initialData }: { initialData: CostsData }) {
  const [data, setData] = useState(initialData);

  const refresh = useCallback(async () => {
    const response = await fetch(`/api/admin/costs?range=${data.range}`, { cache: "no-store" });
    if (!response.ok) return;
    const next = (await response.json()) as CostsData;
    setData(next);
  }, [data.range]);

  useRealtimeTable({
    table: "business_metrics_daily",
    onChange: () => void refresh(),
    onPoll: refresh,
    pollingMs: 20000
  });

  return (
    <div className="space-y-4">
      <GlassCard accent="blue">
        <p className="text-xs uppercase tracking-[0.2em] text-white/45">Total AI Cost</p>
        <p className="mt-2 text-3xl font-semibold text-[var(--adm-text)]">{usd(data.totalAiCostUsd)}</p>
      </GlassCard>

      <div className="grid gap-4 lg:grid-cols-[1.7fr,1fr]">
        <GlassCard accent="blue">
          <p className="text-sm font-semibold text-[var(--adm-text)]">Cost Trend</p>
          <p className="text-xs text-[var(--adm-muted)]">Daily AI spend with token movement</p>
          <div className="mt-3">
            <CostTrendChart data={data.series} />
          </div>
        </GlassCard>

        <GlassCard accent="green">
          <p className="text-sm font-semibold text-[var(--adm-text)]">Cost by Business</p>
          <p className="text-xs text-[var(--adm-muted)]">Top cost contributors this period</p>
          <div className="mt-3">
            <CostBarChart data={data.costByBusiness.map((item) => ({ businessName: item.businessName, cost: item.cost }))} />
          </div>
        </GlassCard>
      </div>

      <GlassCard accent="warning">
        <div className="mb-3 flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-amber-300" />
          <p className="text-sm font-semibold text-[var(--adm-text)]">Cost Anomalies</p>
        </div>

        <div className="space-y-2">
          {data.anomalies.length ? (
            data.anomalies.map((anomaly) => (
              <div key={anomaly.businessId} className="rounded-xl border border-white/10 bg-white/[0.03] p-3 text-sm text-white/85">
                <p>{anomaly.businessName}</p>
                <p className="mt-1 text-xs text-white/60">
                  Today {usd(anomaly.todayCost)} vs baseline {usd(anomaly.baselineCost)} ({anomaly.ratio}x)
                </p>
              </div>
            ))
          ) : (
            <p className="text-xs text-white/60">No anomalies detected.</p>
          )}
        </div>
      </GlassCard>
    </div>
  );
}

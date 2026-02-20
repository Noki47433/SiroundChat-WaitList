"use client";

import { useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

type Range = "7d" | "30d" | "90d";

type MetricsPayload = {
  range: Range;
  metrics: {
    reservations: { started: number; completed: number; conversionRate: number };
    upsells: { shown: number; accepted: number; acceptanceRate: number };
    offers: { sent: number; redeemed: number; redemptionRate: number };
    revenueAttributed: number;
    leadFunnel: { hot: number; warm: number; cold: number };
  };
};

export default function MatterMetrics({ initialRange = "30d" }: { initialRange?: Range }) {
  const [range, setRange] = useState<Range>(initialRange);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [metrics, setMetrics] = useState<MetricsPayload["metrics"] | null>(null);

  const load = async (nextRange: Range) => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(`/api/analytics/matter?range=${nextRange}`, { cache: "no-store" });
      const payload = (await response.json()) as MetricsPayload & { error?: string };
      if (!response.ok) {
        throw new Error(payload?.error ?? "Failed to load metrics");
      }
      setMetrics(payload.metrics);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load metrics");
      setMetrics(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load(range);
  }, [range]);

  return (
    <Card className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">Analytics That Matter</p>
          <h3 className="text-lg font-semibold">Revenue + Conversion Metrics</h3>
        </div>
        <div className="flex gap-2">
          {(["7d", "30d", "90d"] as Range[]).map((option) => (
            <Button
              key={option}
              size="sm"
              variant={range === option ? "primary" : "outline"}
              onClick={() => setRange(option)}
              disabled={loading}
            >
              {option}
            </Button>
          ))}
        </div>
      </div>

      {loading ? <p className="text-sm text-white/60">Loading metrics...</p> : null}
      {error ? <p className="text-sm text-red-300">{error}</p> : null}

      {metrics ? (
        <>
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">Res. conversion</p>
              <p className="mt-2 text-2xl font-semibold">{metrics.reservations.conversionRate}%</p>
              <p className="text-xs text-white/60">
                {metrics.reservations.completed}/{metrics.reservations.started}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">Upsell acceptance</p>
              <p className="mt-2 text-2xl font-semibold">{metrics.upsells.acceptanceRate}%</p>
              <p className="text-xs text-white/60">
                {metrics.upsells.accepted}/{metrics.upsells.shown}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">Offer redemption</p>
              <p className="mt-2 text-2xl font-semibold">{metrics.offers.redemptionRate}%</p>
              <p className="text-xs text-white/60">
                {metrics.offers.redeemed}/{metrics.offers.sent}
              </p>
            </div>
            <div className="rounded-2xl border border-white/10 bg-white/5 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-white/50">Revenue attributed</p>
              <p className="mt-2 text-2xl font-semibold">€{metrics.revenueAttributed.toFixed(2)}</p>
              <p className="text-xs text-white/60">Upsells + redeemed offers</p>
            </div>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-red-200">Hot leads</p>
              <p className="mt-2 text-2xl font-semibold text-red-100">{metrics.leadFunnel.hot}</p>
            </div>
            <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-amber-200">Warm leads</p>
              <p className="mt-2 text-2xl font-semibold text-amber-100">{metrics.leadFunnel.warm}</p>
            </div>
            <div className="rounded-2xl border border-sky-500/20 bg-sky-500/10 p-3">
              <p className="text-xs uppercase tracking-[0.2em] text-sky-200">Cold leads</p>
              <p className="mt-2 text-2xl font-semibold text-sky-100">{metrics.leadFunnel.cold}</p>
            </div>
          </div>
        </>
      ) : null}
    </Card>
  );
}

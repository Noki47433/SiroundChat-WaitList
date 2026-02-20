"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from "recharts";
import { SafeChartContainer } from "@/components/analytics/SafeChartContainer";

type Metric = "conversations" | "opens" | "leads";
type Point = { label: string; value: number };

export function MainAnalyticsChart({
  seriesByMetric
}: {
  seriesByMetric: Record<Metric, Point[]>;
}) {
  const [metric, setMetric] = useState<Metric>("conversations");

  const data = useMemo(() => seriesByMetric[metric] ?? [], [seriesByMetric, metric]);
  const safeData = data ?? [];

  return (
    <div className="min-w-0 rounded-3xl border border-white/10 bg-white/5 p-6">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-sm font-semibold">Weekly volume</p>
          <p className="text-xs text-white/60">Last 7 days</p>
        </div>

        <div className="flex rounded-full border border-white/10 bg-black/30 p-1">
          {(["conversations", "opens", "leads"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={[
                "rounded-full px-3 py-1 text-xs transition",
                metric === m ? "bg-white/10 text-white" : "text-white/60 hover:text-white"
              ].join(" ")}
            >
              {m[0].toUpperCase() + m.slice(1)}
            </button>
          ))}
        </div>
      </div>

      <SafeChartContainer className="mt-6 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={safeData}>
            <CartesianGrid strokeDasharray="3 3" opacity={0.15} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip
              contentStyle={{
                background: "rgba(0,0,0,0.85)",
                border: "1px solid rgba(255,255,255,0.1)",
                borderRadius: 12
              }}
              labelStyle={{ color: "rgba(255,255,255,0.8)" }}
            />
            <Line type="monotone" dataKey="value" strokeWidth={3} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </SafeChartContainer>
    </div>
  );
}

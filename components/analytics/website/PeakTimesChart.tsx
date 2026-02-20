"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { SafeChartContainer } from "@/components/analytics/SafeChartContainer";

const formatHour = (value: number) => `${String(value).padStart(2, "0")}:00`;

type HourPoint = { hour: number; visitors: number; interactions: number; leads: number };

type PeakTimesChartProps = {
  data: HourPoint[];
};

export function PeakTimesChart({ data }: PeakTimesChartProps) {
  const safeData = data ?? [];
  return (
    <SafeChartContainer className="h-52">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={safeData} margin={{ top: 10, right: 12, left: -10, bottom: 0 }}>
          <defs>
            <linearGradient id="peakGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="#38BDF8" stopOpacity={0.6} />
              <stop offset="95%" stopColor="#38BDF8" stopOpacity={0.05} />
            </linearGradient>
          </defs>
          <XAxis
            dataKey="hour"
            tickFormatter={(value) => formatHour(value)}
            axisLine={false}
            tickLine={false}
            interval={3}
            tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 10 }}
          />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.4)", fontSize: 10 }} />
          <Tooltip
            contentStyle={{
              background: "rgba(15,23,42,0.9)",
              border: "1px solid rgba(255,255,255,0.1)",
              borderRadius: 12
            }}
            labelFormatter={(label) => `Hour: ${formatHour(Number(label))}`}
            formatter={(value: number | undefined) => [value ?? 0, "Interactions"]}
          />
          <Area type="monotone" dataKey="interactions" stroke="#38BDF8" strokeWidth={2} fill="url(#peakGradient)" />
        </AreaChart>
      </ResponsiveContainer>
    </SafeChartContainer>
  );
}

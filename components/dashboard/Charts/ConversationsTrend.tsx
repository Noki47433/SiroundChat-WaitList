"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis } from "recharts";
import { SafeChartContainer } from "@/components/analytics/SafeChartContainer";

export type TrendPoint = {
  label: string;
  value: number;
};

type ConversationsTrendProps = {
  data: TrendPoint[];
};

const tooltipStyle = {
  background: "rgba(15,23,42,0.9)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  padding: "8px 10px",
  color: "#E2E8F0",
  fontSize: 12
};

export function ConversationsTrend({ data }: ConversationsTrendProps) {
  const safeData = data ?? [];
  const hasData = safeData.some((point) => point.value > 0);

  return (
    <div className="relative h-48 w-full min-w-0">
      <SafeChartContainer className={`h-48 ${hasData ? "" : "opacity-0"}`}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={safeData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="trend-gradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#38BDF8" stopOpacity={0.45} />
                <stop offset="100%" stopColor="#38BDF8" stopOpacity={0} />
              </linearGradient>
            </defs>
            <XAxis dataKey="label" tick={{ fill: "#94A3B8", fontSize: 10 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={tooltipStyle} formatter={(value) => [value, "Conversations"]} />
            <Area
              type="monotone"
              dataKey="value"
              stroke="#38BDF8"
              strokeWidth={2}
              fill="url(#trend-gradient)"
              dot={false}
              isAnimationActive={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      </SafeChartContainer>
      {!hasData ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xs text-white/50">
          Awaiting engagement data
        </div>
      ) : null}
    </div>
  );
}

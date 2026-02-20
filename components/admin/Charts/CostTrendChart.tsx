"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type CostTrendChartProps = {
  data: Array<{ day: string; cost: number; tokensIn: number; tokensOut: number }>;
};

export function CostTrendChart({ data }: CostTrendChartProps) {
  const safeData = data.map((point) => ({ ...point, label: point.day.slice(5) }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={safeData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
          <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 11 }} />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              background: "rgba(9,13,19,0.95)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              color: "#DCE9FF"
            }}
          />
          <Area type="monotone" dataKey="cost" stroke="#4DD6FF" fill="rgba(77,214,255,0.2)" strokeWidth={2.3} isAnimationActive={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}

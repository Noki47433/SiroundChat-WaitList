"use client";

import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type UsageStackedChartProps = {
  data: Array<{
    day: string;
    aiMessages: number;
    humanMessages: number;
  }>;
};

export function UsageStackedChart({ data }: UsageStackedChartProps) {
  const safeData = data.map((item) => ({
    ...item,
    label: item.day.slice(5)
  }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={safeData} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
          <CartesianGrid stroke="rgba(255,255,255,0.08)" strokeDasharray="4 4" vertical={false} />
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
          <Bar dataKey="aiMessages" stackId="messages" fill="#55FF95" radius={[6, 6, 0, 0]} isAnimationActive={false} />
          <Bar dataKey="humanMessages" stackId="messages" fill="#4DD6FF" radius={[6, 6, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

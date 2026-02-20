"use client";

import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type UsageLineChartProps = {
  data: Array<{ day: string; messages: number; leads: number }>;
};

export function UsageLineChart({ data }: UsageLineChartProps) {
  const safeData = data.map((point) => ({ ...point, label: point.day.slice(5) }));

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={safeData} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
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
          <Line type="monotone" dataKey="messages" stroke="#55FF95" strokeWidth={2.4} dot={false} isAnimationActive={false} />
          <Line type="monotone" dataKey="leads" stroke="#4DD6FF" strokeWidth={2} dot={false} isAnimationActive={false} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

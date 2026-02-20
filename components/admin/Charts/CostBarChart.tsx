"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type CostBarChartProps = {
  data: Array<{ businessName: string; cost: number }>;
};

export function CostBarChart({ data }: CostBarChartProps) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="businessName"
            axisLine={false}
            tickLine={false}
            tick={{ fill: "rgba(255,255,255,0.6)", fontSize: 11 }}
            interval={0}
            angle={-18}
            textAnchor="end"
            height={70}
          />
          <YAxis axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              background: "rgba(9,13,19,0.95)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              color: "#DCE9FF"
            }}
          />
          <Bar dataKey="cost" fill="#4DD6FF" radius={[8, 8, 0, 0]} isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

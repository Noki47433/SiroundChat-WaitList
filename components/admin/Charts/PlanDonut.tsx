"use client";

import { Pie, PieChart, ResponsiveContainer, Cell, Tooltip } from "recharts";

type PlanDonutProps = {
  data: Array<{ name: string; value: number; color?: string }>;
};

export function PlanDonut({ data }: PlanDonutProps) {
  const total = data.reduce((sum, item) => sum + item.value, 0);

  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={72}
            outerRadius={98}
            paddingAngle={4}
            stroke="none"
            isAnimationActive={false}
          >
            {data.map((item, index) => (
              <Cell key={`${item.name}-${index}`} fill={item.color ?? ["#55FF95", "#32D4A4", "#4DD6FF", "#70F7C0"][index % 4]} />
            ))}
          </Pie>
          <Tooltip
            cursor={false}
            contentStyle={{
              background: "rgba(9,13,19,0.95)",
              border: "1px solid rgba(255,255,255,0.12)",
              borderRadius: 12,
              color: "#DCE9FF"
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="pointer-events-none -mt-40 text-center">
        <p className="text-xs uppercase tracking-[0.2em] text-white/45">Total</p>
        <p className="text-3xl font-semibold text-[var(--adm-text)]">{total}</p>
      </div>
    </div>
  );
}

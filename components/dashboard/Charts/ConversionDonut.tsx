"use client";

import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip } from "recharts";
import { SafeChartContainer } from "@/components/analytics/SafeChartContainer";

export type ConversionSegment = {
  name: string;
  value: number;
  color: string;
};

type ConversionDonutProps = {
  segments: ConversionSegment[];
};

const tooltipStyle = {
  background: "rgba(15,23,42,0.9)",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: 12,
  padding: "8px 10px",
  color: "#E2E8F0",
  fontSize: 12
};
const tooltipTextStyle = {
  color: "#F8FAFC",
  fontSize: 12
};

export function ConversionDonut({ segments }: ConversionDonutProps) {
  const safeSegments = segments ?? [];
  const total = safeSegments.reduce((sum, segment) => sum + segment.value, 0);
  const hasData = total > 0;

  return (
    <div className="relative h-52 w-full min-w-0">
      <SafeChartContainer className={`h-52 ${hasData ? "" : "opacity-0"}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={tooltipTextStyle}
              itemStyle={tooltipTextStyle}
              formatter={(value) => [String(value), "Count"]}
            />
            <Pie
              data={safeSegments}
              dataKey="value"
              innerRadius={60}
              outerRadius={80}
              stroke="rgba(255,255,255,0.08)"
              strokeWidth={1}
              paddingAngle={2}
            >
              {safeSegments.map((segment) => (
                <Cell key={segment.name} fill={segment.color} />
              ))}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </SafeChartContainer>
      {!hasData ? (
        <div className="absolute inset-0 flex items-center justify-center rounded-2xl border border-white/10 bg-white/5 text-xs text-white/50">
          Awaiting conversion data
        </div>
      ) : null}
    </div>
  );
}

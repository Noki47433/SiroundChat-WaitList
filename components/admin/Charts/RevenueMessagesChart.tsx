"use client";

import { useMemo, useState } from "react";
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Button } from "@/components/ui/button";

type ChartPoint = {
  day: string;
  mrr: number;
  messages: number;
  leads: number;
};

type RevenueMessagesChartProps = {
  data: ChartPoint[];
};

const METRICS = [
  { key: "mrr", label: "MRR", color: "#55FF95" },
  { key: "messages", label: "Messages", color: "#4DD6FF" },
  { key: "leads", label: "Leads", color: "#FFC547" }
] as const;

export function RevenueMessagesChart({ data }: RevenueMessagesChartProps) {
  const [active, setActive] = useState<(typeof METRICS)[number]["key"][]>(["mrr", "messages", "leads"]);

  const safeData = useMemo(
    () => data.map((point) => ({ ...point, label: point.day.slice(5) })),
    [data]
  );

  const toggle = (key: (typeof METRICS)[number]["key"]) => {
    setActive((prev) => (prev.includes(key) ? prev.filter((item) => item !== key) : [...prev, key]));
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {METRICS.map((metric) => {
          const isActive = active.includes(metric.key);
          return (
            <Button
              key={metric.key}
              size="xs"
              variant={isActive ? "primary" : "ghost"}
              className={isActive ? "bg-white/10 text-white hover:bg-white/15" : "text-white/55"}
              onClick={() => toggle(metric.key)}
            >
              <span className="mr-1.5 inline-block h-2 w-2 rounded-full" style={{ background: metric.color }} />
              {metric.label}
            </Button>
          );
        })}
      </div>
      <div className="h-72 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={safeData} margin={{ top: 6, right: 12, left: 0, bottom: 0 }}>
            <XAxis dataKey="label" axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.55)", fontSize: 12 }} />
            <YAxis axisLine={false} tickLine={false} tick={{ fill: "rgba(255,255,255,0.45)", fontSize: 12 }} />
            <Tooltip
              contentStyle={{
                background: "rgba(9,13,19,0.95)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 12,
                color: "#DCE9FF"
              }}
            />
            {METRICS.filter((metric) => active.includes(metric.key)).map((metric) => (
              <Line
                key={metric.key}
                type="monotone"
                dataKey={metric.key}
                stroke={metric.color}
                strokeWidth={2.3}
                dot={false}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

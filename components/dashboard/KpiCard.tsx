"use client";

import { Card } from "@/components/ui/card";
import { TrendingDown, TrendingUp, MessageCircle, Users, CalendarCheck, Timer } from "lucide-react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { SafeChartContainer } from "@/components/analytics/SafeChartContainer";

const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);

const formatDelta = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return "-";
  const rounded = Math.round(value);
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
};

type KpiCardProps = {
  label: string;
  value: number;
  delta: number | null;
  series: number[];
  icon: "conversations" | "leads" | "reservations" | "response";
};

const iconMap = {
  conversations: MessageCircle,
  leads: Users,
  reservations: CalendarCheck,
  response: Timer
};

export function KpiCard({ label, value, delta, series, icon }: KpiCardProps) {
  const Icon = iconMap[icon];
  const isPositive = delta !== null && delta >= 0;
  const safeSeries = series ?? [];
  const hasSeries = safeSeries.some((point) => point > 0);
  const chartData = safeSeries.map((point, index) => ({ index, value: point }));

  return (
    <Card className="min-w-0 rounded-[1.6rem] p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs text-white/70">
          <span className="dashboard-chip flex h-9 w-9 items-center justify-center rounded-xl">
            <Icon className="h-4 w-4" />
          </span>
          <span className="uppercase tracking-[0.2em] text-white/45">{label}</span>
        </div>
        <span
          className={`flex items-center gap-1 text-[11px] ${
            delta === null ? "text-white/40" : isPositive ? "text-emerald-300" : "text-rose-300"
          }`}
        >
          {delta !== null ? (isPositive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />) : null}
          {formatDelta(delta)}
        </span>
      </div>
      <p className="dashboard-heading mt-3 text-3xl font-semibold text-white">{formatNumber(value)}</p>
      <div className="relative mt-3 h-10 w-full min-w-0">
        <SafeChartContainer className={`h-10 ${hasSeries ? "" : "opacity-0"}`}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <Line
                type="monotone"
                dataKey="value"
                stroke="#f1c451"
                strokeWidth={2}
                dot={false}
                isAnimationActive={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </SafeChartContainer>
        {!hasSeries ? <div className="absolute inset-0 rounded-full bg-white/5" /> : null}
      </div>
    </Card>
  );
}

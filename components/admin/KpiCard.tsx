"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Line, LineChart, ResponsiveContainer } from "recharts";
import { GlassCard } from "@/components/admin/GlassCard";

type KpiCardProps = {
  label: string;
  value: number;
  displayValue: string;
  delta: number | null;
  series: number[];
};

function useCountUp(target: number, durationMs = 420) {
  const [value, setValue] = useState(target);
  const previousTargetRef = useRef(target);

  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const from = previousTargetRef.current;
    previousTargetRef.current = target;

    const tick = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(1, elapsed / durationMs);
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(from + (target - from) * eased);
      if (progress < 1) {
        raf = requestAnimationFrame(tick);
      }
    };

    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [durationMs, target]);

  return value;
}

const formatDelta = (value: number | null) => {
  if (value === null || Number.isNaN(value)) return "n/a";
  const rounded = Math.round(value * 10) / 10;
  if (rounded === 0) return "0%";
  return `${rounded > 0 ? "+" : ""}${rounded}%`;
};

const parseDisplay = (displayValue: string, fallback: number) => {
  const hasCurrency = displayValue.includes("$") || displayValue.includes("€");
  const hasPercent = displayValue.includes("%");

  if (hasCurrency || hasPercent) {
    return displayValue;
  }

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: fallback % 1 === 0 ? 0 : 2
  }).format(fallback);
};

export function KpiCard({ label, value, displayValue, delta, series }: KpiCardProps) {
  const animated = useCountUp(value);
  const safeSeries = useMemo(
    () => series.map((point, index) => ({ index, value: Number(point.toFixed(2)) })),
    [series]
  );

  const isPositive = delta !== null ? delta >= 0 : true;

  return (
    <GlassCard accent={isPositive ? "green" : "danger"} className="min-h-[170px]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/45">{label}</p>
          <p className="mt-2 text-3xl font-semibold text-[var(--adm-text)]">{parseDisplay(displayValue, animated)}</p>
        </div>
        <div
          className={`inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs ${
            delta === null
              ? "border border-white/15 bg-white/[0.04] text-white/50"
              : isPositive
                ? "border border-emerald-400/20 bg-emerald-500/12 text-emerald-200"
                : "border border-rose-400/20 bg-rose-500/12 text-rose-200"
          }`}
        >
          {delta !== null ? isPositive ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" /> : null}
          {formatDelta(delta)}
        </div>
      </div>

      <div className="mt-5 h-12">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={safeSeries}>
            <Line
              type="monotone"
              dataKey="value"
              stroke={isPositive ? "#55FF95" : "#FF5D7A"}
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </GlassCard>
  );
}

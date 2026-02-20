"use client";

import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Sparkline } from "@/components/analytics/website/Sparkline";

const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);

export function OverviewCard({
  label,
  value,
  deltaPct,
  series,
  ringPercent
}: {
  label: string;
  value: number;
  deltaPct: number;
  series?: number[];
  ringPercent?: number;
}) {
  const isPositive = deltaPct >= 0;
  const deltaLabel = `${isPositive ? "+" : ""}${deltaPct}%`;
  const ringValue = ringPercent !== undefined ? Math.max(0, Math.min(100, Math.round(ringPercent))) : null;
  const ringRadius = 18;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const ringOffset = ringValue !== null ? ringCircumference * (1 - ringValue / 100) : ringCircumference;

  return (
    <Card className="rounded-3xl border border-white/10 bg-white/5 p-5 shadow-[0_15px_50px_rgba(15,23,42,0.35)]">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">{label}</p>
        </div>
        <Badge
          className={
            isPositive
              ? "border-emerald-400/40 bg-emerald-500/20 text-emerald-100"
              : "border-rose-400/40 bg-rose-500/20 text-rose-100"
          }
        >
          <span className="flex items-center gap-1 text-xs font-semibold">
            {isPositive ? <ArrowUpRight className="h-3 w-3" /> : <ArrowDownRight className="h-3 w-3" />}
            {deltaLabel}
          </span>
        </Badge>
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-3xl font-semibold text-white">{formatNumber(value)}</p>
        {ringValue !== null ? (
          <div className="relative h-12 w-12 text-cyan-200/80">
            <svg viewBox="0 0 48 48" className="h-12 w-12">
              <circle cx="24" cy="24" r={ringRadius} stroke="rgba(255,255,255,0.08)" strokeWidth="6" fill="none" />
              <circle
                cx="24"
                cy="24"
                r={ringRadius}
                stroke="currentColor"
                strokeWidth="6"
                fill="none"
                strokeLinecap="round"
                strokeDasharray={ringCircumference}
                strokeDashoffset={ringOffset}
                transform="rotate(-90 24 24)"
              />
            </svg>
            <span className="absolute inset-0 flex items-center justify-center text-[10px] font-semibold text-white/70">
              {ringValue}%
            </span>
          </div>
        ) : null}
      </div>
      <div className="mt-3 flex items-end justify-between gap-3">
        <p className="text-xs text-white/50">vs previous period</p>
        {series ? <Sparkline data={series} variant="area" className="h-10 w-24 text-sky-300/70" /> : null}
      </div>
    </Card>
  );
}

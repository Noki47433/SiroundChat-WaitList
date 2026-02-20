"use client";

import { Card } from "@/components/ui/card";

const formatNumber = (value: number) => new Intl.NumberFormat("en-US").format(value);

export function ChannelSplitCard({
  title,
  primaryLabel,
  primaryValue,
  secondaryLabel,
  secondaryValue
}: {
  title: string;
  primaryLabel: string;
  primaryValue: number;
  secondaryLabel: string;
  secondaryValue: number;
}) {
  const total = primaryValue + secondaryValue;
  const primaryPct = total > 0 ? Math.round((primaryValue / total) * 100) : 0;
  const secondaryPct = total > 0 ? 100 - primaryPct : 0;

  return (
    <Card className="rounded-3xl border border-white/10 bg-white/5 p-5">
      <div className="space-y-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/50">{title}</p>
          <p className="mt-2 text-2xl font-semibold text-white">{formatNumber(total)}</p>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs text-white/60">
            <span>{primaryLabel}</span>
            <span>{formatNumber(primaryValue)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-cyan-400" style={{ width: `${primaryPct}%` }} />
          </div>
          <div className="flex items-center justify-between text-xs text-white/50">
            <span>{secondaryLabel}</span>
            <span>{formatNumber(secondaryValue)}</span>
          </div>
          <div className="h-2 w-full overflow-hidden rounded-full bg-white/10">
            <div className="h-full rounded-full bg-slate-500/70" style={{ width: `${secondaryPct}%` }} />
          </div>
        </div>
      </div>
    </Card>
  );
}

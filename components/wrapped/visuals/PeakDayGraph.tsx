"use client";

import { cn } from "@/lib/utils/cn";
import type { Period } from "@/lib/wrapped/computeWrapped";

const seeded = (seed: number) => {
  let value = seed % 2147483647;
  return () => {
    value = (value * 1103515245 + 12345) % 2147483647;
    return value / 2147483647;
  };
};

export function PeakDayGraph({
  period,
  peakLeads,
  peakIndex,
  animate,
  className
}: {
  period: Period;
  peakLeads: number;
  peakIndex: number;
  animate: boolean;
  className?: string;
}) {
  const count = period === "weekly" ? 7 : 9;
  const rand = seeded(peakLeads * 37 + count * 11);
  const bars = Array.from({ length: count }).map((_, index) => {
    if (index === peakIndex) return peakLeads;
    return Math.max(1, Math.round(peakLeads * (0.4 + rand() * 0.4)));
  });
  const max = Math.max(...bars);

  const width = 520;
  const height = 140;
  const gap = 16;
  const barWidth = (width - gap * (count + 1)) / count;

  const linePoints = bars.map((value, index) => {
    const x = gap + index * (barWidth + gap) + barWidth / 2;
    const y = height - 20 - (value / max) * 90;
    return { x, y };
  });

  const linePath = linePoints
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");

  return (
    <div className={cn("w-full max-w-[560px]", className)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[140px] w-full" aria-hidden="true">
        <path
          d={linePath}
          fill="none"
          stroke="var(--glow)"
          strokeWidth="2"
          strokeLinecap="round"
          pathLength={1}
          style={{
            strokeDasharray: 1,
            strokeDashoffset: 0,
            animation: animate ? "wrapped-draw 520ms ease-out forwards" : "none"
          }}
        />
        {bars.map((value, index) => {
          const barHeight = (value / max) * 90;
          const x = gap + index * (barWidth + gap);
          const y = height - 20 - barHeight;
          const isPeak = index === peakIndex;
          return (
            <rect
              key={index}
              x={x}
              y={y}
              width={barWidth}
              height={Math.max(barHeight, 6)}
              rx={6}
              fill={isPeak ? "var(--accent)" : "rgba(255,255,255,0.12)"}
              style={{
                transformOrigin: `${x + barWidth / 2}px ${height - 20}px`,
                animation: animate ? `wrapped-grow 500ms ease-out ${index * 0.05}s forwards` : "none",
                filter: isPeak ? "drop-shadow(0 0 12px rgba(255,213,74,0.4))" : "none"
              }}
            />
          );
        })}
      </svg>
    </div>
  );
}

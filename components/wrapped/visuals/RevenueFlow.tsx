"use client";

import { cn } from "@/lib/utils/cn";
import type { Period } from "@/lib/wrapped/computeWrapped";

const seeded = (seed: number) => {
  let value = seed % 2147483647;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
};

const buildSeries = (valueCents: number, period: Period) => {
  const points = period === "weekly" ? 7 : 10;
  const total = Math.max(valueCents / 100, 1);
  const rand = seeded(Math.round(total * 17 + points * 31));
  const series: number[] = [];
  let current = total * 0.35;

  for (let i = 0; i < points; i += 1) {
    const trend = i / Math.max(points - 1, 1);
    const bump = 0.08 + rand() * 0.12;
    current = Math.max(current + total * bump * trend, total * (0.35 + trend * 0.6));
    series.push(Math.min(current, total * (0.98 + rand() * 0.05)));
  }
  series[series.length - 1] = total;
  return series;
};

export function RevenueFlow({
  valueCents,
  period,
  animate,
  className
}: {
  valueCents: number;
  period: Period;
  animate: boolean;
  className?: string;
}) {
  const values = buildSeries(valueCents, period);
  const width = 520;
  const height = 140;
  const padding = 16;
  const maxValue = Math.max(...values);
  const minValue = Math.min(...values);

  const points = values.map((value, index) => {
    const x = padding + (index / Math.max(values.length - 1, 1)) * (width - padding * 2);
    const normalized = maxValue === minValue ? 0.5 : (value - minValue) / (maxValue - minValue);
    const y = height - padding - normalized * (height - padding * 2);
    return { x, y };
  });

  const path = points
    .map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)} ${point.y.toFixed(1)}`)
    .join(" ");

  const endPoint = points[points.length - 1];

  return (
    <div className={cn("w-full max-w-[560px]", className)}>
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[140px] w-full" aria-hidden="true">
        <defs>
          <linearGradient id="revenueGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--glow)" />
          </linearGradient>
        </defs>
        <path
          d={path}
          fill="none"
          stroke="url(#revenueGradient)"
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
          pathLength={1}
          style={{
            strokeDasharray: 1,
            strokeDashoffset: 0,
            animation: animate ? "wrapped-draw 600ms ease-out forwards" : "none"
          }}
        />
        <circle
          cx={endPoint.x}
          cy={endPoint.y}
          r="5"
          fill="var(--accent)"
          style={{
            opacity: animate ? 1 : 0.9,
            transition: animate ? "opacity 400ms ease-out 480ms" : "none"
          }}
        />
        <circle
          cx={endPoint.x}
          cy={endPoint.y}
          r="10"
          fill="var(--accent)"
          opacity="0.2"
        />

        {[
          { dx: -18, dy: -20, delay: 0.2 },
          { dx: 12, dy: -26, delay: 0.3 },
          { dx: -6, dy: -34, delay: 0.38 }
        ].map((particle, index) => (
          <text
            key={index}
            x={endPoint.x + particle.dx}
            y={endPoint.y + particle.dy}
            fontSize="12"
            fill="var(--glow)"
            style={{
              opacity: animate ? 0 : 0.7,
              animation: animate ? `wrapped-fade-up 600ms ease-out ${particle.delay}s forwards` : "none"
            }}
          >
            €
          </text>
        ))}
      </svg>
    </div>
  );
}

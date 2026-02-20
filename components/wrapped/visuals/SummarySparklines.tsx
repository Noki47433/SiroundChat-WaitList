"use client";

import { cn } from "@/lib/utils/cn";

const sparklinePath = (width: number, height: number, points: number[]) => {
  return points
    .map((value, index) => {
      const x = (index / Math.max(points.length - 1, 1)) * width;
      const y = height - value * height;
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
};

export function SummarySparklines({ animate, className }: { animate: boolean; className?: string }) {
  const width = 120;
  const height = 40;
  const series = [
    [0.2, 0.25, 0.4, 0.5, 0.7, 0.85],
    [0.1, 0.3, 0.25, 0.55, 0.6, 0.8],
    [0.15, 0.2, 0.35, 0.45, 0.55, 0.7],
    [0.2, 0.28, 0.42, 0.6, 0.75, 0.9]
  ];

  return (
    <div className={cn("relative flex items-center justify-center gap-4", className)}>
      {series.map((points, index) => (
        <svg
          key={index}
          viewBox={`0 0 ${width} ${height}`}
          className="h-10 w-[120px]"
          aria-hidden="true"
        >
          <path
            d={sparklinePath(width, height, points)}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinecap="round"
            pathLength={1}
            style={{
              opacity: 0.6 + index * 0.1,
              strokeDasharray: 1,
              strokeDashoffset: 0,
              animation: animate ? "wrapped-draw 520ms ease-out forwards" : "none"
            }}
          />
        </svg>
      ))}
      {[
        { left: "38%", top: "-6px", delay: 0.3 },
        { left: "50%", top: "-12px", delay: 0.36 },
        { left: "62%", top: "-4px", delay: 0.42 }
      ].map((dot, index) => (
        <span
          key={index}
          className="absolute h-1.5 w-1.5 rounded-full bg-white/50"
          style={{
            left: dot.left,
            top: dot.top,
            opacity: animate ? 0 : 0.6,
            animation: animate ? `wrapped-fade-up 520ms ease-out ${dot.delay}s forwards` : "none"
          }}
        />
      ))}
    </div>
  );
}

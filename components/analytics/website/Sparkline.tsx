"use client";

import { useId, useMemo } from "react";
import { cn } from "@/lib/utils/cn";

type SparklineProps = {
  data: number[];
  variant?: "line" | "area";
  className?: string;
};

export function Sparkline({ data, variant = "area", className }: SparklineProps) {
  const id = useId();
  const width = 120;
  const height = 40;

  const { linePath, areaPath } = useMemo(() => {
    const values = data.length ? data : [0, 0];
    const max = Math.max(...values);
    const min = Math.min(...values);
    const range = max - min || 1;
    const points = values.map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = range === 0 ? height / 2 : height - ((value - min) / range) * height;
      return [x, y] as const;
    });

    const path = points.map((point, index) => `${index === 0 ? "M" : "L"} ${point[0]} ${point[1]}`).join(" ");
    const area = `${path} L ${width} ${height} L 0 ${height} Z`;
    return { linePath: path, areaPath: area };
  }, [data]);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={cn("text-sky-300/70", className)}
      role="img"
      aria-label="Trend"
    >
      <defs>
        <linearGradient id={`spark-${id}`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0%" stopColor="currentColor" stopOpacity={0.5} />
          <stop offset="100%" stopColor="currentColor" stopOpacity={0} />
        </linearGradient>
      </defs>
      {variant === "area" ? <path d={areaPath} fill={`url(#spark-${id})`} /> : null}
      <path d={linePath} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

"use client";

import { useEffect, useState } from "react";
import { cn } from "@/lib/utils/cn";

export function GoalTrack({
  progress,
  animate,
  className
}: {
  progress: number;
  animate: boolean;
  className?: string;
}) {
  const clamped = Math.min(Math.max(progress, 0), 1);
  const [current, setCurrent] = useState(animate ? 0 : clamped);

  useEffect(() => {
    if (!animate) {
      setCurrent(clamped);
      return;
    }
    const frame = requestAnimationFrame(() => setCurrent(clamped));
    return () => cancelAnimationFrame(frame);
  }, [animate, clamped]);

  return (
    <div className={cn("w-full max-w-[520px]", className)}>
      <div className="relative h-3 w-full rounded-full bg-white/10">
        <div
          className="absolute top-0 h-3 rounded-full bg-[var(--glow)]/30"
          style={{ width: `${current * 100}%`, transition: animate ? "width 520ms ease-out" : "none" }}
        />
        <div
          className="absolute top-1/2 h-4 w-4 -translate-y-1/2 rounded-full bg-[var(--glow)] shadow-[0_0_12px_rgba(86,252,162,0.4)]"
          style={{
            left: `calc(${current * 100}% - 8px)`,
            transition: animate ? "left 520ms ease-out" : "none"
          }}
        />
        <div
          className="absolute top-1/2 h-3 w-3 -translate-y-1/2 rounded-full border border-[var(--accent)]"
          style={{ left: "calc(80% - 6px)" }}
        />
      </div>
    </div>
  );
}

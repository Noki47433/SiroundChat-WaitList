"use client";

import { useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils/cn";

const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), max);

export function TimeSavedRing({
  minutes,
  animate,
  className
}: {
  minutes: number;
  animate: boolean;
  className?: string;
}) {
  const radius = 44;
  const circumference = 2 * Math.PI * radius;
  const targetProgress = clamp(minutes / 240, 0.1, 1);
  const [progress, setProgress] = useState(animate ? 0 : targetProgress);

  useEffect(() => {
    if (!animate) {
      setProgress(targetProgress);
      return;
    }
    const frame = requestAnimationFrame(() => setProgress(targetProgress));
    return () => cancelAnimationFrame(frame);
  }, [animate, targetProgress]);

  const dashOffset = useMemo(() => circumference * (1 - progress), [circumference, progress]);

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <svg width="120" height="120" viewBox="0 0 120 120" aria-hidden="true">
        <defs>
          <linearGradient id="timeRing" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="var(--glow)" />
            <stop offset="100%" stopColor="var(--accent)" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r={radius} stroke="rgba(255,255,255,0.12)" strokeWidth="8" fill="none" />
        <circle
          cx="60"
          cy="60"
          r={radius}
          stroke="url(#timeRing)"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          style={{
            transition: animate ? "stroke-dashoffset 550ms ease-out" : "none",
            filter: progress > 0.9 ? "drop-shadow(0 0 8px rgba(86,252,162,0.35))" : "none"
          }}
          transform="rotate(-90 60 60)"
        />
      </svg>
      <p className="text-[11px] uppercase tracking-[0.2em] text-white/50">AI resolving chats…</p>
    </div>
  );
}

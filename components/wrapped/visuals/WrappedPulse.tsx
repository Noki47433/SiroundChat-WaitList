"use client";

import { cn } from "@/lib/utils/cn";

export function WrappedPulse({
  animate,
  className
}: {
  animate: boolean;
  className?: string;
}) {
  return (
    <div className={cn("w-full max-w-[520px]", className)}>
      <svg viewBox="0 0 520 120" className="h-[120px] w-full" aria-hidden="true">
        <defs>
          <linearGradient id="pulseGradient" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stopColor="var(--accent)" />
            <stop offset="100%" stopColor="var(--glow)" />
          </linearGradient>
        </defs>
        <path
          d="M0 60 H60 L90 40 L120 80 L150 60 H220 L250 30 L280 90 L310 60 H520"
          fill="none"
          stroke="url(#pulseGradient)"
          strokeWidth="2.5"
          strokeLinecap="round"
          pathLength={1}
          style={{
            opacity: 0.25,
            strokeDasharray: 1,
            strokeDashoffset: 0,
            animation: animate ? "wrapped-draw 520ms ease-out forwards" : "none"
          }}
        />
      </svg>
    </div>
  );
}

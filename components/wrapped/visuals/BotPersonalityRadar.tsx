"use client";

import { cn } from "@/lib/utils/cn";

const polarPoint = (angle: number, radius: number, center: number) => {
  const x = center + radius * Math.cos(angle);
  const y = center + radius * Math.sin(angle);
  return { x, y };
};

export function BotPersonalityRadar({
  conversion,
  engagement,
  autonomy,
  animate,
  className
}: {
  conversion: number;
  engagement: number;
  autonomy: number;
  animate: boolean;
  className?: string;
}) {
  const size = 180;
  const center = size / 2;
  const maxRadius = 60;
  const angles = [-Math.PI / 2, (Math.PI * 1) / 6, (Math.PI * 5) / 6];
  const values = [conversion, engagement, autonomy];

  const points = values.map((value, index) => polarPoint(angles[index], maxRadius * value, center));
  const shape = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x} ${point.y}`).join(" ") + " Z";

  return (
    <div className={cn("flex items-center justify-center", className)}>
      <svg viewBox={`0 0 ${size} ${size}`} className="h-[160px] w-[160px]" aria-hidden="true">
        <polygon
          points={angles
            .map((angle) => {
              const point = polarPoint(angle, maxRadius, center);
              return `${point.x},${point.y}`;
            })
            .join(" ")}
          fill="none"
          stroke="rgba(255,255,255,0.12)"
          strokeWidth="1"
        />
        <polygon
          points={angles
            .map((angle) => {
              const point = polarPoint(angle, maxRadius * 0.6, center);
              return `${point.x},${point.y}`;
            })
            .join(" ")}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="1"
        />
        <path
          d={shape}
          fill="var(--glow)"
          opacity="0.2"
          style={{
            transformOrigin: "50% 50%",
            animation: animate ? "wrapped-pop 520ms ease-out forwards" : "none"
          }}
        />
        <path
          d={shape}
          fill="none"
          stroke="var(--accent)"
          strokeWidth="2"
          style={{
            transformOrigin: "50% 50%",
            animation: animate ? "wrapped-pop 520ms ease-out forwards" : "none"
          }}
        />
      </svg>
    </div>
  );
}

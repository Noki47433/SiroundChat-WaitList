"use client";

import { cn } from "@/lib/utils/cn";
import type { Period } from "@/lib/wrapped/computeWrapped";

const seeded = (seed: number) => {
  let value = seed % 2147483647;
  return () => {
    value = (value * 48271) % 2147483647;
    return (value - 1) / 2147483646;
  };
};

const buildBars = (leads: number, reservations: number, period: Period) => {
  const points = period === "weekly" ? 7 : 9;
  const rand = seeded(leads * 17 + reservations * 29 + points * 41);
  const leadBase = Math.max(Math.round(leads / points), 1);
  const reservationBase = Math.max(Math.round(reservations / points), 1);
  const bars = Array.from({ length: points }).map(() => {
    const lead = Math.max(1, Math.round(leadBase + rand() * leadBase));
    const booking = Math.max(0, Math.round(reservationBase + rand() * reservationBase * 0.8));
    return { lead, booking };
  });
  return bars;
};

export function LeadsReservationsBars({
  leads,
  reservations,
  period,
  animate,
  className
}: {
  leads: number;
  reservations: number;
  period: Period;
  animate: boolean;
  className?: string;
}) {
  const bars = buildBars(leads, reservations, period);
  const maxValue = Math.max(...bars.map((item) => item.lead + item.booking));

  return (
    <div className={cn("w-full max-w-[560px]", className)}>
      <div className="flex h-[140px] w-full items-end justify-center gap-3">
        {bars.map((bar, index) => {
          const height = maxValue > 0 ? ((bar.lead + bar.booking) / maxValue) * 120 : 0;
          const leadHeight = (bar.lead / Math.max(bar.lead + bar.booking, 1)) * height;
          const bookingHeight = height - leadHeight;
          const isPeak = bar.lead + bar.booking === maxValue;

          return (
            <div key={index} className="flex w-8 flex-col items-center gap-1">
              <div
                className={cn(
                  "w-3 rounded-full bg-[var(--glow)]/60",
                  isPeak ? "shadow-[0_0_12px_rgba(86,252,162,0.5)]" : ""
                )}
                style={{
                  height: Math.max(leadHeight, 8),
                  transformOrigin: "bottom",
                  transform: "scaleY(1)",
                  animation: animate ? `wrapped-grow 520ms ease-out ${index * 0.06}s forwards` : "none"
                }}
              />
              <div
                className={cn(
                  "w-3 rounded-full bg-[var(--accent)]/70",
                  isPeak ? "shadow-[0_0_12px_rgba(255,213,74,0.5)]" : ""
                )}
                style={{
                  height: Math.max(bookingHeight, 6),
                  transformOrigin: "bottom",
                  transform: "scaleY(1)",
                  animation: animate
                    ? `wrapped-grow 520ms ease-out ${0.12 + index * 0.06}s forwards`
                    : "none"
                }}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}

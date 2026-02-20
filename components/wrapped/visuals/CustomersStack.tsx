"use client";

import { cn } from "@/lib/utils/cn";

export function CustomersStack({
  count,
  animate,
  className
}: {
  count: number;
  animate: boolean;
  className?: string;
}) {
  const visible = Math.min(count, 6);
  const extra = count - visible;

  return (
    <div className={cn("flex flex-col items-center", className)}>
      <div className="relative h-[140px] w-[220px]">
        {Array.from({ length: visible }).map((_, index) => {
          const offset = (visible - index - 1) * 14;
          return (
            <div
              key={index}
              className="absolute left-1/2 h-10 w-[180px] -translate-x-1/2 rounded-2xl border border-white/10 bg-white/5"
              style={{
                bottom: offset,
                animation: animate ? `wrapped-stack 500ms ease-out ${index * 0.08}s forwards` : "none"
              }}
            />
          );
        })}
        {extra > 0 ? (
          <span className="absolute left-1/2 top-2 -translate-x-1/2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[11px] uppercase tracking-[0.2em] text-white/60">
            +{extra} more
          </span>
        ) : null}
      </div>
    </div>
  );
}

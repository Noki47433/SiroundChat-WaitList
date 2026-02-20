import type { ReactNode } from "react";
import { cn } from "@/lib/utils/cn";

const noiseDataUrl =
  "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='120' height='120' viewBox='0 0 120 120'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.8' numOctaves='3' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='120' height='120' filter='url(%23n)' opacity='0.35'/%3E%3C/svg%3E";

export function WrappedSlideFrame({
  children,
  underlay,
  isShareMode,
  className
}: {
  children: ReactNode;
  underlay?: ReactNode;
  isShareMode: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative h-full w-full overflow-hidden rounded-[24px]", className)}>
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(1200px circle at 20% 10%, rgba(255,255,255,0.06), rgba(0,0,0,0) 60%), linear-gradient(180deg, rgba(16,16,18,0.92), rgba(10,10,12,0.92))"
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.08] mix-blend-screen"
        style={{ backgroundImage: `url(\"${noiseDataUrl}\")` }}
      />
      {underlay ? <div className="pointer-events-none absolute inset-0">{underlay}</div> : null}

      <div className="relative z-10 flex h-full w-full items-center justify-center px-7 py-7">
        <div className="flex w-full max-w-[560px] flex-col items-center gap-4 text-center text-white">
          {children}
        </div>
      </div>

      {isShareMode ? (
        <div className="absolute bottom-4 right-6 text-[10px] uppercase tracking-[0.3em] text-white/50">
          SiroundChat
        </div>
      ) : null}
    </div>
  );
}

"use client";

import { WrappedSlideFrame } from "@/components/wrapped/WrappedSlideFrame";
import { UnlockProgress } from "@/components/wrapped/slides/UnlockProgress";
import { useCountUp } from "@/components/wrapped/useCountUp";
import { RevenueFlow } from "@/components/wrapped/visuals/RevenueFlow";
import { formatCurrencyFromCents } from "@/lib/wrapped/format";
import type { SlideProps } from "@/components/wrapped/slides/types";
import { cn } from "@/lib/utils/cn";

export function SlideM02_Revenue({ model, isShareMode, isActive, isDemo, visualAnimate }: SlideProps) {
  const hasRevenue = model.revenueCents !== null || isDemo;
  const active = isActive ?? true;
  const allowAnimate = Boolean(visualAnimate);
  const rawCents = model.revenueCents ?? 0;
  const animatedCents = useCountUp(active ? rawCents : null, {
    enabled: allowAnimate
  });
  const displayCents = active && !allowAnimate ? rawCents : animatedCents;
  const heroLabel = hasRevenue ? formatCurrencyFromCents(Math.round(displayCents)) : "—";
  const delta = model.revenueDeltaPct;

  const deltaLabel = delta !== null ? `${delta > 0 ? "+" : ""}${delta}% vs last month` : null;

  const deltaClass =
    delta === null
      ? "border-white/10 text-white/50"
      : delta >= 0
        ? "border-[var(--glow)]/50 text-[var(--glow)]"
        : "border-white/20 text-white/50";

  const underlay = (
    <>
      <div className="absolute inset-y-1/2 left-[-10%] h-px w-[45%] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="absolute inset-y-[55%] right-[-10%] h-px w-[45%] bg-gradient-to-l from-transparent via-white/20 to-transparent" />
      <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--accent)]/20" />
    </>
  );

  return (
    <WrappedSlideFrame underlay={underlay} isShareMode={isShareMode}>
      <p className="text-xs uppercase tracking-[0.3em] text-white/50">Estimated revenue influenced</p>
      <p className="text-[88px] font-extrabold leading-none">{heroLabel}</p>

      <RevenueFlow
        valueCents={model.revenueCents ?? 0}
        period={model.period}
        animate={Boolean(visualAnimate)}
        className="mt-2"
      />

      {deltaLabel ? (
        <span className={cn("rounded-full border px-3 py-1 text-xs uppercase tracking-[0.2em]", deltaClass)}>
          {deltaLabel}
        </span>
      ) : null}

      {hasRevenue ? (
        <div className="space-y-1 text-base text-white/70">
          <p>{isDemo ? "From leads + bookings your AI captured this month." : "Revenue your AI helped unlock this month."}</p>
          <p>That’s the impact hiding in your chat box.</p>
        </div>
      ) : (
        <div className="space-y-1 text-base text-white/70">
          <p>Your AI needs a few more conversions to estimate revenue.</p>
          <p>Keep it running — this slide unlocks soon 👀</p>
        </div>
      )}

      {!hasRevenue && !isDemo ? <UnlockProgress progress={model.unlockProgress} label="Revenue unlock" /> : null}
    </WrappedSlideFrame>
  );
}

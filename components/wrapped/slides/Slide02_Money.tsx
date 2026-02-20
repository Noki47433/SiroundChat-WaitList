"use client";

import { WrappedSlideFrame } from "@/components/wrapped/WrappedSlideFrame";
import { UnlockProgress } from "@/components/wrapped/slides/UnlockProgress";
import { useCountUp } from "@/components/wrapped/useCountUp";
import { RevenueFlow } from "@/components/wrapped/visuals/RevenueFlow";
import { formatCurrencyFromCents } from "@/lib/wrapped/format";
import type { SlideProps } from "@/components/wrapped/slides/types";

export function Slide02_Money({ model, isShareMode, isActive, isDemo, visualAnimate }: SlideProps) {
  const hasRevenue = model.revenueCents !== null || isDemo;
  const active = isActive ?? true;
  const rawCents = model.revenueCents ?? 0;
  const allowAnimate = Boolean(visualAnimate);
  const animatedCents = useCountUp(active ? rawCents : null, {
    enabled: allowAnimate
  });
  const displayCents = active && !allowAnimate ? rawCents : animatedCents;
  const heroLabel = hasRevenue ? formatCurrencyFromCents(Math.round(displayCents)) : "—";

  const underlay = (
    <>
      <div className="absolute inset-y-1/2 left-[-10%] h-px w-[45%] bg-gradient-to-r from-transparent via-white/20 to-transparent" />
      <div className="absolute inset-y-[55%] right-[-10%] h-px w-[45%] bg-gradient-to-l from-transparent via-white/20 to-transparent" />
      <div className="absolute left-1/2 top-1/2 h-20 w-20 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-white/5" />
      <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--accent)]/20" />

      <div className="absolute left-[22%] top-[35%] h-2 w-2 rounded-full bg-[var(--accent)]/80 shadow-[0_0_12px_rgba(255,213,74,0.6)] motion-safe:animate-[wrapped-float_8s_ease-in-out_infinite] motion-reduce:opacity-0" />
      <div
        className="absolute right-[26%] top-[45%] h-2.5 w-2.5 rounded-full bg-[var(--glow)]/80 shadow-[0_0_12px_rgba(86,252,162,0.6)] motion-safe:animate-[wrapped-float_9s_ease-in-out_infinite] motion-reduce:opacity-0"
        style={{ animationDelay: "1.2s" }}
      />
      <div
        className="absolute left-[45%] top-[65%] h-1.5 w-1.5 rounded-full bg-white/70 shadow-[0_0_10px_rgba(255,255,255,0.4)] motion-safe:animate-[wrapped-float_7s_ease-in-out_infinite] motion-reduce:opacity-0"
        style={{ animationDelay: "0.6s" }}
      />
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

      {hasRevenue ? (
        <div className="space-y-1 text-base text-white/70">
          <p>{isDemo ? "From leads + bookings your AI captured." : "From leads + reservations your AI captured."}</p>
          <p>That’s money you would’ve missed without the widget.</p>
        </div>
      ) : (
        <div className="space-y-1 text-base text-white/70">
          <p>Your AI needs a few more conversions to estimate revenue.</p>
          <p>Keep it running — this slide unlocks soon 👀</p>
        </div>
      )}

      {hasRevenue && model.projectedMonthlyRevenueLabel ? (
        <p className="text-sm font-semibold text-white/70">{model.projectedMonthlyRevenueLabel}</p>
      ) : null}

      {!hasRevenue && !isDemo ? <UnlockProgress progress={model.unlockProgress} label="Revenue unlock" /> : null}
    </WrappedSlideFrame>
  );
}

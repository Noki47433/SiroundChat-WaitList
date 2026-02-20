"use client";

import { WrappedSlideFrame } from "@/components/wrapped/WrappedSlideFrame";
import { UnlockProgress } from "@/components/wrapped/slides/UnlockProgress";
import { useCountUp } from "@/components/wrapped/useCountUp";
import { TimeSavedRing } from "@/components/wrapped/visuals/TimeSavedRing";
import { formatMinutesLabel } from "@/lib/wrapped/format";
import type { SlideProps } from "@/components/wrapped/slides/types";

export function Slide04_TimeSaved({ model, mode, isShareMode, isActive, comparisonLine, isDemo, visualAnimate }: SlideProps) {
  const hasTime = model.timeSavedMinutes !== null || isDemo;
  const active = isActive ?? true;
  const allowAnimate = Boolean(visualAnimate);
  const rawMinutes = model.timeSavedMinutes ?? 0;
  const animatedMinutes = useCountUp(active ? rawMinutes : null, {
    enabled: allowAnimate
  });
  const minutesValue = active && !allowAnimate ? rawMinutes : Math.round(animatedMinutes);
  const monthlyProjection = model.projectedMonthlyTimeSavedLabel;
  const yearlyProjection =
    mode === "monthly" && model.timeSavedMinutes !== null
      ? `At this pace: ~${formatMinutesLabel(model.timeSavedMinutes * 12)}/year saved.`
      : null;
  const extraProjection =
    (model.customersHelped ?? 0) >= 3 && model.timeSavedMinutes !== null
      ? "If your AI resolves 1/day: ~120 minutes/month."
      : null;

  const underlay = (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="h-[320px] w-[320px] rounded-full border border-white/10 opacity-40 motion-safe:animate-[wrapped-spin_22s_linear_infinite]" />
      <div className="absolute h-[240px] w-[240px] rounded-full border border-[var(--glow)]/20 opacity-30" />
    </div>
  );

  return (
    <WrappedSlideFrame underlay={underlay} isShareMode={isShareMode}>
      <p className="text-xs uppercase tracking-[0.3em] text-white/50">Time saved</p>
      <p className="text-[84px] font-extrabold leading-none">{hasTime ? `${minutesValue}m` : "—"}</p>

      <TimeSavedRing minutes={model.timeSavedMinutes ?? 0} animate={Boolean(visualAnimate)} className="mt-1" />

      {hasTime ? (
        <div className="space-y-1 text-base text-white/70">
          <p>Your AI resolved conversations so you didn’t have to.</p>
          <p>That’s time you didn’t spend repeating the same answers.</p>
        </div>
      ) : (
        <div className="space-y-1 text-base text-white/70">
          <p>Your AI needs more resolved chats to estimate time saved.</p>
          <p>Every resolved conversation adds to this total.</p>
        </div>
      )}

      <p className="text-sm font-semibold text-white/60">{comparisonLine ?? "That’s basically one espresso ☕ worth of time."}</p>

      {mode === "weekly" && monthlyProjection ? (
        <p className="text-sm font-semibold text-white/70">{monthlyProjection}</p>
      ) : null}

      {mode === "monthly" && yearlyProjection ? (
        <p className="text-sm font-semibold text-white/70">{yearlyProjection}</p>
      ) : null}

      {extraProjection ? <p className="text-xs text-white/50">{extraProjection}</p> : null}

      {!hasTime && !isDemo ? <UnlockProgress progress={model.unlockProgress} label="Time unlock" /> : null}
    </WrappedSlideFrame>
  );
}

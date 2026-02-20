"use client";

import { WrappedSlideFrame } from "@/components/wrapped/WrappedSlideFrame";
import { WrappedPulse } from "@/components/wrapped/visuals/WrappedPulse";
import type { SlideProps } from "@/components/wrapped/slides/types";

export function SlideM01_Intro({ model, mode, isShareMode, visualAnimate }: SlideProps) {
  const underlay = (
    <div
      className="absolute left-1/2 top-1/2 h-[440px] w-[440px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
      style={{
        background:
          "radial-gradient(circle at 30% 30%, rgba(86,252,162,0.25), rgba(255,213,74,0.15) 50%, rgba(0,0,0,0) 75%)"
      }}
    />
  );

  return (
    <WrappedSlideFrame underlay={underlay} isShareMode={isShareMode}>
      <p className="text-xs uppercase tracking-[0.3em] text-white/50">
        IMPACT WRAPPED — {mode.toUpperCase()}
      </p>
      <h2 className="text-[50px] font-bold leading-[1.05]">✨ Your AI’s Monthly Momentum</h2>
      <WrappedPulse animate={Boolean(visualAnimate)} />
      <div className="space-y-1 text-base text-white/70">
        <p>{model.dateRangeLabel}</p>
        <p>A month of wins, in one hit.</p>
      </div>
      <p className="text-sm font-semibold text-white/60">Let’s see what your bot pulled off.</p>
    </WrappedSlideFrame>
  );
}

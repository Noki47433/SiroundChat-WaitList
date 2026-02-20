"use client";

import { WrappedSlideFrame } from "@/components/wrapped/WrappedSlideFrame";
import type { SlideProps } from "@/components/wrapped/slides/types";
import { WrappedPulse } from "@/components/wrapped/visuals/WrappedPulse";

export function Slide01_Hook({ model, mode, isShareMode, visualAnimate }: SlideProps) {
  const underlay = (
    <>
      <div
        className="absolute left-1/2 top-1/2 h-[420px] w-[420px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
        style={{
          background:
            "radial-gradient(circle at 30% 30%, rgba(255,213,74,0.35), rgba(86,252,162,0.18) 45%, rgba(0,0,0,0) 70%)"
        }}
      />
      <div className="absolute left-1/2 top-1/2 h-[260px] w-[260px] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 opacity-20" />
      <div className="absolute left-1/2 top-[46%] h-[140px] w-[140px] -translate-x-1/2 -translate-y-1/2 rounded-[40px] border border-white/10 opacity-15" />
      <div className="absolute left-1/2 top-[58%] h-16 w-24 -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-white/10 bg-white/5 opacity-20">
        <span className="absolute left-1/2 top-1/2 h-2 w-2 -translate-x-3 -translate-y-1/2 rounded-full bg-white/30" />
        <span className="absolute left-1/2 top-1/2 h-2 w-2 translate-x-3 -translate-y-1/2 rounded-full bg-white/30" />
      </div>
    </>
  );

  return (
    <WrappedSlideFrame underlay={underlay} isShareMode={isShareMode}>
      <p className="text-xs uppercase tracking-[0.3em] text-white/50">
        IMPACT WRAPPED — {mode.toUpperCase()}
      </p>
      <h2 className="text-[48px] font-bold leading-[1.05]">🔥 Your AI’s Weekly Wins</h2>
      <WrappedPulse animate={Boolean(visualAnimate)} />
      <div className="space-y-1 text-base text-white/70">
        <p>{model.dateRangeLabel}</p>
        <p>Your bot worked while you were living your life.</p>
      </div>
      <p className="text-sm font-semibold text-white/60">This gets more insane every week.</p>
    </WrappedSlideFrame>
  );
}

"use client";

import { WrappedSlideFrame } from "@/components/wrapped/WrappedSlideFrame";
import { GoalTrack } from "@/components/wrapped/visuals/GoalTrack";
import type { SlideProps } from "@/components/wrapped/slides/types";

export function SlideM08_NextGoal({ isShareMode, visualAnimate }: SlideProps) {
  const underlay = (
    <div
      className="absolute left-1/2 top-1/2 h-[320px] w-[320px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
      style={{
        background:
          "radial-gradient(circle at 40% 40%, rgba(255,213,74,0.18), rgba(86,252,162,0.08) 50%, rgba(0,0,0,0) 75%)"
      }}
    />
  );

  return (
    <WrappedSlideFrame underlay={underlay} isShareMode={isShareMode}>
      <p className="text-xs uppercase tracking-[0.3em] text-white/50">Next month goal</p>
      <p className="text-[48px] font-bold leading-[1.1]">Increase chat-to-lead rate</p>
      <p className="text-base text-white/70">Tip: Add 2 qualifying questions to lead capture.</p>
      <GoalTrack progress={0.62} animate={Boolean(visualAnimate)} className="mt-2" />
    </WrappedSlideFrame>
  );
}

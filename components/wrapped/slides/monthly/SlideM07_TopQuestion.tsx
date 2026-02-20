"use client";

import { WrappedSlideFrame } from "@/components/wrapped/WrappedSlideFrame";
import { UnlockProgress } from "@/components/wrapped/slides/UnlockProgress";
import { WrappedPulse } from "@/components/wrapped/visuals/WrappedPulse";
import type { SlideProps } from "@/components/wrapped/slides/types";

export function SlideM07_TopQuestion({ model, isShareMode, isDemo, visualAnimate }: SlideProps) {
  const unlocked = (model.unlocks.topQuestionUnlocked && Boolean(model.topQuestion)) || isDemo;

  const underlay = (
    <>
      <div className="absolute left-[18%] top-[25%] h-20 w-20 rounded-2xl border border-white/10 bg-white/5 opacity-40" />
      <div className="absolute right-[22%] top-[35%] h-16 w-16 rounded-2xl border border-white/10 bg-white/5 opacity-30" />
      <div className="absolute left-[40%] bottom-[20%] h-14 w-14 rounded-2xl border border-white/10 bg-white/5 opacity-30" />
    </>
  );

  return (
    <WrappedSlideFrame underlay={underlay} isShareMode={isShareMode}>
      <p className="text-xs uppercase tracking-[0.3em] text-white/50">Top question</p>

      {unlocked ? (
        <>
          <p className="text-[36px] font-semibold leading-snug">“{model.topQuestion}”</p>
          <WrappedPulse animate={Boolean(visualAnimate)} className="mt-2" />
          {model.topIntent ? (
            <p className="text-sm text-white/60">Top intent: {model.topIntent}</p>
          ) : null}
          <p className="text-xs uppercase tracking-[0.25em] text-white/40">Estimated from captured outcomes</p>
        </>
      ) : (
        <>
          <p className="text-[44px] font-bold">🔒 Top question unlocks soon</p>
          <p className="text-base text-white/70">More conversations reveal the questions that drive revenue.</p>
        </>
      )}

      {!unlocked && !isDemo ? <UnlockProgress progress={model.unlockProgress} label="Top question unlock" /> : null}
    </WrappedSlideFrame>
  );
}

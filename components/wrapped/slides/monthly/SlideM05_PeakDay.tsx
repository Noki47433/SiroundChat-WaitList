"use client";

import { WrappedSlideFrame } from "@/components/wrapped/WrappedSlideFrame";
import { UnlockProgress } from "@/components/wrapped/slides/UnlockProgress";
import { PeakDayGraph } from "@/components/wrapped/visuals/PeakDayGraph";
import { formatShortDate } from "@/lib/wrapped/format";
import type { SlideProps } from "@/components/wrapped/slides/types";

export function SlideM05_PeakDay({ model, isShareMode, isDemo, visualAnimate }: SlideProps) {
  const peakDate = formatShortDate(model.peakDayISO);
  const peakLeads = model.peakDayLeads ?? null;
  const leadLabel = peakLeads === 1 ? "lead" : "leads";
  const unlocked = (model.unlocks.peakDayUnlocked && Boolean(peakDate)) || isDemo;
  const day = model.peakDayISO ? new Date(model.peakDayISO).getUTCDate() : 1;
  const peakIndex = Math.min(8, Math.max(0, (day - 1) % 9));

  return (
    <WrappedSlideFrame isShareMode={isShareMode}>
      <p className="text-xs uppercase tracking-[0.3em] text-white/50">📈 Your biggest day</p>

      {unlocked ? (
        <>
          <p className="text-[72px] font-extrabold leading-none">{peakDate}</p>
          <p className="text-base text-white/70">
            {peakLeads ?? 0} {leadLabel} captured
          </p>
          <PeakDayGraph
            period={model.period}
            peakLeads={peakLeads ?? 0}
            peakIndex={peakIndex}
            animate={Boolean(visualAnimate)}
            className="mt-2"
          />
        </>
      ) : (
        <>
          <p className="text-[44px] font-bold">🔒 Peak day unlocks soon</p>
          <p className="text-base text-white/70">Capture a few more leads to reveal your biggest day.</p>
        </>
      )}

      {!unlocked && !isDemo ? <UnlockProgress progress={model.unlockProgress} label="Peak day unlock" /> : null}
    </WrappedSlideFrame>
  );
}

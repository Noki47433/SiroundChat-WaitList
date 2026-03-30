"use client";

import { Handshake } from "lucide-react";
import { WrappedSlideFrame } from "@/components/wrapped/WrappedSlideFrame";
import { UnlockProgress } from "@/components/wrapped/slides/UnlockProgress";
import { useCountUp } from "@/components/wrapped/useCountUp";
import { CustomersStack } from "@/components/wrapped/visuals/CustomersStack";
import type { SlideProps } from "@/components/wrapped/slides/types";

export function Slide05_CustomersHelped({ model, isShareMode, isActive, isDemo, visualAnimate }: SlideProps) {
  const hasHelped = model.customersHelped !== null || isDemo;
  const active = isActive ?? true;
  const allowAnimate = Boolean(visualAnimate);
  const rawHelped = model.customersHelped ?? 0;
  const animatedHelped = useCountUp(active ? rawHelped : null, {
    enabled: allowAnimate
  });
  const helpedValue = active && !allowAnimate ? rawHelped : Math.round(animatedHelped);

  const underlay = (
    <div className="absolute inset-0 flex items-center justify-center">
      <Handshake className="h-[220px] w-[220px] text-white/5" />
    </div>
  );

  return (
    <WrappedSlideFrame underlay={underlay} isShareMode={isShareMode}>
      <p className="text-xs uppercase tracking-[0.3em] text-white/50">Customers helped</p>
      <p className="text-[84px] font-extrabold leading-none">{hasHelped ? helpedValue : "—"}</p>

      <CustomersStack count={helpedValue} animate={Boolean(visualAnimate)} className="mt-1" />

      {hasHelped ? (
        <div className="space-y-1 text-base text-white/70">
          <p>Your AI handled this without a manual handoff.</p>
          <p>That’s a staff member you didn’t have to hire.</p>
        </div>
      ) : (
        <div className="space-y-1 text-base text-white/70">
          <p>Your AI needs more resolved chats to unlock this moment.</p>
          <p>Every resolved chat counts toward this stat.</p>
        </div>
      )}

      <div className="rounded-full border border-white/10 bg-white/5 px-4 py-2 text-xs uppercase tracking-[0.25em] text-white/60">
        Set staff cost to estimate savings
      </div>

      {!hasHelped && !isDemo ? <UnlockProgress progress={model.unlockProgress} label="Helped unlock" /> : null}
    </WrappedSlideFrame>
  );
}

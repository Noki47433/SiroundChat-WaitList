"use client";

import { WrappedSlideFrame } from "@/components/wrapped/WrappedSlideFrame";
import { UnlockProgress } from "@/components/wrapped/slides/UnlockProgress";
import { BotPersonalityRadar } from "@/components/wrapped/visuals/BotPersonalityRadar";
import type { SlideProps } from "@/components/wrapped/slides/types";

const resolvePersonality = (leads: number, reservations: number, helped: number) => {
  if (reservations >= 2) {
    return { title: "THE CLOSER 😈", description: "Turns chats into bookings with confidence." };
  }
  if (leads >= 5) {
    return { title: "THE LEAD MAGNET 🧲", description: "Pulls in curious customers and locks in contact info." };
  }
  if (helped >= 5) {
    return { title: "THE SUPPORT NINJA 🥷", description: "Resolves questions before they ever reach your team." };
  }
  return { title: "THE GREETER 👋", description: "Welcomes everyone and keeps the flow smooth." };
};

export function SlideM06_Personality({ model, isShareMode, isDemo, visualAnimate }: SlideProps) {
  const unlocked = model.unlocks.personalityUnlocked || isDemo;
  const leads = model.leads ?? 0;
  const reservations = model.reservations ?? 0;
  const helped = model.customersHelped ?? 0;
  const personality = resolvePersonality(leads, reservations, helped);
  const conversion = Math.min((reservations + leads * 0.3) / 10, 1);
  const engagement = Math.min(leads / 10, 1);
  const autonomy = Math.min(helped / 10, 1);

  const underlay = (
    <div
      className="absolute left-1/2 top-1/2 h-[360px] w-[360px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-3xl"
      style={{
        background:
          "radial-gradient(circle at 30% 30%, rgba(255,213,74,0.2), rgba(86,252,162,0.12) 50%, rgba(0,0,0,0) 75%)"
      }}
    />
  );

  return (
    <WrappedSlideFrame underlay={underlay} isShareMode={isShareMode}>
      <p className="text-xs uppercase tracking-[0.3em] text-white/50">Your AI personality</p>

      {unlocked ? (
        <>
          <p className="text-[64px] font-extrabold leading-none">{personality.title}</p>
          <p className="text-base text-white/70">This month your bot acted like: {personality.description}</p>
          <BotPersonalityRadar
            conversion={conversion}
            engagement={engagement}
            autonomy={autonomy}
            animate={Boolean(visualAnimate)}
            className="mt-2"
          />
        </>
      ) : (
        <>
          <p className="text-[44px] font-bold">🔒 Personality unlocks soon</p>
          <p className="text-base text-white/70">Keep capturing more chats to reveal your AI vibe.</p>
        </>
      )}

      {!unlocked && !isDemo ? <UnlockProgress progress={model.unlockProgress} label="Personality unlock" /> : null}
    </WrappedSlideFrame>
  );
}

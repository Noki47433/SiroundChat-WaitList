"use client";

import { WrappedSlideFrame } from "@/components/wrapped/WrappedSlideFrame";
import { UnlockProgress } from "@/components/wrapped/slides/UnlockProgress";
import { ChatReplayMini } from "@/components/wrapped/visuals/ChatReplayMini";
import type { SlideProps } from "@/components/wrapped/slides/types";

export function Slide06_MVPChat({ model, isShareMode, isDemo, visualAnimate }: SlideProps) {
  const convo = model.mvpConversation ?? null;
  const unlocked = Boolean(convo) || isDemo;

  const underlay = (
    <>
      <div className="absolute left-[20%] top-[20%] h-20 w-20 rounded-2xl border border-white/10 bg-white/5 opacity-40" />
      <div className="absolute right-[18%] top-[32%] h-16 w-16 rounded-2xl border border-white/10 bg-white/5 opacity-30" />
      <div className="absolute left-[35%] bottom-[20%] h-14 w-14 rounded-2xl border border-white/10 bg-white/5 opacity-30" />
    </>
  );

  return (
    <WrappedSlideFrame underlay={underlay} isShareMode={isShareMode}>
      <p className="text-xs uppercase tracking-[0.3em] text-white/50">Your MVP chat</p>
      <h2 className="text-[40px] font-bold">⭐ Your MVP chat</h2>

      {unlocked && convo ? (
        <div className="w-full rounded-2xl border border-white/10 bg-white/5 p-4">
          <ChatReplayMini
            customerLine={convo.customerQuestion}
            botLine={convo.botResponse}
            outcomeLabel={convo.outcomeLabel}
            animate={Boolean(visualAnimate)}
          />
        </div>
      ) : (
        <div className="space-y-2 text-base text-white/70">
          <p className="text-[40px]">🔒 This unlocks soon</p>
          <p>Your AI needs a few more successful chats.</p>
        </div>
      )}

      {!unlocked && !isDemo ? <UnlockProgress progress={model.unlockProgress} label="MVP chat unlock" /> : null}
    </WrappedSlideFrame>
  );
}

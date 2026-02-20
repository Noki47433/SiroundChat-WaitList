"use client";

import { cn } from "@/lib/utils/cn";

type ChatReplayMiniProps = {
  customerLine: string;
  botLine: string;
  outcomeLabel: string;
  animate: boolean;
  className?: string;
};

export function ChatReplayMini({
  customerLine,
  botLine,
  outcomeLabel,
  animate,
  className
}: ChatReplayMiniProps) {
  const items = [
    { text: customerLine, tone: "customer" },
    { text: botLine, tone: "bot" },
    { text: outcomeLabel, tone: "outcome" }
  ];

  return (
    <div className={cn("w-full max-w-[360px]", className)}>
      <div className="flex flex-col gap-2">
        {items.map((item, index) => (
          <div
            key={index}
            className={cn(
              "rounded-2xl px-3 py-2 text-xs",
              item.tone === "customer"
                ? "self-start bg-white/10 text-white"
                : item.tone === "bot"
                  ? "self-end bg-[var(--glow)]/15 text-[var(--glow)]"
                  : "self-center border border-[var(--accent)]/40 bg-[var(--accent)]/10 text-[var(--accent)]"
            )}
            style={{
              opacity: 1,
              animation: animate ? `wrapped-fade-in 480ms ease-out ${index * 0.16}s forwards` : "none"
            }}
          >
            {item.text}
          </div>
        ))}
      </div>
    </div>
  );
}

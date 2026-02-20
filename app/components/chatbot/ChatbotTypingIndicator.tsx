// Summary: Secondary typing indicator animation used in the chat preview.
'use client';

import { motion } from "framer-motion";
import { ThemeConfig } from "./chatbotTypes";

type ChatbotTypingIndicatorProps = {
  theme: ThemeConfig;
};

export function ChatbotTypingIndicator({ theme }: ChatbotTypingIndicatorProps) {
  const dots = [0, 1, 2];
  return (
    <div
      className="inline-flex items-center gap-2 rounded-full px-3 py-1 backdrop-blur"
      style={{
        backgroundColor: `${theme.primaryColor}22`,
        color: theme.textColor
      }}
    >
      <span className="text-xs" style={{ color: theme.textColor || "#e2e8f0" }}>
        Bot is typing
      </span>
      <div className="flex gap-1">
        {dots.map((index) => (
          <motion.span
            key={index}
            className="h-1.5 w-1.5 rounded-full"
            style={{ backgroundColor: theme.accentColor || theme.primaryColor }}
            animate={{ y: [0, -4, 0] }}
            transition={{ repeat: Infinity, repeatType: "loop", duration: 0.9, delay: index * 0.15, ease: "easeInOut" }}
          />
        ))}
      </div>
    </div>
  );
}

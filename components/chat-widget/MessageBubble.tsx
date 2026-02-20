import type { ConversationSender } from "@/lib/types/core";

interface MessageBubbleProps {
  sender: ConversationSender;
  text: string;
  primaryColor?: string;
  textColor?: string;
}

export function MessageBubble({ sender, text, primaryColor = "#00A3FF", textColor = "#0f172a" }: MessageBubbleProps) {
  const isUser = sender === "user";
  return (
    <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
      <div
        className={`max-w-[280px] rounded-2xl px-4 py-2 text-sm ${
          isUser ? "text-white" : "bg-white"
        }`}
        style={
          isUser
            ? { background: primaryColor }
            : {
                color: textColor
              }
        }
      >
        {text}
      </div>
    </div>
  );
}

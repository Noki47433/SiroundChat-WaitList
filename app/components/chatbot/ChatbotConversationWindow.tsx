'use client';
// Summary: Core chat UI used in builder preview; handles demo playback, typing state, and simple FAQ-based replies.

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChatbotConfig } from "./chatbotTypes";
import { ChatbotTypingIndicator } from "./ChatbotTypingIndicator";
import { findBestFaqMatch, getFallbackResponse } from "./ChatbotDemoEngine";

type ChatMessage = {
  id: string;
  sender: "user" | "bot";
  text: string;
};

type ChatbotConversationWindowProps = {
  config: ChatbotConfig;
  interactive?: boolean;
  autoPlayDemo?: boolean;
};

export function ChatbotConversationWindow({ config, interactive = true, autoPlayDemo = false }: ChatbotConversationWindowProps) {
  // Chat state; clearing or mismanaging this breaks the preview transcript.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const timeoutsRef = useRef<number[]>([]);
  const listRef = useRef<HTMLDivElement | null>(null);

  const bubbleBase = "max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm border";

  const addMessage = (message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  };

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((id) => window.clearTimeout(id));
      timeoutsRef.current = [];
    };
  }, []);

  useEffect(() => {
    if (autoPlayDemo) {
      // Demo script seeds canned Q&A to show movement without user input.
      timeoutsRef.current.forEach((id) => window.clearTimeout(id));
      setMessages([]);
      setIsTyping(false);

      const steps: Array<() => void> = [
        () =>
          addMessage({
            id: "greeting",
            sender: "bot",
            text: config.greeting
          }),
        () =>
          addMessage({
            id: "user-1",
            sender: "user",
            text: "Do you take reservations?"
          }),
        () => setIsTyping(true),
        () => {
          setIsTyping(false);
          addMessage({
            id: "bot-1",
            sender: "bot",
            text: "Yes, you can reserve a table anytime using our booking form or by calling us."
          });
        },
        () =>
          addMessage({
            id: "user-2",
            sender: "user",
            text: "Do you have Wi-Fi?"
          }),
        () => setIsTyping(true),
        () => {
          setIsTyping(false);
          addMessage({
            id: "bot-2",
            sender: "bot",
            text: "Yes, we offer free Wi-Fi for all guests."
          });
        }
      ];

      const delays = [0, 900, 1400, 2200, 3200, 3700, 4500];

      steps.forEach((fn, index) => {
        const id = window.setTimeout(fn, delays[index]);
        timeoutsRef.current.push(id);
      });

      return () => {
        timeoutsRef.current.forEach((id) => window.clearTimeout(id));
        timeoutsRef.current = [];
      };
    }

    // non-demo: reset to greeting when config changes
    setMessages([
      {
        id: `greeting-${config.businessType}`,
        sender: "bot",
        text: config.greeting
      }
    ]);
    setIsTyping(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.greeting, config.businessType, autoPlayDemo]);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  // Sends user message, runs FAQ matcher, then schedules bot reply.
  const handleSend = () => {
    if (!interactive) return;
    const trimmed = input.trim();
    if (!trimmed) return;
    const userMessage: ChatMessage = { id: crypto.randomUUID(), sender: "user", text: trimmed };
    addMessage(userMessage);
    setInput("");
    setIsTyping(true);

    const match = findBestFaqMatch(trimmed, config.faqs);
    const response = match ? match.answer : getFallbackResponse();
    const id = window.setTimeout(() => {
      addMessage({ id: crypto.randomUUID(), sender: "bot", text: response });
      setIsTyping(false);
    }, 900);
    timeoutsRef.current.push(id);
  };

  const bubbleVariants = {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 }
  };

  const themeStyles = useMemo(
    () => ({
      backgroundColor: config.theme.backgroundColor,
      color: config.theme.textColor,
      "--chat-primary": config.theme.primaryColor,
      "--chat-accent": config.theme.accentColor,
      "--chat-bg": config.theme.backgroundColor,
      "--chat-text": config.theme.textColor
    }),
    [config.theme.backgroundColor, config.theme.textColor, config.theme.primaryColor, config.theme.accentColor]
  );

  return (
    <div
      className="flex h-full flex-col rounded-3xl bg-white/5 backdrop-blur"
      style={
        {
          ...themeStyles,
          backgroundImage: `linear-gradient(180deg, ${config.theme.backgroundColor} 0%, ${config.theme.backgroundColor}cc 100%)`
        } as React.CSSProperties
      }
    >
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial="initial"
              animate="animate"
              exit="initial"
              variants={bubbleVariants}
              transition={{ duration: 0.25, ease: "easeOut" }}
              className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`${bubbleBase} ${
                  message.sender === "user"
                    ? "text-white border-transparent"
                    : "bg-white/10 text-[var(--chat-text)] border-white/10"
                }`}
                style={
                  message.sender === "user"
                    ? {
                        backgroundImage: `linear-gradient(135deg, ${config.theme.primaryColor}, ${config.theme.accentColor})`
                      }
                    : undefined
                }
              >
                {message.text}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        {isTyping ? (
          <div className="flex justify-start">
            <ChatbotTypingIndicator theme={config.theme} />
          </div>
        ) : null}
      </div>

      {interactive ? (
        <div className="border-t border-white/10 bg-white/5 px-4 py-3">
          <label className="sr-only" htmlFor="chat-input">
            Send a message
          </label>
          <div className="flex items-center gap-2">
            <input
              id="chat-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && !event.shiftKey) {
                  event.preventDefault();
                  handleSend();
                }
              }}
              className="w-full rounded-full border border-white/20 bg-white/20 px-4 py-3 text-sm placeholder:text-white/70 focus:border-[var(--chat-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--chat-primary)]/60"
              placeholder="Ask a question..."
              style={{
                color: config.theme.textColor || "#ffffff",
                boxShadow: `0 0 0 1px rgba(255,255,255,0.12), 0 10px 30px ${config.theme.primaryColor}33`
              }}
            />
            <motion.button
              type="button"
              onClick={handleSend}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="rounded-full bg-gradient-to-r from-[var(--chat-primary)] to-[var(--chat-accent)] px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-sky-500/30 focus:outline-none focus:ring-2 focus:ring-[var(--chat-primary)] focus:ring-offset-2 focus:ring-offset-slate-900"
              style={{
                backgroundImage: `linear-gradient(135deg, ${config.theme.primaryColor}, ${config.theme.accentColor || config.theme.primaryColor})`
              }}
            >
              Send
            </motion.button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

'use client';
// Summary: Core chat UI used in builder preview; handles demo playback, typing state, and simple FAQ-based replies.

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FormattedChatMessage } from "@/components/chat/FormattedChatMessage";
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

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "").trim();
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}

function clampColor(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function mixColors(baseHex: string, mixHex: string, weight: number) {
  try {
    const base = hexToRgb(baseHex);
    const mix = hexToRgb(mixHex);
    return `rgb(${clampColor(base.r + (mix.r - base.r) * weight)}, ${clampColor(base.g + (mix.g - base.g) * weight)}, ${clampColor(base.b + (mix.b - base.b) * weight)})`;
  } catch {
    return baseHex;
  }
}

function isLight(hex: string) {
  try {
    const { r, g, b } = hexToRgb(hex);
    const luminance = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return luminance > 0.7;
  } catch {
    return true;
  }
}

export function ChatbotConversationWindow({ config, interactive = true, autoPlayDemo = false }: ChatbotConversationWindowProps) {
  // Chat state; clearing or mismanaging this breaks the preview transcript.
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const timeoutsRef = useRef<number[]>([]);
  const listRef = useRef<HTMLDivElement | null>(null);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioUnlockedRef = useRef(false);

  const lightBg = isLight(config.theme.backgroundColor);
  const panelBackground = mixColors(config.theme.backgroundColor, lightBg ? "#0f172a" : "#020617", lightBg ? 0.03 : 0.14);
  const inputBackground = mixColors(config.theme.backgroundColor, lightBg ? "#0f172a" : "#020617", lightBg ? 0.08 : 0.22);
  const botBubbleBackground = mixColors(config.theme.backgroundColor, lightBg ? "#ffffff" : "#020617", lightBg ? 0.22 : 0.36);
  const shellBorder = lightBg ? "1px solid rgba(15,23,42,0.16)" : "1px solid rgba(148,163,184,0.24)";
  const dividerBorder = lightBg ? "1px solid rgba(15,23,42,0.12)" : "1px solid rgba(148,163,184,0.18)";
  const inputBorder = lightBg ? "1px solid rgba(15,23,42,0.16)" : "1px solid rgba(148,163,184,0.24)";

  const addMessage = (message: ChatMessage) => {
    setMessages((prev) => [...prev, message]);
  };

  const getAudioContext = () => {
    if (typeof window === "undefined") return null;
    const Ctor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!audioContextRef.current) {
      audioContextRef.current = new Ctor();
    }
    return audioContextRef.current;
  };

  const playTone = (kind: "user" | "bot") => {
    if (!audioUnlockedRef.current) return;
    const ctx = getAudioContext();
    if (!ctx) return;
    if (ctx.state === "suspended") {
      void ctx.resume().catch(() => undefined);
    }

    const now = ctx.currentTime + 0.01;
    const spawnTone = (
      frequency: number,
      startAt: number,
      duration: number,
      type: OscillatorType,
      peakGain: number
    ) => {
      const oscillator = ctx.createOscillator();
      const gain = ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, startAt);
      gain.gain.setValueAtTime(0.0001, startAt);
      gain.gain.linearRampToValueAtTime(peakGain, startAt + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, startAt + duration);
      oscillator.connect(gain);
      gain.connect(ctx.destination);
      oscillator.start(startAt);
      oscillator.stop(startAt + duration + 0.03);
    };

    if (kind === "user") {
      spawnTone(760, now, 0.1, "triangle", 0.03);
      return;
    }

    spawnTone(540, now, 0.08, "sine", 0.022);
    spawnTone(660, now + 0.09, 0.1, "sine", 0.024);
  };

  useEffect(() => {
    return () => {
      timeoutsRef.current.forEach((id) => window.clearTimeout(id));
      timeoutsRef.current = [];
    };
  }, []);

  useEffect(() => {
    const unlockAudio = () => {
      audioUnlockedRef.current = true;
      const ctx = getAudioContext();
      if (!ctx) return;
      void ctx.resume().catch(() => undefined);
    };

    window.addEventListener("pointerdown", unlockAudio, { once: true });
    window.addEventListener("keydown", unlockAudio, { once: true });

    return () => {
      window.removeEventListener("pointerdown", unlockAudio);
      window.removeEventListener("keydown", unlockAudio);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (autoPlayDemo) {
      // Demo script seeds canned Q&A to show movement without user input.
      timeoutsRef.current.forEach((id) => window.clearTimeout(id));
      seenMessageIdsRef.current = new Set();
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
    seenMessageIdsRef.current = new Set();
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

  useEffect(() => {
    if (seenMessageIdsRef.current.size > 0) return;
    seenMessageIdsRef.current = new Set(messages.map((message) => message.id));
  }, [messages]);

  useEffect(() => {
    let newestUnseen: ChatMessage | null = null;
    for (const message of messages) {
      if (seenMessageIdsRef.current.has(message.id)) continue;
      seenMessageIdsRef.current.add(message.id);
      newestUnseen = message;
    }

    if (!newestUnseen) return;
    playTone(newestUnseen.sender);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  useEffect(() => {
    return () => {
      const ctx = audioContextRef.current;
      if (!ctx) return;
      void ctx.close().catch(() => undefined);
      audioContextRef.current = null;
    };
  }, []);

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
      className="flex h-full flex-col rounded-3xl"
      style={
        {
          ...themeStyles,
          background: panelBackground,
          border: shellBorder
        } as React.CSSProperties
      }
    >
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
        <AnimatePresence initial={false}>
          {messages.map((message) => (
            <motion.div
              key={message.id}
              initial={{
                opacity: 0,
                y: 12,
                clipPath:
                  message.sender === "user"
                    ? "inset(0 0 0 100% round 16px)"
                    : "inset(0 100% 0 0 round 16px)"
              }}
              animate={{ opacity: 1, y: 0, clipPath: "inset(0 0 0 0 round 16px)" }}
              exit={{ opacity: 0, y: 6 }}
              transition={{ duration: 0.28, ease: "easeOut" }}
              className={`flex ${message.sender === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className="max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed"
                style={
                  message.sender === "user"
                    ? {
                        color: "#ffffff",
                        backgroundImage: `linear-gradient(135deg, ${config.theme.primaryColor}, ${config.theme.accentColor})`
                      }
                    : {
                        color: config.theme.textColor,
                        background: botBubbleBackground,
                        border: inputBorder
                      }
                }
              >
                {message.sender === "user" ? message.text : <FormattedChatMessage content={message.text} />}
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
        <div className="px-4 py-3" style={{ borderTop: dividerBorder, background: panelBackground }}>
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
              className="w-full rounded-xl px-4 py-3 text-sm focus:outline-none"
              placeholder="Ask a question..."
              style={{
                color: config.theme.textColor || "#ffffff",
                background: inputBackground,
                border: inputBorder
              }}
            />
            <motion.button
              type="button"
              onClick={handleSend}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-[var(--chat-primary)]/50"
              style={{
                backgroundImage: `linear-gradient(135deg, ${config.theme.primaryColor}, ${config.theme.accentColor || config.theme.primaryColor})`
              }}
              aria-label="Send message"
            >
              <svg aria-hidden viewBox="0 0 20 20" className="h-4 w-4">
                <path
                  d="M2 9.8L16.9 3.2c.6-.3 1.2.3 1 1l-2.5 12.1c-.2.8-1.2 1-1.7.3l-3.2-4.2-3.5-1.2c-.9-.3-1-.9 0-1.3l8.4-3.7-9 2.7c-.8.2-1.5.3-2.4.1z"
                  fill="currentColor"
                />
              </svg>
            </motion.button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

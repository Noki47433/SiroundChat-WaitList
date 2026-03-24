"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BadgeDollarSign, Clock3, PhoneCall } from "lucide-react";
import { ICON_LIBRARY } from "@/app/components/chatbot/ChatbotIconLibrary";
import { PromptInputBox } from "@/components/ui/ai-prompt-box";
import { TextShimmer } from "@/components/ui/text-shimmer";
import type { TonePreset } from "@/lib/types";
import type { ChatMessage, ChatMessageAction, WidgetTheme } from "@/lib/types/core";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";
import { getOrCreateSessionId } from "@/lib/analytics/track";

export interface ChatWindowProps {
  siteId: string;
  widgetKey?: string | null;
  greeting: string;
  tonePreset?: TonePreset;
  theme?: WidgetTheme;
  businessName?: string;
  logoUrl?: string;
  iconId?: string;
  open?: boolean;
  onClose?: () => void;
}

function hexToRgb(hex: string) {
  const clean = hex.replace("#", "").trim();
  const full = clean.length === 3 ? clean.split("").map((c) => c + c).join("") : clean;
  const num = parseInt(full, 16);
  return { r: (num >> 16) & 255, g: (num >> 8) & 255, b: num & 255 };
}
function isLight(hex: string) {
  try {
    const { r, g, b } = hexToRgb(hex);
    const lum = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
    return lum > 0.7;
  } catch {
    return true;
  }
}

function clampColorValue(value: number) {
  return Math.max(0, Math.min(255, Math.round(value)));
}

function mixColors(baseHex: string, mixHex: string, weight: number) {
  try {
    const base = hexToRgb(baseHex);
    const mix = hexToRgb(mixHex);
    const mixed = {
      r: clampColorValue(base.r + (mix.r - base.r) * weight),
      g: clampColorValue(base.g + (mix.g - base.g) * weight),
      b: clampColorValue(base.b + (mix.b - base.b) * weight)
    };
    return `rgb(${mixed.r}, ${mixed.g}, ${mixed.b})`;
  } catch {
    return baseHex;
  }
}

function resolvePendingStatusSteps(message: string) {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("reservation") ||
    normalized.includes("reserve") ||
    normalized.includes("book") ||
    normalized.includes("table")
  ) {
    return ["Thinking…", "Checking reservations…", "Looking for the best time…", "Preparing reply…"];
  }
  if (
    normalized.includes("menu") ||
    normalized.includes("dish") ||
    normalized.includes("food") ||
    normalized.includes("price") ||
    normalized.includes("offer") ||
    normalized.includes("deal")
  ) {
    return ["Thinking…", "Looking at business info…", "Checking menu or prices…", "Preparing reply…"];
  }
  return ["Thinking…", "Looking at business info…", "Preparing reply…"];
}

function normalizeChatAction(action: unknown): ChatMessageAction | null {
  if (!action || typeof action !== "object") return null;

  const raw = action as Record<string, unknown>;
  if (raw.type === "quick_reply" && typeof raw.label === "string" && typeof raw.value === "string") {
    return {
      type: "quick_reply",
      label: raw.label,
      value: raw.value
    };
  }

  if (raw.type === "show_offer" && typeof raw.title === "string" && typeof raw.description === "string") {
    return {
      type: "show_offer",
      offerId: typeof raw.offerId === "string" ? raw.offerId : undefined,
      title: raw.title,
      description: raw.description,
      price: typeof raw.price === "string" ? raw.price : null,
      cta: typeof raw.cta === "string" ? raw.cta : undefined,
      value: typeof raw.value === "string" ? raw.value : undefined
    };
  }

  if (raw.type === "show_recommendations" && Array.isArray(raw.items)) {
    const items = raw.items
      .filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object")
      .map((item) => ({
        id: typeof item.id === "string" ? item.id : `rec-${typeof item.name === "string" ? item.name : Math.random().toString(16).slice(2)}`,
        name: typeof item.name === "string" ? item.name : "",
        description: typeof item.description === "string" ? item.description : null,
        price: typeof item.price === "number" ? item.price : null,
        reason: typeof item.reason === "string" ? item.reason : ""
      }))
      .filter((item) => item.name.length > 0);

    if (!items.length) return null;

    return {
      type: "show_recommendations",
      items
    };
  }

  if (
    raw.type === "ask_qualification_question" &&
    (raw.field === "budget_range" || raw.field === "urgency" || raw.field === "decision_maker") &&
    typeof raw.question === "string"
  ) {
    return {
      type: "ask_qualification_question",
      field: raw.field,
      question: raw.question
    };
  }

  return null;
}

function normalizeChatActions(actions: unknown): ChatMessageAction[] | undefined {
  if (!Array.isArray(actions)) return undefined;
  const normalized = actions.map(normalizeChatAction).filter((action): action is ChatMessageAction => Boolean(action));
  return normalized.length ? normalized : undefined;
}

function normalizeChatMessage(message: unknown): ChatMessage | null {
  if (!message || typeof message !== "object") return null;

  const raw = message as Record<string, unknown>;
  if (
    typeof raw.id !== "string" ||
    typeof raw.conversationId !== "string" ||
    (raw.sender !== "user" && raw.sender !== "ai" && raw.sender !== "assistant" && raw.sender !== "agent" && raw.sender !== "owner") ||
    typeof raw.text !== "string" ||
    typeof raw.createdAt !== "string"
  ) {
    return null;
  }

  return {
    id: raw.id,
    conversationId: raw.conversationId,
    sender: raw.sender,
    text: raw.text,
    createdAt: raw.createdAt,
    actions: normalizeChatActions(raw.actions)
  };
}

function normalizeChatMessages(messages: unknown): ChatMessage[] {
  if (!Array.isArray(messages)) return [];
  return messages
    .map(normalizeChatMessage)
    .filter((message): message is ChatMessage => Boolean(message))
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
}

export function ChatWindow({
  siteId,
  widgetKey,
  greeting,
  tonePreset,
  theme,
  businessName,
  logoUrl,
  iconId,
  open = false,
  onClose
}: ChatWindowProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [text, setText] = useState("");
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [isTyping, setIsTyping] = useState(false);
  const [pendingStatusSteps, setPendingStatusSteps] = useState<string[]>([]);
  const [pendingStatusIndex, setPendingStatusIndex] = useState(0);
  const [takeoverEnabled, setTakeoverEnabled] = useState(false);
  const [feedbackPrompt, setFeedbackPrompt] = useState<{ conversationId: string; messageId: string } | null>(null);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackDownOpen, setFeedbackDownOpen] = useState(false);
  const [feedbackTags, setFeedbackTags] = useState<string[]>([]);
  const [feedbackComment, setFeedbackComment] = useState("");
  const [messagesReady, setMessagesReady] = useState(false);
  const listRef = useRef<HTMLDivElement | null>(null);
  const seenMessageIdsRef = useRef<Set<string>>(new Set());
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioUnlockedRef = useRef(false);

  // ✅ IMPORTANT: API expects the BUSINESS widget_key for public embeds.
  // fallback to siteId for local demo mode / older embeds.
  const activeKey = widgetKey ?? siteId;
  const activeTonePreset = tonePreset ?? "friendly";

  // Make it taller like Fin (less “fat”)
  const PANEL_W = 360;
  const PANEL_H = 640;

  const colors = useMemo(
    () => ({
      primary: theme?.primary ?? "#00A3FF",
      background: theme?.background ?? "#F8FAFC",
      text: theme?.text ?? "#111827"
    }),
    [theme]
  );
  const accentColor = theme?.accent ?? theme?.secondary ?? colors.primary;

  const iconEntry = iconId ? ICON_LIBRARY.find((entry) => entry.id === iconId) : undefined;
  const IconComponent = iconEntry?.Icon;

  const storageKey = `widget-messages-${siteId}`;
  const conversationStorageKey = `widget-conversation-${siteId}`;
  const safeRandomId = () => {
    if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
    return `msg-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  };
  const resolveWidgetPagePath = () => {
    if (typeof document === "undefined") return "/";
    const referrer = document.referrer;
    if (referrer) {
      try {
        return new URL(referrer).pathname || "/";
      } catch {
        return "/";
      }
    }
    return window.location.pathname || "/";
  };

  const getAudioContext = useCallback(() => {
    if (typeof window === "undefined") return null;
    const Ctor = window.AudioContext ?? (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    if (!audioContextRef.current) {
      audioContextRef.current = new Ctor();
    }
    return audioContextRef.current;
  }, []);

  const playTone = useCallback(
    (kind: "user" | "assistant") => {
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
    },
    [getAudioContext]
  );

  const lightBg = isLight(colors.background);
  const panelBackground = mixColors(colors.background, lightBg ? "#0f172a" : "#020617", lightBg ? 0.03 : 0.14);
  const inputBackground = mixColors(colors.background, lightBg ? "#0f172a" : "#020617", lightBg ? 0.08 : 0.22);
  const botBubbleBackground = mixColors(colors.background, lightBg ? "#ffffff" : "#020617", lightBg ? 0.22 : 0.36);
  const composerBackground = lightBg
    ? mixColors(colors.background, "#ffffff", 0.22)
    : mixColors(colors.background, "#020617", 0.24);
  const composerText = lightBg ? mixColors(colors.text, "#0f172a", 0.02) : "#ffffff";
  const composerMuted = lightBg ? "rgba(15,23,42,0.56)" : "rgba(226,232,240,0.64)";
  const composerPlaceholder = lightBg ? "rgba(15,23,42,0.34)" : "rgba(226,232,240,0.42)";
  const composerButton = accentColor;
  const composerButtonIcon = isLight(accentColor) ? "#0f172a" : "#ffffff";
  const thinkingBackground = `linear-gradient(135deg, ${mixColors(colors.primary, "#ffffff", lightBg ? 0.72 : 0.26)}, ${mixColors(
    accentColor,
    "#ffffff",
    lightBg ? 0.6 : 0.22
  )})`;
  const thinkingBorder = `1px solid ${mixColors(colors.primary, lightBg ? "#0f172a" : "#ffffff", lightBg ? 0.08 : 0.42)}`;
  const thinkingTextBase = lightBg ? "rgba(15,23,42,0.92)" : "rgba(255,255,255,0.78)";
  const thinkingTextHighlight = lightBg ? "rgba(15,23,42,1)" : "rgba(255,255,255,1)";
  const watermarkColor = lightBg ? "rgba(15,23,42,0.4)" : "rgba(226,232,240,0.62)";
  const shellBorder = lightBg ? "1px solid rgba(15,23,42,0.16)" : "1px solid rgba(148,163,184,0.24)";
  const dividerBorder = lightBg ? "1px solid rgba(15,23,42,0.12)" : "1px solid rgba(148,163,184,0.18)";
  const inputBorder = lightBg ? "1px solid rgba(15,23,42,0.16)" : "1px solid rgba(148,163,184,0.24)";

	  const appendMessage = useCallback((incoming: ChatMessage) => {
	    const normalizedIncoming = normalizeChatMessage(incoming);
	    if (!normalizedIncoming) return;
	    setMessages((prev) => {
	      const existingIndex = prev.findIndex((message) => message.id === normalizedIncoming.id);
	      if (existingIndex >= 0) {
	        const next = [...prev];
	        const existing = next[existingIndex];
	        next[existingIndex] = {
	          ...existing,
	          ...normalizedIncoming,
	          actions: normalizedIncoming.actions ?? existing.actions
	        };
	        return next;
	      }
	      const next = [...prev, normalizedIncoming];
	      next.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
	      return next.slice(-200);
	    });
	  }, []);

  // ✅ Always ensure greeting exists on first render / restore
  useEffect(() => {
    if (typeof window === "undefined") return;
    setMessagesReady(() => false);
    seenMessageIdsRef.current = new Set();

    let restored: unknown = null;
    try {
      const saved = window.sessionStorage.getItem(storageKey);
      if (saved) restored = JSON.parse(saved);
    } catch {
      restored = null;
    }

	    const restoredArray = normalizeChatMessages(restored);

    let storedConversationId: string | null = null;
    try {
      storedConversationId = window.sessionStorage.getItem(conversationStorageKey);
    } catch {
      storedConversationId = null;
    }

    const derivedConversationId =
      restoredArray
        .map((message) => message.conversationId)
        .reverse()
        .find((id) => id && id !== "welcome" && !id.startsWith("temp")) ?? null;

    const needsGreeting =
      restoredArray.length === 0 ||
      (restoredArray[0]?.sender !== "ai" && restoredArray[0]?.conversationId !== "welcome");

    const nextConversationId = storedConversationId ?? derivedConversationId;
    if (nextConversationId) {
      setConversationId(() => nextConversationId);
    }

    if (needsGreeting) {
      const seed: ChatMessage[] = [
        {
          id: safeRandomId(),
          conversationId: "welcome",
          sender: "ai",
          text: greeting,
          createdAt: new Date().toISOString()
        }
      ];
      setMessages(() => seed);
      setMessagesReady(() => true);
      return;
    }

	      setMessages(() => restoredArray);
	      setMessagesReady(() => true);
	  }, [greeting, storageKey, conversationStorageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
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
  }, [getAudioContext]);

  useEffect(() => {
    if (!messagesReady) return;
    if (seenMessageIdsRef.current.size > 0) return;
    seenMessageIdsRef.current = new Set(messages.map((message) => message.id));
  }, [messagesReady, messages]);

  useEffect(() => {
    if (!messagesReady) return;

    let newestUnseen: ChatMessage | null = null;
    for (const message of messages) {
      if (seenMessageIdsRef.current.has(message.id)) continue;
      seenMessageIdsRef.current.add(message.id);
      newestUnseen = message;
    }

    if (!newestUnseen) return;
    playTone(newestUnseen.sender === "user" ? "user" : "assistant");
  }, [messages, messagesReady, playTone]);

  useEffect(() => {
    return () => {
      const ctx = audioContextRef.current;
      if (!ctx) return;
      void ctx.close().catch(() => undefined);
      audioContextRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(storageKey, JSON.stringify(messages));
    } catch {
      // ignore
    }
  }, [messages, storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!conversationId) return;
    try {
      window.sessionStorage.setItem(conversationStorageKey, conversationId);
    } catch {
      // ignore
    }
  }, [conversationId, conversationStorageKey]);

  useEffect(() => {
    if (!conversationId || conversationId === "welcome" || conversationId.startsWith("temp")) return;
    setTakeoverEnabled(false);
  }, [conversationId]);

  useEffect(() => {
    setFeedbackPrompt(null);
    setFeedbackSubmitting(false);
    setFeedbackSubmitted(false);
    setFeedbackDownOpen(false);
    setFeedbackTags([]);
    setFeedbackComment("");
  }, [conversationId]);

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages, isTyping]);

  useEffect(() => {
    if (!isTyping || pendingStatusSteps.length <= 1) return;
    setPendingStatusIndex(0);
    const interval = window.setInterval(() => {
      setPendingStatusIndex((current) => (current + 1) % pendingStatusSteps.length);
    }, 1400);
    return () => window.clearInterval(interval);
  }, [isTyping, pendingStatusSteps]);

  useEffect(() => {
    if (!conversationId || conversationId === "welcome" || conversationId.startsWith("temp")) return;

    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`chat_messages:${conversationId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as {
            id: string;
            conversation_id: string;
            sender: string;
            message_text: string;
            created_at: string;
          };

          appendMessage({
            id: row.id,
            conversationId: row.conversation_id,
            sender: row.sender as ChatMessage["sender"],
            text: row.message_text,
            createdAt: row.created_at
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_conversations", filter: `id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as { takeover_enabled?: boolean };
          const enabled = Boolean(row.takeover_enabled);
          setTakeoverEnabled(enabled);
          if (enabled) {
            setIsTyping(false);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [appendMessage, conversationId]);

  const NEGATIVE_TAGS = ["Not relevant", "Wrong answer", "Too slow"];

  const toggleFeedbackTag = (tag: string) => {
    setFeedbackTags((prev) => (prev.includes(tag) ? prev.filter((item) => item !== tag) : [...prev, tag]));
  };

  const submitFeedback = async (
    rating: "up" | "down",
    options?: { tags?: string[]; comment?: string }
  ) => {
    if (!feedbackPrompt || feedbackSubmitting) return;
    setFeedbackSubmitting(true);
    try {
      const comment = options?.comment?.trim() ?? "";
      const res = await fetch("/api/chat/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: feedbackPrompt.conversationId,
          messageId: feedbackPrompt.messageId,
          rating,
          tags: options?.tags?.length ? options.tags : undefined,
          comment: comment.length ? comment : undefined
        })
      });

      if (res.ok) {
        setFeedbackSubmitted(true);
        setFeedbackDownOpen(false);
      }
    } finally {
      setFeedbackSubmitting(false);
    }
  };

  const sendMessage = async (overrideText?: string, options?: { displayText?: string }) => {
    const outgoing = (overrideText ?? text).trim();
    if (!outgoing) return;
    const displayText = (options?.displayText ?? outgoing).trim() || outgoing;

    const optimisticId = safeRandomId();
    const optimistic: ChatMessage = {
      id: optimisticId,
      conversationId: conversationId ?? "temp",
      sender: "user",
      text: displayText,
      createdAt: new Date().toISOString()
    };

    appendMessage(optimistic);
    setText(() => "");
    setPendingStatusSteps(resolvePendingStatusSteps(outgoing));
    setPendingStatusIndex(0);

    if (!takeoverEnabled) {
      setIsTyping(() => true);
    }

    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: activeKey,
          siteId,
          conversationId,
          message: outgoing,
          tonePreset: activeTonePreset,
          pagePath: resolveWidgetPagePath(),
          referrer: typeof document !== "undefined" ? document.referrer || null : null,
          sessionId: getOrCreateSessionId()
        })
      });

      const data = await res.json().catch(() => null);

      if (!res.ok || !data) {
        appendMessage({
          id: safeRandomId(),
          conversationId: conversationId ?? "temp-error",
          sender: "ai",
          text: "Sorry, I could not reply. Please try again.",
          createdAt: new Date().toISOString()
        });
        return;
      }

      // ✅ Adopt conversationId from server ALWAYS (critical)
      if (typeof data.conversationId === "string" && data.conversationId.length > 0) {
        setConversationId(() => data.conversationId);
      }

      const resolvedConversationId =
        (typeof data.conversationId === "string" ? data.conversationId : conversationId) ?? "temp";

      if (typeof data.userMessageId === "string" && data.userMessageId.length > 0) {
        setMessages((prev) => {
          const updated = prev.map((message) =>
            message.id === optimisticId
              ? { ...message, id: data.userMessageId, conversationId: resolvedConversationId }
              : message
          );
          const deduped = updated.filter(
            (message, index, array) => array.findIndex((item) => item.id === message.id) === index
          );
          return deduped;
        });
      }

      if (data.takeover === true) {
        setTakeoverEnabled(true);
      }

	      if (typeof data.reply === "string") {
	        appendMessage({
	          id: typeof data.assistantMessageId === "string" ? data.assistantMessageId : safeRandomId(),
	          conversationId: resolvedConversationId,
	          sender: "assistant",
	          text: data.reply,
	          createdAt: new Date().toISOString(),
	          actions: normalizeChatActions(data.actions)
	        });

        if (data.promptFeedback === true && typeof data.assistantMessageId === "string") {
          setFeedbackPrompt({
            conversationId: resolvedConversationId,
            messageId: data.assistantMessageId
          });
          setFeedbackSubmitted(false);
          setFeedbackDownOpen(false);
          setFeedbackTags([]);
          setFeedbackComment("");
        }
        return;
      }

	      // fallback support if your API ever returns a full message list
	      if (Array.isArray(data.messages)) {
	        setMessages(() => normalizeChatMessages(data.messages));
	        return;
	      }

      appendMessage({
        id: safeRandomId(),
        conversationId: conversationId ?? "temp-error",
        sender: "ai",
        text: "Sorry, I could not reply. Please try again.",
        createdAt: new Date().toISOString()
      });
    } catch {
      appendMessage({
        id: safeRandomId(),
        conversationId: conversationId ?? "temp-error",
        sender: "ai",
        text: "Network issue—please try again.",
        createdAt: new Date().toISOString()
      });
    } finally {
      setIsTyping(() => false);
      setPendingStatusSteps([]);
      setPendingStatusIndex(0);
    }
  };

	  const handleActionClick = (action: ChatMessageAction) => {
	    if (action.type === "quick_reply") {
	      void sendMessage(action.value, { displayText: action.label });
	      return;
	    }
	    if (action.type === "show_offer") {
	      void sendMessage(action.value ?? action.title, { displayText: action.title });
	      return;
	    }
	    if (action.type === "show_recommendations" && action.items[0]?.name) {
	      void sendMessage(action.items[0].name, { displayText: action.items[0].name });
	    }
	  };

  return (
    <div className="pointer-events-none fixed bottom-0 right-0 z-50" style={{ width: PANEL_W, height: PANEL_H }} aria-hidden={!open}>
      <div
        className="pointer-events-auto h-full w-full transition-all duration-200 ease-out"
        style={{
          opacity: open ? 1 : 0,
          transform: open ? "translateY(0px) scale(1)" : "translateY(14px) scale(0.98)"
        }}
      >
        <div
          className="flex h-full w-full flex-col overflow-hidden rounded-[30px] shadow-[0_30px_80px_rgba(15,23,42,0.25)]"
          style={{
            background: panelBackground,
            color: colors.text,
            ["--chat-primary" as any]: colors.primary,
            ["--chat-accent" as any]: accentColor,
            ["--chat-text" as any]: colors.text
          }}
        >
          {/* Header */}
          <div
            className="relative mx-4 mt-4 rounded-2xl border border-white/10 px-4 py-3 shadow-inner"
            style={{ background: `linear-gradient(135deg, ${colors.primary}, ${accentColor})`, color: "#fff" }}
          >
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center overflow-hidden rounded-2xl border border-white/20 bg-white/10 shadow-inner">
                {logoUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={logoUrl} alt={`${businessName ?? "Chatbot"} logo`} className="h-full w-full object-cover" />
                  </>
                ) : IconComponent ? (
                  <IconComponent className="h-6 w-6 text-white" />
                ) : (
                  <span className="text-lg font-semibold text-white">{businessName?.[0] ?? "S"}</span>
                )}
              </div>

              <div className="flex-1">
                <p className="text-sm font-semibold text-white">{businessName ?? "SiroundChat"}</p>
                <div className="flex items-center gap-2 text-xs text-white/85">
                  <span className="h-2 w-2 rounded-full bg-emerald-400" />
                  Online
                </div>
              </div>

              <button
                type="button"
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-full bg-white/15 text-white backdrop-blur transition hover:bg-white/25"
                aria-label="Close chat"
              >
                <span className="text-xl leading-none">×</span>
              </button>
            </div>
          </div>

          {/* Conversation surface */}
          <div
            className="mx-4 mt-4 mb-4 flex-1 overflow-hidden rounded-2xl"
            style={{
              background: panelBackground,
              border: shellBorder
            }}
          >
            <div className="flex h-full flex-col" style={{ background: panelBackground }}>
              {takeoverEnabled ? (
                <div
                  className="mx-4 mt-4 rounded-xl border px-3 py-2 text-xs font-semibold"
                  style={{
                    borderColor: lightBg ? "rgba(15,23,42,0.14)" : "rgba(148,163,184,0.2)",
                    color: colors.text,
                    background: inputBackground
                  }}
                >
                  Human takeover active
                </div>
              ) : null}
              <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
                <AnimatePresence initial={false}>
                  {messages.map((m) => {
                    const isUser = m.sender === "user";
                    const isOwner = m.sender === "owner";
                    return (
                      <motion.div
                        key={m.id}
                        initial={{
                          opacity: 0,
                          y: 12,
                          clipPath: isUser ? "inset(0 0 0 100% round 16px)" : "inset(0 100% 0 0 round 16px)"
                        }}
                        animate={{ opacity: 1, y: 0, clipPath: "inset(0 0 0 0 round 16px)" }}
                        exit={{ opacity: 0, y: 6 }}
                        transition={{ duration: 0.28, ease: "easeOut" }}
                        className={`flex ${isUser ? "justify-end" : "justify-start"}`}
                      >
                        <div className="max-w-[85%] space-y-1">
                          {!isUser && isOwner ? (
                            <div className="text-[11px] font-semibold opacity-70">Business</div>
                          ) : null}
                          <div
                            className="rounded-2xl px-4 py-3 text-sm leading-relaxed"
                            style={
                              isUser
                                ? {
                                    color: "#fff",
                                    backgroundImage: `linear-gradient(135deg, ${colors.primary}, ${accentColor})`
                                  }
                                : {
                                    color: colors.text,
                                    background: botBubbleBackground,
                                    border: inputBorder
                                  }
                            }
                          >
                            {m.text}
                          </div>
                          {!isUser && m.actions?.length ? (
                            <div className="space-y-2 pt-2">
	                              {m.actions.map((action, index) => {
	                                if (action.type === "quick_reply") {
                                  return (
                                    <button
                                      key={`${m.id}-action-${index}`}
                                      type="button"
                                      onClick={() => handleActionClick(action)}
                                      className="mr-2 inline-flex rounded-full px-3 py-1.5 text-xs font-semibold transition"
                                      style={{
                                        color: colors.text,
                                        background: inputBackground,
                                        border: inputBorder
                                      }}
                                    >
                                      {action.label}
                                    </button>
                                  );
                                }

	                                if (action.type === "show_offer") {
                                  return (
                                    <button
                                      key={`${m.id}-action-${index}`}
                                      type="button"
                                      onClick={() => handleActionClick(action)}
                                      className="w-full rounded-2xl border px-4 py-3 text-left transition"
                                      style={{
                                        background: inputBackground,
                                        borderColor: lightBg ? "rgba(15,23,42,0.12)" : "rgba(148,163,184,0.24)"
                                      }}
                                    >
                                      <div className="flex items-start justify-between gap-3">
                                        <div>
                                          <p className="text-sm font-semibold" style={{ color: colors.text }}>
                                            {action.title}
                                          </p>
                                          <p className="mt-1 text-xs leading-relaxed opacity-75" style={{ color: colors.text }}>
                                            {action.description}
                                          </p>
                                        </div>
                                        {action.price ? (
                                          <span className="rounded-full px-2 py-1 text-[11px] font-semibold text-white" style={{
                                            backgroundImage: `linear-gradient(135deg, ${colors.primary}, ${accentColor})`
                                          }}>
                                            {action.price}
                                          </span>
                                        ) : null}
                                      </div>
                                      <p className="mt-3 text-xs font-semibold" style={{ color: colors.primary }}>
                                        {action.cta ?? "Tell me more"}
                                      </p>
                                    </button>
                                  );
                                }

	                                if (action.type === "ask_qualification_question") {
	                                  return null;
	                                }

	                                if (action.type !== "show_recommendations" || !Array.isArray(action.items) || action.items.length === 0) {
	                                  return null;
	                                }

	                                return (
	                                  <div
                                    key={`${m.id}-action-${index}`}
                                    className="rounded-2xl border px-4 py-3"
                                    style={{
                                      background: inputBackground,
                                      borderColor: lightBg ? "rgba(15,23,42,0.12)" : "rgba(148,163,184,0.24)"
                                    }}
                                  >
                                    <p className="text-xs font-semibold uppercase tracking-[0.22em] opacity-60" style={{ color: colors.text }}>
                                      Suggestions
                                    </p>
                                    <div className="mt-2 space-y-2">
	                                      {action.items.map((item) => (
                                        <button
                                          key={item.id}
                                          type="button"
                                          onClick={() => void sendMessage(item.name)}
                                          className="w-full rounded-xl px-3 py-2 text-left transition"
                                          style={{
                                            background: botBubbleBackground,
                                            border: inputBorder,
                                            color: colors.text
                                          }}
                                        >
                                          <div className="flex items-center justify-between gap-2">
                                            <p className="text-sm font-semibold">{item.name}</p>
                                            {item.price ? <span className="text-xs opacity-70">€{item.price}</span> : null}
                                          </div>
                                          {item.description ? <p className="mt-1 text-xs opacity-75">{item.description}</p> : null}
                                          <p className="mt-1 text-[11px] font-medium" style={{ color: colors.primary }}>
                                            {item.reason}
                                          </p>
                                        </button>
                                      ))}
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          ) : null}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {feedbackPrompt ? (
                  <div className="flex justify-center">
                    <div
                      className="w-full max-w-[92%] rounded-2xl border px-4 py-3 text-sm shadow-sm"
                      style={{
                        borderColor: lightBg ? "rgba(15,23,42,0.12)" : "rgba(148,163,184,0.2)",
                        background: inputBackground,
                        color: colors.text
                      }}
                    >
                      <p className="text-sm font-semibold">Has this conversation helped you?</p>
                      {feedbackSubmitted ? (
                        <p className="mt-2 text-xs opacity-70">Thanks for the feedback.</p>
                      ) : feedbackDownOpen ? (
                        <>
                          <div className="mt-3 flex flex-wrap gap-2">
                            {NEGATIVE_TAGS.map((tag) => {
                              const selected = feedbackTags.includes(tag);
                              return (
                                <button
                                  key={tag}
                                  type="button"
                                  onClick={() => toggleFeedbackTag(tag)}
                                  className="rounded-full px-3 py-1 text-xs font-semibold transition"
                                  style={{
                                    background: selected
                                      ? "linear-gradient(135deg, var(--chat-primary), var(--chat-accent))"
                                      : lightBg
                                        ? "rgba(15,23,42,0.08)"
                                        : "rgba(148,163,184,0.2)",
                                    color: selected ? "#fff" : colors.text
                                  }}
                                >
                                  {tag}
                                </button>
                              );
                            })}
                          </div>
                          <textarea
                            value={feedbackComment}
                            onChange={(event) => setFeedbackComment(event.target.value)}
                            placeholder="Optional details..."
                            rows={2}
                            className="mt-3 w-full rounded-xl px-3 py-2 text-xs focus:outline-none"
                            style={{
                              color: colors.text,
                              background: panelBackground,
                              border: inputBorder
                            }}
                          />
                          <div className="mt-3 flex gap-2">
                            <button
                              type="button"
                              onClick={() =>
                                submitFeedback("down", {
                                  tags: feedbackTags,
                                  comment: feedbackComment
                                })
                              }
                              disabled={feedbackSubmitting}
                              className="flex flex-1 items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold text-white transition"
                              style={{
                                backgroundImage: `linear-gradient(135deg, ${colors.primary}, ${accentColor})`
                              }}
                            >
                              Send feedback
                            </button>
                            <button
                              type="button"
                              onClick={() => submitFeedback("down")}
                              disabled={feedbackSubmitting}
                              className="flex flex-1 items-center justify-center rounded-xl px-3 py-2 text-xs font-semibold transition"
                              style={{
                                background: lightBg ? "rgba(15,23,42,0.08)" : "rgba(148,163,184,0.2)",
                                color: colors.text
                              }}
                            >
                              Skip
                            </button>
                          </div>
                        </>
                      ) : (
                        <div className="mt-3 flex gap-2">
                          <button
                            type="button"
                            onClick={() => submitFeedback("up")}
                            disabled={feedbackSubmitting}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition"
                            style={{
                              background: lightBg ? "rgba(15,23,42,0.08)" : "rgba(148,163,184,0.2)"
                            }}
                          >
                            <span aria-hidden>👍</span>
                            Helpful
                          </button>
                          <button
                            type="button"
                            onClick={() => setFeedbackDownOpen(true)}
                            disabled={feedbackSubmitting}
                            className="flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold transition"
                            style={{
                              background: lightBg ? "rgba(15,23,42,0.08)" : "rgba(148,163,184,0.2)"
                            }}
                          >
                            <span aria-hidden>👎</span>
                            Not really
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ) : null}

                {isTyping ? (
                  <div className="flex justify-start">
                    <div
                      className="inline-flex items-center rounded-full px-4 py-2 shadow-[0_10px_30px_rgba(15,23,42,0.12)]"
                      style={{
                        background: thinkingBackground,
                        border: thinkingBorder
                      }}
                    >
                      <TextShimmer
                        className="text-xs font-medium"
                        duration={1.2}
                        style={{
                          ["--base-color" as any]: thinkingTextBase,
                          ["--base-gradient-color" as any]: thinkingTextHighlight
                        } as CSSProperties}
                      >
                          {pendingStatusSteps[pendingStatusIndex] ?? "Thinking…"}
                      </TextShimmer>
                    </div>
                  </div>
                ) : null}
              </div>

              {/* Input */}
              <div
                className="px-4 py-3"
                style={{
                  background: panelBackground,
                  borderTop: dividerBorder
                }}
              >
                <label className="sr-only" htmlFor="chat-input">
                  Send a message
                </label>

                <PromptInputBox
                  value={text}
                  onValueChange={(next) => setText(() => next)}
                  onSend={async (message) => {
                    await sendMessage(message);
                  }}
                  isLoading={isTyping}
                  placeholder="Ask a question..."
                  variant="chat"
                  quickActions={[
                    {
                      id: "hours",
                      label: "Hours",
                      value: "What are your opening hours?",
                      accent: colors.primary,
                      Icon: Clock3
                    },
                    {
                      id: "prices",
                      label: "Prices",
                      value: "What are your prices?",
                      accent: accentColor,
                      Icon: BadgeDollarSign
                    },
                    {
                      id: "contact",
                      label: "Contact",
                      value: "How can I contact you?",
                      accent: lightBg ? mixColors(colors.text, colors.primary, 0.2) : "#ffffff",
                      Icon: PhoneCall
                    }
                  ]}
                  showAttachments={false}
                  className="rounded-[26px]"
                  colors={{
                    panel: composerBackground,
                    border: inputBorder.replace("1px solid ", ""),
                    text: composerText,
                    muted: composerMuted,
                    placeholder: composerPlaceholder,
                    sendButton: composerButton,
                    sendIcon: composerButtonIcon
                  }}
                />

                <a
                  href="https://siroundchat.com"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 flex cursor-pointer items-center justify-center gap-1.5 transition hover:opacity-100"
                  style={{ color: watermarkColor, opacity: 0.82 }}
                >
                  <Image
                    src="/images-logo/SiroundChatLogo.png"
                    alt="SiroundChat"
                    width={24}
                    height={24}
                    className="h-5 w-5"
                  />
                  <span className="text-[11px]">
                    Powered by <span className="font-medium">SiroundChat</span>
                  </span>
                </a>
              </div>
            </div>
          </div>

          {/* pointer-events: keep closed state click-through handled in WidgetRoot */}
        </div>
      </div>
    </div>
  );
}

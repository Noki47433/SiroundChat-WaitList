"use client";

import Image from "next/image";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChatbotTypingIndicator } from "@/app/components/chatbot/ChatbotTypingIndicator";
import { ICON_LIBRARY } from "@/app/components/chatbot/ChatbotIconLibrary";
import type { TonePreset } from "@/lib/types";
import type { ChatMessage, WidgetTheme } from "@/lib/types/core";
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
  const [takeoverEnabled, setTakeoverEnabled] = useState(false);
  const [feedbackPrompt, setFeedbackPrompt] = useState<{ conversationId: string; messageId: string } | null>(null);
  const [feedbackSubmitting, setFeedbackSubmitting] = useState(false);
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false);
  const [feedbackDownOpen, setFeedbackDownOpen] = useState(false);
  const [feedbackTags, setFeedbackTags] = useState<string[]>([]);
  const [feedbackComment, setFeedbackComment] = useState("");
  const listRef = useRef<HTMLDivElement | null>(null);

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

  const lightBg = isLight(colors.background);

  const appendMessage = useCallback((incoming: ChatMessage) => {
    setMessages((prev) => {
      if (prev.some((message) => message.id === incoming.id)) return prev;
      const next = [...prev, incoming];
      next.sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      return next.slice(-200);
    });
  }, []);

  // ✅ Always ensure greeting exists on first render / restore
  useEffect(() => {
    if (typeof window === "undefined") return;

    let restored: unknown = null;
    try {
      const saved = window.sessionStorage.getItem(storageKey);
      if (saved) restored = JSON.parse(saved);
    } catch {
      restored = null;
    }

    const restoredArray = Array.isArray(restored) ? (restored as ChatMessage[]) : [];

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
      return;
    }

    setMessages(() => restoredArray);
  }, [greeting, storageKey, conversationStorageKey]);

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

  const sendMessage = async () => {
    const outgoing = text.trim();
    if (!outgoing) return;

    const optimisticId = safeRandomId();
    const optimistic: ChatMessage = {
      id: optimisticId,
      conversationId: conversationId ?? "temp",
      sender: "user",
      text: outgoing,
      createdAt: new Date().toISOString()
    };

    appendMessage(optimistic);
    setText(() => "");

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
          createdAt: new Date().toISOString()
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
        setMessages(() => data.messages);
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
            background: "transparent",
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
            className="mx-4 mt-4 mb-4 flex-1 overflow-hidden rounded-2xl shadow-inner"
            style={{ background: lightBg ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.06)" }}
          >
            <div className="flex h-full flex-col" style={{ background: colors.background }}>
              {takeoverEnabled ? (
                <div
                  className="mx-4 mt-4 rounded-xl border px-3 py-2 text-xs font-semibold"
                  style={{
                    borderColor: lightBg ? "rgba(0,0,0,0.12)" : "rgba(255,255,255,0.15)",
                    color: colors.text,
                    background: lightBg ? "rgba(0,0,0,0.04)" : "rgba(255,255,255,0.08)"
                  }}
                >
                  Human takeover active
                </div>
              ) : null}
              <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
                {messages.map((m) => {
                  const isUser = m.sender === "user";
                  const isOwner = m.sender === "owner";
                  return (
                    <div key={m.id} className={`flex ${isUser ? "justify-end" : "justify-start"}`}>
                      <div className="max-w-[85%] space-y-1">
                        {!isUser && isOwner ? (
                          <div className="text-[11px] font-semibold opacity-70">Business</div>
                        ) : null}
                        <div
                          className="rounded-2xl px-4 py-3 text-sm leading-relaxed shadow-sm"
                          style={
                            isUser
                              ? { color: "#fff", backgroundImage: `linear-gradient(135deg, ${colors.primary}, ${accentColor})` }
                              : {
                                  color: colors.text,
                                  background: lightBg ? "rgba(255,255,255,0.85)" : "rgba(255,255,255,0.10)",
                                  border: lightBg ? "1px solid rgba(0,0,0,0.08)" : "1px solid rgba(255,255,255,0.10)"
                                }
                          }
                        >
                          {m.text}
                        </div>
                      </div>
                    </div>
                  );
                })}

                {feedbackPrompt ? (
                  <div className="flex justify-center">
                    <div
                      className="w-full max-w-[92%] rounded-2xl border px-4 py-3 text-sm shadow-sm"
                      style={{
                        borderColor: lightBg ? "rgba(0,0,0,0.08)" : "rgba(255,255,255,0.12)",
                        background: lightBg ? "rgba(255,255,255,0.9)" : "rgba(255,255,255,0.08)",
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
                                        ? "rgba(0,0,0,0.06)"
                                        : "rgba(255,255,255,0.12)",
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
                              background: lightBg ? "#ffffff" : "rgba(255,255,255,0.10)",
                              border: lightBg ? "1px solid rgba(0,0,0,0.14)" : "1px solid rgba(255,255,255,0.16)"
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
                                background: lightBg ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.12)",
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
                              background: lightBg ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.12)"
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
                              background: lightBg ? "rgba(0,0,0,0.06)" : "rgba(255,255,255,0.12)"
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
                    <ChatbotTypingIndicator
                      theme={{
                        primaryColor: colors.primary,
                        accentColor,
                        backgroundColor: colors.background,
                        textColor: colors.text
                      }}
                    />
                  </div>
                ) : null}
              </div>

              {/* Input */}
              <div
                className="px-4 py-3"
                style={{
                  background: lightBg ? "rgba(255,255,255,0.72)" : "rgba(255,255,255,0.06)",
                  borderTop: lightBg ? "1px solid rgba(0,0,0,0.06)" : "1px solid rgba(255,255,255,0.08)"
                }}
              >
                <label className="sr-only" htmlFor="chat-input">
                  Send a message
                </label>

                <div className="flex items-center gap-2">
                  <input
                    id="chat-input"
                    value={text}
                    onChange={(e) => setText(() => e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && !e.shiftKey) {
                        e.preventDefault();
                        sendMessage();
                      }
                    }}
                    className="w-full rounded-full px-4 py-3 text-sm focus:outline-none"
                    placeholder="Ask a question..."
                    style={{
                      color: colors.text,
                      background: lightBg ? "#ffffff" : "rgba(255,255,255,0.10)",
                      border: lightBg ? "1px solid rgba(0,0,0,0.14)" : "1px solid rgba(255,255,255,0.16)"
                    }}
                  />

                  <button
                    type="button"
                    onClick={sendMessage}
                    className="rounded-full px-5 py-3 text-sm font-semibold text-white shadow-lg"
                    style={{ backgroundImage: `linear-gradient(135deg, ${colors.primary}, ${accentColor})` }}
                  >
                    Send
                  </button>
                </div>

                <div className="mt-2 flex items-center justify-center gap-1 opacity-50 select-none">
                  <Image
                    src="/images-logo/SiroundChatLogo.png"
                    alt="SiroundChat"
                    width={24}
                    height={24}
                    className="h-6 w-6 grayscale"
                  />
                  <span className="text-[11px] text-gray-400">
                    Powered by <span className="font-medium">SiroundChat</span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* pointer-events: keep closed state click-through handled in WidgetRoot */}
        </div>
      </div>
    </div>
  );
}

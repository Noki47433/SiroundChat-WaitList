"use client";

import { useEffect, useRef, useState } from "react";
import { FormattedChatMessage } from "@/components/chat/FormattedChatMessage";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type ConversationRow = {
  id: string;
  user_name: string | null;
  user_email: string | null;
  created_at: string;
};

type MessageRow = {
  id: string;
  sender: string;
  message_text: string;
  created_at: string;
};

const formatTimestamp = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const resolveSenderLabel = (sender: string) => {
  if (sender === "user") return "Visitor";
  if (sender === "owner" || sender === "agent") return "You";
  return "Bot";
};

const mergeMessages = (existing: MessageRow[], incoming: MessageRow) => {
  if (existing.some((item) => item.id === incoming.id)) return existing;
  const next = [...existing, incoming];
  next.sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
  return next.slice(-200);
};

export function ConversationDetailPanel({
  conversation,
  messages: initialMessages
}: {
  conversation: ConversationRow;
  messages: MessageRow[];
}) {
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);
  const listRef = useRef<HTMLDivElement | null>(null);

  const visitorName = conversation.user_name?.trim() || "Website visitor";
  const visitorEmail = conversation.user_email?.trim();

  useEffect(() => {
    if (!listRef.current) return;
    listRef.current.scrollTop = listRef.current.scrollHeight;
  }, [messages]);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    const channel = supabase
      .channel(`conversation:${conversation.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "chat_messages", filter: `conversation_id=eq.${conversation.id}` },
        (payload) => {
          const row = payload.new as MessageRow;
          setMessages((prev) => mergeMessages(prev, row));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversation.id]);

  const messageCount = messages.length;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-xs uppercase tracking-[0.2em] text-white/40">Conversation</p>
          <h2 className="mt-2 text-2xl font-semibold">{visitorName}</h2>
          <p className="text-sm text-white/60">
            {visitorEmail ?? "No email"} • Started {formatTimestamp(conversation.created_at)}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-white/50">
        <span>{messageCount} messages</span>
        <span>{conversation.id}</span>
      </div>

      <div ref={listRef} className="space-y-3 rounded-2xl border border-white/10 bg-neutral-950/60 p-4">
        {messages.length === 0 ? (
          <p className="text-sm text-white/60">No messages yet.</p>
        ) : null}
        {messages.map((message) => {
          const isVisitor = message.sender === "user";
          const isOwner = message.sender === "owner" || message.sender === "agent";
          const align = isVisitor ? "justify-start" : "justify-end";
          const bubbleStyle = isOwner
            ? "bg-[#00A3FF] text-white"
            : isVisitor
            ? "bg-white text-neutral-900"
            : "bg-white/10 text-white";

          return (
            <div key={message.id} className={`flex ${align}`}>
              <div className="max-w-[80%] space-y-1">
                <div className="flex items-center justify-between text-xs text-white/50">
                  <span>{resolveSenderLabel(message.sender)}</span>
                  <span>{formatTimestamp(message.created_at)}</span>
                </div>
                <div className={`rounded-2xl px-4 py-2 text-sm ${bubbleStyle}`}>
                  {isVisitor || isOwner ? message.message_text : <FormattedChatMessage content={message.message_text} />}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

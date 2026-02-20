"use client";

import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/toast";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser";

type ConversationRow = {
  id: string;
  user_name: string | null;
  user_email: string | null;
  created_at: string;
  takeover_enabled: boolean | null;
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

const isOwnerMessage = (sender: string) => sender === "owner" || sender === "agent";

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
  const { push } = useToast();
  const [messages, setMessages] = useState<MessageRow[]>(initialMessages);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const [takeoverEnabled, setTakeoverEnabled] = useState(Boolean(conversation.takeover_enabled));
  const [takeoverLoading, setTakeoverLoading] = useState(false);
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
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "chat_conversations", filter: `id=eq.${conversation.id}` },
        (payload) => {
          const row = payload.new as ConversationRow;
          setTakeoverEnabled(Boolean(row.takeover_enabled));
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [conversation.id]);

  const handleToggleTakeover = async () => {
    setTakeoverLoading(true);
    const res = await fetch("/api/chat/takeover", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: conversation.id, enabled: !takeoverEnabled })
    });
    const payload = await res.json().catch(() => null);
    setTakeoverLoading(false);

    if (!res.ok || !payload) {
      push({
        title: "Takeover update failed",
        message: payload?.error ?? "Unable to update takeover state.",
        variant: "error"
      });
      return;
    }

    setTakeoverEnabled(Boolean(payload.takeover_enabled));
  };

  const handleSend = async (event: React.FormEvent) => {
    event.preventDefault();
    const trimmed = text.trim();
    if (!trimmed) return;

    setSending(true);
    const res = await fetch("/api/chat/owner-send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ conversationId: conversation.id, message: trimmed })
    });
    const payload = await res.json().catch(() => null);
    setSending(false);

    if (!res.ok || !payload) {
      push({
        title: "Message failed",
        message: payload?.error ?? "Unable to send message.",
        variant: "error"
      });
      return;
    }

    setText("");
    setMessages((prev) =>
      mergeMessages(prev, {
        id: payload.id ?? `owner-${Date.now()}`,
        sender: "owner",
        message_text: trimmed,
        created_at: payload.created_at ?? new Date().toISOString()
      })
    );
  };

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
        <div className="flex flex-wrap items-center gap-3">
          <Badge variant={takeoverEnabled ? "success" : "default"}>
            {takeoverEnabled ? "Takeover active" : "Bot active"}
          </Badge>
          <Button
            variant={takeoverEnabled ? "outline" : "primary"}
            onClick={handleToggleTakeover}
            disabled={takeoverLoading}
          >
            {takeoverEnabled ? "End takeover" : "Start takeover"}
          </Button>
        </div>
      </div>

      {takeoverEnabled ? (
        <div className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-white/70">
          Human takeover active - bot paused.
        </div>
      ) : null}

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
          const isOwner = isOwnerMessage(message.sender);
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
                <div className={`rounded-2xl px-4 py-2 text-sm ${bubbleStyle}`}>{message.message_text}</div>
              </div>
            </div>
          );
        })}
      </div>

      <form onSubmit={handleSend} className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <Input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Reply as the business owner..."
          className="flex-1"
        />
        <Button type="submit" disabled={sending || !text.trim()}>
          {sending ? "Sending..." : "Send message"}
        </Button>
      </form>
    </div>
  );
}

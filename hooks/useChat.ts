"use client";

import { useCallback, useEffect, useState } from "react";
import type { ChatMessage } from "@/lib/types/core";

interface Conversation {
  id: string;
  name?: string;
  preview?: string;
  created_at: string;
}

export function useChat() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const loadConversations = useCallback(async () => {
    const res = await fetch("/api/chat/history");
    if (!res.ok) return;
    const data = await res.json();
    setConversations(data.conversations ?? []);
    if (!activeConversationId && data.conversations?.length) {
      setActiveConversationId(data.conversations[0].id);
    }
  }, [activeConversationId]);

  const loadMessages = useCallback(async () => {
    if (!activeConversationId) return;
    setLoading(true);
    const res = await fetch(`/api/chat/history?conversationId=${activeConversationId}`);
    if (!res.ok) {
      setLoading(false);
      return;
    }
    const data = await res.json();
    setMessages(data.messages ?? []);
    setLoading(false);
  }, [activeConversationId]);

  const sendMessage = useCallback(
    async (text: string) => {
      if (!activeConversationId) return;
      const optimistic: ChatMessage = {
        id: crypto.randomUUID(),
        conversationId: activeConversationId,
        sender: "agent",
        text,
        createdAt: new Date().toISOString()
      };
      setMessages((prev) => [...prev, optimistic]);
      await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          conversationId: activeConversationId,
          message: text,
          siteId: "dashboard"
        })
      });
    },
    [activeConversationId]
  );

  useEffect(() => {
    loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    loadMessages();
  }, [activeConversationId, loadMessages]);

  return {
    conversations,
    messages,
    activeConversationId,
    loading,
    selectConversation: setActiveConversationId,
    reload: loadConversations,
    sendMessage
  };
}

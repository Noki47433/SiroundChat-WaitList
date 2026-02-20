"use client";

import type { ChatMessage } from "@/lib/types/core";
import { Button } from "@/components/ui/button";
import { useState } from "react";

interface ChatThreadProps {
  messages: ChatMessage[];
  onSend: (message: string) => Promise<void> | void;
  loading?: boolean;
}

export function ChatThread({ messages, onSend, loading }: ChatThreadProps) {
  const [text, setText] = useState("");

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!text.trim()) return;
    await onSend(text.trim());
    setText("");
  };

  return (
    <div className="flex h-full flex-1 flex-col">
      <div className="flex-1 space-y-3 overflow-y-auto rounded-3xl border border-white/5 bg-white/5 p-4">
        {messages.map((message) => {
          const isAgent = message.sender === "agent" || message.sender === "owner";
          return (
            <div key={message.id} className={`flex ${isAgent ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-lg rounded-2xl px-4 py-2 text-sm ${
                  isAgent ? "bg-[#00A3FF] text-white" : "bg-white text-neutral-900"
                }`}
              >
                {message.text}
              </div>
            </div>
          );
        })}
        {messages.length === 0 ? <p className="text-center text-sm text-white/60">No messages yet.</p> : null}
      </div>
      <form onSubmit={handleSubmit} className="mt-4 flex gap-3">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          placeholder="Reply as a human agent..."
          className="flex-1 rounded-2xl border border-white/10 bg-neutral-900/70 px-4 py-3 text-sm text-white"
        />
        <Button type="submit" disabled={loading || !text.trim()}>
          Send
        </Button>
      </form>
    </div>
  );
}

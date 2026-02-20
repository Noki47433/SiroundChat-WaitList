import { randomUUID } from "crypto";
import type { Database } from "@/lib/db/schema";

export const DEMO_CONVERSATION_ID = "demo-conversation";

const demoConversation: Database["public"]["Tables"]["chat_conversations"]["Row"] = {
  id: DEMO_CONVERSATION_ID,
  business_id: "demo-business",
  site_id: "demo-site",
  user_name: "Zana Q.",
  user_email: "zana@example.com",
  is_lead: true,
  should_prompt_feedback: false,
  feedback_prompted_at: null,
  followup_prompted_at: null,
  takeover_enabled: false,
  takeover_by: null,
  takeover_at: null,
  takeover_ended_at: null,
  created_at: new Date(Date.now() - 1000 * 60 * 45).toISOString()
};

const baseMessages: Database["public"]["Tables"]["chat_messages"]["Row"][] = [
  {
    id: "demo-msg-1",
    conversation_id: DEMO_CONVERSATION_ID,
    sender: "user",
    message_text: "Hi, can SiroundChat build a site in Albanian?",
    created_at: new Date(Date.now() - 1000 * 60 * 44).toISOString()
  },
  {
    id: "demo-msg-2",
    conversation_id: DEMO_CONVERSATION_ID,
    sender: "ai",
    message_text: "Absolutely! We support Albanian (and English) sites and chatbots out of the box.",
    created_at: new Date(Date.now() - 1000 * 60 * 43).toISOString()
  }
];

const messageStore = new Map<string, Database["public"]["Tables"]["chat_messages"]["Row"][]>([
  [DEMO_CONVERSATION_ID, [...baseMessages]]
]);

export const listDemoConversations = () => [demoConversation];

export const getDemoMessages = (conversationId: string) => {
  return (messageStore.get(conversationId) ?? []).map((message) => ({ ...message }));
};

export const addDemoMessage = (
  conversationId: string,
  sender: "ai" | "agent" | "user" | "owner",
  message_text: string
) => {
  const next: Database["public"]["Tables"]["chat_messages"]["Row"] = {
    id: randomUUID(),
    conversation_id: conversationId,
    sender,
    message_text,
    created_at: new Date().toISOString()
  };
  const existing = messageStore.get(conversationId) ?? [];
  messageStore.set(conversationId, [...existing, next]);
  return next;
};

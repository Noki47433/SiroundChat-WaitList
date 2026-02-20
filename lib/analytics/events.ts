import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/schema";

export const TRACK_EVENT_TYPES = [
  "widget_opened",
  "chat_opened",
  "first_message_sent",
  "conversation_started",
  "message_received",
  "intent_detected",
  "lead_created",
  "contact_intent_detected",
  "reservation_started",
  "reservation_failed",
  "fallback_occurred",
  "fallback_triggered",
  "bot_response_delayed",
  "topic_mentioned",
  "reservation_created"
] as const;

export type TrackEventType = (typeof TRACK_EVENT_TYPES)[number];

export type AnalyticsEventType = TrackEventType | "owner_message_sent";

export type AnalyticsEventInput = {
  businessId: string;
  siteId?: string | null;
  type: AnalyticsEventType;
  sessionId?: string | null;
  url?: string | null;
  metadata?: Record<string, unknown> | null;
};

export async function insertAnalyticsEvent(
  client: SupabaseClient<Database>,
  input: AnalyticsEventInput
) {
  const payload = {
    business_id: input.businessId,
    site_id: input.siteId ?? null,
    type: input.type,
    session_id: input.sessionId ?? null,
    url: input.url ?? null,
    timestamp: new Date().toISOString(),
    metadata: input.metadata ?? {}
  };

  const { error } = await (client as any).from("analytics_events").insert(payload);
  if (error) {
    throw error;
  }
}

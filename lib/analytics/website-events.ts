import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/db/schema";

export type WebsiteAnalyticsEventType =
  | "page_view"
  | "cta_click"
  | "lead_submitted"
  | "chat_open"
  | "chat_started"
  | "reservation_started"
  | "reservation_completed";

export type WebsiteAnalyticsChannel = "website" | "chatbot" | "form";

export type WebsiteAnalyticsEventInput = {
  businessId: string;
  siteId?: string | null;
  pagePath: string;
  pageTitle?: string | null;
  eventType: WebsiteAnalyticsEventType;
  channel: WebsiteAnalyticsChannel;
  ctaType?: "call" | "whatsapp" | "email" | "directions" | "booking" | "other" | null;
  leadType?: "form" | "chat" | null;
  leadId?: string | null;
  sessionId: string;
  userAgent?: string | null;
  referrer?: string | null;
  countryCode?: string | null;
  city?: string | null;
  occurredAt?: string | null;
};

export async function insertWebsiteAnalyticsEvent(
  client: SupabaseClient<Database>,
  input: WebsiteAnalyticsEventInput
) {
  const payload = {
    business_id: input.businessId,
    site_id: input.siteId ?? null,
    page_path: input.pagePath,
    page_title: input.pageTitle ?? null,
    event_type: input.eventType,
    channel: input.channel,
    cta_type: input.ctaType ?? null,
    lead_type: input.leadType ?? null,
    lead_id: input.leadId ?? null,
    session_id: input.sessionId,
    user_agent: input.userAgent ?? null,
    referrer: input.referrer ?? null,
    country_code: input.countryCode ?? null,
    city: input.city ?? null,
    occurred_at: input.occurredAt ?? undefined
  };

  const { error } = await (client as any).from("website_analytics_events").insert(payload);
  if (error) {
    throw error;
  }
}

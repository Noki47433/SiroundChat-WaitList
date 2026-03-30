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

  if (input.eventType !== "page_view" || !input.sessionId) {
    return;
  }

  try {
    const occurredAt = input.occurredAt ? new Date(input.occurredAt) : new Date();
    if (Number.isNaN(occurredAt.getTime())) {
      return;
    }

    const dayStart = new Date(Date.UTC(occurredAt.getUTCFullYear(), occurredAt.getUTCMonth(), occurredAt.getUTCDate()));
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000);

    const { count, error: countError } = await (client as any)
      .from("website_analytics_events")
      .select("id", { count: "exact", head: true })
      .eq("business_id", input.businessId)
      .eq("event_type", "page_view")
      .eq("session_id", input.sessionId)
      .gte("occurred_at", dayStart.toISOString())
      .lt("occurred_at", dayEnd.toISOString());

    if (countError || count !== 1) {
      if (countError) {
        console.error("[WEBSITE_ANALYTICS_VISITOR_COUNT_ERROR]", countError);
      }
      return;
    }

    const { error: metricsError } = await (client as any).rpc("bump_daily_metrics", {
      target_business_id: input.businessId,
      target_day: dayStart.toISOString().slice(0, 10),
      conv_inc: 0,
      msg_inc: 0,
      ai_msg_inc: 0,
      human_msg_inc: 0,
      lead_inc: 0,
      visitor_inc: 1,
      tokens_in_inc: 0,
      tokens_out_inc: 0,
      cost_inc: 0
    });

    if (metricsError) {
      console.error("[WEBSITE_ANALYTICS_VISITOR_METRICS_ERROR]", metricsError);
    }
  } catch (error) {
    console.error("[WEBSITE_ANALYTICS_VISITOR_ENRICHMENT_ERROR]", error);
  }
}

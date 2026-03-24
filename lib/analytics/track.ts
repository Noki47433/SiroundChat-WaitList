export type WebsiteEventType =
  | "page_view"
  | "cta_click"
  | "lead_submitted"
  | "chat_open"
  | "chat_started"
  | "reservation_started"
  | "reservation_completed";
export type WebsiteEventChannel = "website" | "chatbot" | "form";
export type WebsiteCtaType = "call" | "whatsapp" | "email" | "directions" | "booking" | "other";
export type WebsiteLeadType = "form" | "chat";

export type TrackEventPayload = {
  businessId?: string;
  widgetKey?: string;
  siteId?: string | null;
  pagePath: string;
  pageTitle?: string | null;
  eventType: WebsiteEventType;
  channel: WebsiteEventChannel;
  ctaType?: WebsiteCtaType | null;
  leadType?: WebsiteLeadType | null;
  leadId?: string | null;
  sessionId?: string;
  referrer?: string | null;
};

const SESSION_KEY = "sc_session_id";

const safeRandomId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `sc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

export function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const next = safeRandomId();
    window.localStorage.setItem(SESSION_KEY, next);
    return next;
  } catch {
    return "";
  }
}

export function trackEvent(payload: TrackEventPayload) {
  if (typeof window === "undefined") return;
  const sessionId = payload.sessionId ?? getOrCreateSessionId();
  if (!sessionId) return;

  const body = JSON.stringify({
    ...payload,
    sessionId,
    referrer: payload.referrer ?? (document.referrer || undefined)
  });

  try {
    if (navigator.sendBeacon) {
      navigator.sendBeacon("/api/analytics/ingest", body);
      return;
    }

    fetch("/api/analytics/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body
    }).catch(() => {});
  } catch {
    // swallow
  }
}

export function trackPageView(params: {
  businessId?: string;
  widgetKey?: string;
  siteId?: string | null;
  pagePath: string;
  pageTitle?: string | null;
  referrer?: string | null;
}) {
  trackEvent({
    businessId: params.businessId,
    widgetKey: params.widgetKey,
    siteId: params.siteId ?? null,
    pagePath: params.pagePath,
    pageTitle: params.pageTitle ?? null,
    eventType: "page_view",
    channel: "website",
    referrer: params.referrer
  });
}

export function trackCtaClick(params: {
  businessId?: string;
  widgetKey?: string;
  siteId?: string | null;
  pagePath: string;
  pageTitle?: string | null;
  ctaType?: WebsiteCtaType | null;
  channel?: WebsiteEventChannel;
  referrer?: string | null;
}) {
  trackEvent({
    businessId: params.businessId,
    widgetKey: params.widgetKey,
    siteId: params.siteId ?? null,
    pagePath: params.pagePath,
    pageTitle: params.pageTitle ?? null,
    eventType: "cta_click",
    channel: params.channel ?? "website",
    ctaType: params.ctaType ?? "other",
    referrer: params.referrer
  });
}

export function trackLeadSubmitted(params: {
  businessId?: string;
  widgetKey?: string;
  siteId?: string | null;
  pagePath: string;
  pageTitle?: string | null;
  leadType: WebsiteLeadType;
  leadId?: string | null;
  referrer?: string | null;
}) {
  trackEvent({
    businessId: params.businessId,
    widgetKey: params.widgetKey,
    siteId: params.siteId ?? null,
    pagePath: params.pagePath,
    pageTitle: params.pageTitle ?? null,
    eventType: "lead_submitted",
    channel: params.leadType === "chat" ? "chatbot" : "form",
    leadType: params.leadType,
    leadId: params.leadId ?? null,
    referrer: params.referrer
  });
}

export function trackReservationEvent(params: {
  businessId?: string;
  widgetKey?: string;
  siteId?: string | null;
  pagePath: string;
  pageTitle?: string | null;
  eventType: "reservation_started" | "reservation_completed";
  referrer?: string | null;
}) {
  trackEvent({
    businessId: params.businessId,
    widgetKey: params.widgetKey,
    siteId: params.siteId ?? null,
    pagePath: params.pagePath,
    pageTitle: params.pageTitle ?? null,
    eventType: params.eventType,
    channel: "form",
    referrer: params.referrer
  });
}

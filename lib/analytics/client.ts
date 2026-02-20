type EventName =
  | "widget_opened"
  | "conversation_started"
  | "message_received"
  | "lead_created"
  | "contact_intent_detected"
  | "fallback_occurred"
  | "topic_mentioned"
  | "reservation_created";

const endpoint = "/api/analytics/track";
const widgetOpenedEndpoint = "/api/analytics/widget-opened";

function sendEvent(event: {
  type: EventName;
  widgetKey: string;
  sessionId: string;
  url?: string;
  metadata?: Record<string, unknown>;
  conversationId?: string;
  messageId?: string;
}) {
  const body = JSON.stringify({
    widget_key: event.widgetKey,
    type: event.type,
    session_id: event.sessionId,
    url: event.url,
    metadata: event.metadata,
    conversation_id: event.conversationId,
    message_id: event.messageId
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon(endpoint, body);
    return;
  }

  fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body
  }).catch(() => {});
}

function sendWidgetOpenedEvent(event: {
  key: string;
  siteId?: string | null;
  sessionId?: string | null;
  pagePath?: string | null;
  referrer?: string | null;
}) {
  const body = JSON.stringify({
    key: event.key,
    siteId: event.siteId ?? null,
    sessionId: event.sessionId ?? null,
    pagePath: event.pagePath ?? null,
    referrer: event.referrer ?? null
  });

  if (navigator.sendBeacon) {
    navigator.sendBeacon(widgetOpenedEndpoint, body);
    return;
  }

  fetch(widgetOpenedEndpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body
  }).catch(() => {});
}

const getSessionId = () => {
  const key = "siroundchat_session_id";
  const existing = window.sessionStorage.getItem(key);
  if (existing) {
    return existing;
  }
  const id = crypto.randomUUID();
  window.sessionStorage.setItem(key, id);
  return id;
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

export const analytics = {
  track(type: EventName, widgetKey: string, metadata?: Record<string, unknown>) {
    if (typeof window === "undefined") return;
    sendEvent({
      type,
      widgetKey,
      sessionId: getSessionId(),
      url: window.location.href,
      metadata
    });
  },
  trackWidgetOpened(widgetKey: string, siteId?: string | null) {
    if (typeof window === "undefined") return;
    const sessionId = getSessionId();
    const dedupeKey = `siroundchat_widget_opened:${widgetKey}`;
    if (window.sessionStorage.getItem(dedupeKey) === sessionId) return;
    window.sessionStorage.setItem(dedupeKey, sessionId);
    sendWidgetOpenedEvent({
      key: widgetKey,
      siteId: siteId ?? null,
      sessionId,
      pagePath: resolveWidgetPagePath(),
      referrer: document.referrer || null
    });
  }
};

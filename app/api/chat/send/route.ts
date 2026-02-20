import { randomUUID } from "crypto";
import { SYSTEM_PROMPT, UNKNOWN_REPLY } from "@/lib/ai/system-prompt";
import { NextResponse } from "next/server";
import { z } from "zod";
import OpenAI from "openai";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { insertAnalyticsEvent } from "@/lib/analytics/events";
import { insertWebsiteAnalyticsEvent } from "@/lib/analytics/website-events";
import {
  extractLeadInfo,
  isAskingForBusinessContactInfo,
  isProvidingContactInfo,
  normalizeText
} from "@/lib/notifications/detectors";
import { awardBadgeIfNew, createNotificationIfNotExists } from "@/lib/notifications/engine";
import { log } from "@/lib/utils/log";
import { getTimeZoneOffsetMs } from "@/lib/utils/timezone";
import { getWorkspaceSubscription } from "@/src/billing/getSubscription";
import { hasEntitlement, resolveEntitlements } from "@/src/billing/entitlements";
import { runChatbotOrchestrator } from "@/lib/chatbot/orchestrator";
import { scheduleReservationFollowups } from "@/lib/automations/scheduler";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";
const EMBEDDING_MODEL = "text-embedding-3-small"; // 1536 dims (matches vector(1536))
const ANALYTICS_DEBUG = process.env.ANALYTICS_DEBUG === "1";

export const runtime = "nodejs";

const TonePresetSchema = z.enum(["professional", "friendly", "luxury", "short_direct", "energetic"]);

const BodySchema = z.object({
  // widget key (preferred) or sometimes siteId fallback
  key: z.string().uuid(),
  siteId: z.string().optional().nullable(),

  message: z.string().min(1),
  tonePreset: TonePresetSchema.optional().nullable(),

  conversationId: z.string().uuid().optional().nullable(),
  name: z.string().optional().nullable(),
  email: z.string().optional().nullable(),
  phone: z.string().optional().nullable(),
  pagePath: z.string().optional().nullable(),
  referrer: z.string().optional().nullable(),
  sessionId: z.string().optional().nullable()
});

function toText(v: unknown) {
  if (typeof v === "string") return v;
  return "";
}

function toRole(sender: unknown): "user" | "assistant" {
  if (sender === "assistant" || sender === "owner" || sender === "ai" || sender === "agent") {
    return "assistant";
  }
  return "user";
}

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_REGEX = /(\+?\d[\d\s().-]{6,}\d)/;
const NAME_PATTERNS: RegExp[] = [
  /\bmy name is\s+([a-z][a-z'\- ]{1,60})/i,
  /\bi am\s+([a-z][a-z'\- ]{1,60})/i,
  /\bi'm\s+([a-z][a-z'\- ]{1,60})/i,
  /\bthis is\s+([a-z][a-z'\- ]{1,60})/i,
  /\bname:\s*([a-z][a-z'\- ]{1,60})/i
];

const normalizePhone = (value: string) => value.replace(/[^\d+]/g, "");

const isGratitudeMessage = (message: string) => {
  const normalized = normalizeText(message);
  if (!normalized) return false;
  if (GRATITUDE_NEGATIONS.some((phrase) => normalized.includes(phrase))) return false;
  return GRATITUDE_PHRASES.some((phrase) => normalized.includes(phrase));
};

const detectInterestFollowup = (message: string) => {
  const normalized = normalizeText(message);
  if (!normalized) return null;
  const tokens = new Set(normalized.split(" ").filter(Boolean));
  for (const intent of INTEREST_FOLLOWUPS) {
    const matched = intent.phrases.some((phrase) => {
      if (phrase.includes(" ")) return normalized.includes(phrase);
      return tokens.has(phrase);
    });
    if (matched) return intent;
  }
  return null;
};

const pickFirstNonEmpty = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return null;
};

const normalizePagePath = (value?: string | null, referrer?: string | null) => {
  const raw = value?.trim() || "";
  if (raw) {
    if (raw.startsWith("/")) return raw;
    try {
      return new URL(raw).pathname || "/";
    } catch {
      return `/${raw}`;
    }
  }
  if (referrer) {
    try {
      return new URL(referrer).pathname || "/";
    } catch {
      return "/";
    }
  }
  return "/";
};

const normalizeCountryCode = (value: string | null) => {
  if (!value) return null;
  const trimmed = value.trim().toUpperCase();
  if (!trimmed || trimmed === "XX" || trimmed === "UNKNOWN") return null;
  return trimmed.slice(0, 2);
};

type ReservationMode = "none" | "collecting" | "ready_to_confirm" | "submitted";

type ReservationState = {
  mode: ReservationMode;
  name: string | null;
  phone: string | null;
  email: string | null;
  date: string | null;
  time: string | null;
  party_size: number | null;
  notes: string | null;
  last_prompt: string | null;
  confirmed: boolean | null;
  reservation_id: string | null;
};

const DEFAULT_RESERVATION_STATE: ReservationState = {
  mode: "none",
  name: null,
  phone: null,
  email: null,
  date: null,
  time: null,
  party_size: null,
  notes: null,
  last_prompt: null,
  confirmed: null,
  reservation_id: null
};

const RESERVATION_TRIGGER_PHRASES = ["book a table"];
const RESERVATION_TRIGGER_WORDS = ["reservation", "reserve", "book", "appointment", "termin", "rezervo"];
const RESERVATION_CANCEL_WORDS = ["cancel", "never mind", "nevermind", "stop"];
const YES_WORDS = ["yes", "yep", "yeah", "ok", "okay", "confirm", "sure", "po"];
const NO_WORDS = ["no", "nope", "cancel", "stop", "jo"];
const ALBANIAN_TAKEOVER_HINTS = ["rezervo", "termin", "numri", "kontakti", "kontakt", "telefon", "whatsapp", "instagram"];
const GRATITUDE_PHRASES = ["thanks", "thank you", "thx", "ty", "appreciate it", "appreciate you"];
const GRATITUDE_NEGATIONS = ["no thanks", "not thanks", "no thank you"];

const INTEREST_FOLLOWUPS = [
  {
    intent: "reservation",
    phrases: ["reservation", "book", "table", "availability"],
    question: "Do you want to make a reservation?"
  },
  {
    intent: "menu_pricing",
    phrases: ["menu", "price", "prices", "cost", "pricing"],
    question: "Do you want our menu prices?"
  }
];

const OFFER_INTENT_PHRASES = [
  "buy one get one",
  "special offer",
  "special deal",
  "limited time",
  "limited offer"
];
const OFFER_INTENT_WORDS = [
  "offer",
  "offers",
  "deal",
  "deals",
  "discount",
  "promo",
  "promotion",
  "special",
  "coupon",
  "bogo",
  "ofert",
  "oferta"
];

type UpsellReplyAction = {
  type: "show_offer";
  offerId: string;
  title: string;
  description: string;
  price: string | null;
  cta: string;
};

const extractUpsellAction = (actions: Array<Record<string, unknown>>): UpsellReplyAction | null => {
  for (const action of actions) {
    if (action?.type !== "show_offer") continue;
    const title = typeof action.title === "string" ? action.title.trim() : "";
    const description = typeof action.description === "string" ? action.description.trim() : "";
    if (!title || !description) continue;
    return {
      type: "show_offer",
      offerId: typeof action.offerId === "string" ? action.offerId : "",
      title,
      description,
      price: typeof action.price === "string" ? action.price.trim() : null,
      cta: typeof action.cta === "string" && action.cta.trim() ? action.cta.trim() : "Would you like to add it?"
    };
  }
  return null;
};

const buildUpsellReply = (action: UpsellReplyAction) => {
  const pricePart = action.price ? ` (${action.price})` : "";
  const descriptionText =
    action.description.endsWith(".") || action.description.endsWith("!") || action.description.endsWith("?")
      ? action.description
      : `${action.description}.`;
  const ctaText =
    action.cta.endsWith(".") || action.cta.endsWith("!") || action.cta.endsWith("?") ? action.cta : `${action.cta}?`;
  return `No wayyy, yes! We have ${action.title}${pricePart}. ${descriptionText} ${ctaText}`;
};

const isOfferIntent = (normalizedMessage: string, messageTokens: Set<string>) => {
  if (!normalizedMessage) return false;
  if (OFFER_INTENT_PHRASES.some((phrase) => normalizedMessage.includes(phrase))) return true;
  return OFFER_INTENT_WORDS.some((keyword) => messageTokens.has(keyword));
};

const REQUIRED_RESERVATION_FIELDS: Array<keyof ReservationState> = ["name", "date", "time", "phone"];

const pad2 = (value: number) => value.toString().padStart(2, "0");

const sanitizeReservationState = (state: unknown): ReservationState => {
  if (!state || typeof state !== "object") return { ...DEFAULT_RESERVATION_STATE };
  const next = { ...DEFAULT_RESERVATION_STATE, ...(state as Record<string, unknown>) };
  return {
    ...next,
    mode:
      next.mode === "collecting" || next.mode === "ready_to_confirm" || next.mode === "submitted"
        ? next.mode
        : "none"
  };
};

const isReservationIntent = (message: string, state: ReservationState) => {
  if (state.mode === "collecting" || state.mode === "ready_to_confirm") return true;
  const normalized = normalizeText(message);
  if (!normalized) return false;

  for (const phrase of RESERVATION_TRIGGER_PHRASES) {
    if (normalized.includes(phrase)) return true;
  }

  const tokens = new Set(normalized.split(" ").filter(Boolean));
  return RESERVATION_TRIGGER_WORDS.some((word) => tokens.has(word));
};

const isCancelIntent = (message: string) => {
  const normalized = normalizeText(message);
  if (!normalized) return false;
  return RESERVATION_CANCEL_WORDS.some((word) => normalized.includes(word));
};

const isConfirmYes = (message: string) => {
  const normalized = normalizeText(message);
  if (!normalized) return false;
  return YES_WORDS.some((word) => normalized === word || normalized.includes(` ${word}`) || normalized.startsWith(`${word} `));
};

const isConfirmNo = (message: string) => {
  const normalized = normalizeText(message);
  if (!normalized) return false;
  return NO_WORDS.some((word) => normalized === word || normalized.includes(` ${word}`) || normalized.startsWith(`${word} `));
};

const looksLikeName = (value: string) => /^[a-zA-Z][a-zA-Z' - ]{1,60}$/.test(value.trim());

const extractName = (message: string, allowLoose: boolean) => {
  for (const pattern of NAME_PATTERNS) {
    const match = message.match(pattern);
    if (match?.[1]) {
      return match[1].trim();
    }
  }

  if (!allowLoose) return null;
  const trimmed = message.trim();
  if (!looksLikeName(trimmed)) return null;
  const parts = trimmed.split(/\s+/).filter(Boolean);
  return parts.length >= 2 && parts.length <= 4 ? trimmed : null;
};

const extractEmail = (message: string) => {
  const match = message.match(EMAIL_REGEX);
  return match ? match[0].trim() : null;
};

const extractPhone = (message: string) => {
  const match = message.match(PHONE_REGEX);
  if (!match?.[0]) return null;
  const normalized = normalizePhone(match[0].trim());
  return normalized.replace(/\D/g, "").length >= 7 ? normalized : null;
};

const extractPartySize = (message: string) => {
  const match = message.match(/\b([1-9]|[1-4]\d|50)\b/);
  if (!match?.[1]) return null;
  return Number(match[1]);
};

const extractDate = (message: string) => {
  const isoMatch = message.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (!isoMatch) return null;

  const year = Number(isoMatch[1]);
  const month = Number(isoMatch[2]);
  const day = Number(isoMatch[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;

  const parsed = new Date(Date.UTC(year, month - 1, day));
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() + 1 !== month ||
    parsed.getUTCDate() !== day
  ) {
    return null;
  }

  return `${year}-${pad2(month)}-${pad2(day)}`;
};

const extractTime = (message: string) => {
  const twentyFour = message.match(/\b([01]?\d|2[0-3]):([0-5]\d)\b/);
  if (twentyFour) {
    return `${pad2(Number(twentyFour[1]))}:${twentyFour[2]}`;
  }

  const twelveHour = message.match(/\b(1[0-2]|0?[1-9])\s?(am|pm)\b/i);
  if (twelveHour) {
    let hour = Number(twelveHour[1]);
    const period = twelveHour[2].toLowerCase();
    if (period === "pm" && hour < 12) hour += 12;
    if (period === "am" && hour === 12) hour = 0;
    return `${pad2(hour)}:00`;
  }

  return null;
};

const buildReservationDateTime = (date: string, time: string, timeZone: string) => {
  const [year, month, day] = date.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  if (!year || !month || !day || Number.isNaN(hour) || Number.isNaN(minute)) {
    return null;
  }
  const utc = new Date(Date.UTC(year, month - 1, day, hour, minute, 0));
  const offset = getTimeZoneOffsetMs(utc, timeZone);
  return new Date(utc.getTime() - offset).toISOString();
};

const summarizeReservation = (state: ReservationState) => {
  const parts: string[] = [];
  if (state.name) parts.push(`Name: ${state.name}`);
  if (state.date && state.time) parts.push(`When: ${state.date} ${state.time}`);
  if (state.phone) parts.push(`Phone: ${state.phone}`);
  if (state.party_size) parts.push(`Party size: ${state.party_size}`);
  if (state.email) parts.push(`Email: ${state.email}`);
  if (state.notes) parts.push(`Notes: ${state.notes}`);
  return parts.join(" • ");
};

const getMissingReservationField = (state: ReservationState) =>
  REQUIRED_RESERVATION_FIELDS.find((field) => !state[field]);

const promptForField = (field: keyof ReservationState) => {
  switch (field) {
    case "name":
      return "Great - what name should I put the reservation under?";
    case "date":
      return "What date would you like to reserve? (YYYY-MM-DD)";
    case "time":
      return "What time should I reserve? (e.g., 19:30)";
    case "phone":
      return "What phone number can we reach you at?";
    default:
      return "What details should I add?";
  }
};

const getTakeoverReply = (message: string) => {
  const normalized = normalizeText(message);
  const isAlbanian = ALBANIAN_TAKEOVER_HINTS.some((hint) => normalized.includes(hint));
  if (isAlbanian) {
    return "Një anëtar i biznesit do të përgjigjet shumë shpejt.";
  }
  return "A team member will reply here shortly.";
};

// Manual test checklist:
// 1) Start widget chat, send "I want a reservation", complete flow, confirm yes.
// 2) Verify a new row exists in reservations and /dashboard/reservations shows it.
// 3) Open /dashboard/conversations/<id>, enable takeover, send a widget message.
// 4) Verify bot pauses (banner + canned reply) and owner messages appear realtime.
// 5) Disable takeover and confirm bot replies resume.
// 6) Open the widget once; verify widget_opened logs (deduped within 10 minutes).
// 7) Send "My name is Arber. My phone is +38344111222" -> lead_created + lead notification, no contact intent.
// 8) Send "What's your phone number?" -> contact_intent + notification, no lead.

export async function POST(req: Request) {
  try {
    if (!process.env.OPENAI_API_KEY) {
      return NextResponse.json({ error: "Missing OPENAI_API_KEY" }, { status: 500 });
    }

    const json = await req.json().catch(() => null);
    const parsed = BodySchema.safeParse(json);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const requestStartMs = Date.now();

    const { searchParams } = new URL(req.url);
    const debug = searchParams.get("debug") === "1";

    const supabase = getSupabaseRouteClient();
    const {
      data: { user }
    } = await supabase.auth.getUser();

    const canDebug = debug && !!user;

    const body = parsed.data;
    const admin = getSupabaseAdminClient();
    let resolvedWebsiteSiteId: string | null = null;
    let resolvedBuilderSiteId: string | null = null;
    const safeInsertAnalyticsEvent = async (label: string, payload: Parameters<typeof insertAnalyticsEvent>[1]) => {
      try {
        await insertAnalyticsEvent(admin as any, { ...payload, siteId: resolvedWebsiteSiteId ?? null });
      } catch (error) {
        log("error", label, { error });
      }
    };
    const safeInsertWebsiteEvent = async (
      label: string,
      payload: Parameters<typeof insertWebsiteAnalyticsEvent>[1]
    ) => {
      try {
        await insertWebsiteAnalyticsEvent(admin as any, { ...payload, siteId: resolvedBuilderSiteId ?? null });
      } catch (error) {
        log("error", label, { error });
      }
    };
    const hasEventForConversation = async (params: {
      businessId: string;
      type: string;
      conversationId: string;
      intent?: string;
    }) => {
      const metadataFilter = params.intent
        ? { conversation_id: params.conversationId, intent: params.intent }
        : { conversation_id: params.conversationId };
      const { data, error } = await (admin as any)
        .from("analytics_events")
        .select("id")
        .eq("business_id", params.businessId)
        .eq("type", params.type)
        .contains("metadata", metadataFilter)
        .limit(1);

      if (error) {
        log("error", "Failed to check analytics event dedupe", { error });
        return false;
      }

      return Boolean(data?.length);
    };
    const hasConversationFeedback = async (conversationIdToCheck: string) => {
      const { data, error } = await (admin as any)
        .from("conversation_feedback")
        .select("id")
        .eq("conversation_id", conversationIdToCheck)
        .limit(1);

      if (error) {
        log("error", "Failed to check conversation feedback", { error });
        return false;
      }

      return Boolean(data?.length);
    };
    const insertEventOnce = async (params: {
      businessId: string;
      siteId: string | null;
      type: string;
      conversationId?: string | null;
      messageId?: string | null;
      reservationId?: string | null;
      intent?: string | null;
      extra?: Record<string, unknown>;
    }) => {
      const metadata: Record<string, unknown> = { ...(params.extra ?? {}) };
      if (params.conversationId) metadata.conversation_id = params.conversationId;
      if (params.messageId) metadata.message_id = params.messageId;
      if (params.reservationId) metadata.reservation_id = params.reservationId;
      if (params.intent) metadata.intent = params.intent;

      const shouldDedupe =
        (params.type === "first_message_sent" ||
          params.type === "reservation_started" ||
          params.type === "intent_detected") &&
        Boolean(params.conversationId) &&
        (params.type !== "intent_detected" || Boolean(params.intent));

      if (shouldDedupe) {
        const exists = await hasEventForConversation({
          businessId: params.businessId,
          type: params.type,
          conversationId: params.conversationId as string,
          intent: params.intent ?? undefined
        });
        if (exists) return;
      }

      await safeInsertAnalyticsEvent(`Failed to log ${params.type} event`, {
        businessId: params.businessId,
        siteId: params.siteId ?? null,
        type: params.type as any,
        metadata
      });
    };

    // 1) Validate widget key -> get businessId
    const { data: bizRows, error: bizErr, count } = await (admin as any)
      .from("businesses")
      .select("id, business_name, industry, timezone", { count: "exact" })
      .eq("widget_key", body.key);

    if (bizErr) {
      return NextResponse.json({ error: bizErr.message }, { status: 500 });
    }

    const bizCount = count ?? bizRows?.length ?? 0;
    if (bizCount > 1) {
      return NextResponse.json({ error: "Duplicate widget key" }, { status: 409 });
    }

    const biz = bizRows?.[0];
    if (!biz?.id) {
      return NextResponse.json({ error: "Widget not found" }, { status: 404 });
    }

    const businessId = biz.id as string;
    const subscription = await getWorkspaceSubscription(businessId);
    const entitlements = resolveEntitlements(subscription.plan_id);
    if (!hasEntitlement(entitlements, "chatbot")) {
      return NextResponse.json({ error: "Chatbot is not available on the current plan" }, { status: 403 });
    }

    const businessName = toText(biz.business_name) || "this business";
    const businessTimeZone = toText(biz.timezone) || "Europe/Belgrade";
    const resolvedPagePath = normalizePagePath(body.pagePath ?? null, body.referrer ?? null);
    const resolvedSessionId = body.sessionId ?? randomUUID();
    const userAgent = req.headers.get("user-agent");
    const countryCode = normalizeCountryCode(
      req.headers.get("x-vercel-ip-country") ?? req.headers.get("cf-ipcountry") ?? req.headers.get("x-country-code")
    );
    const city =
      req.headers.get("x-vercel-ip-city") ??
      req.headers.get("cf-ipcity") ??
      req.headers.get("x-city") ??
      null;

    if (body.siteId) {
      const { data: websiteRow, error: websiteError } = await (admin as any)
        .from("websites")
        .select("id")
        .eq("id", body.siteId)
        .maybeSingle();
      if (websiteError) {
        log("error", "Failed to resolve websites.site_id", { error: websiteError });
      } else {
        resolvedWebsiteSiteId = websiteRow?.id ?? null;
      }

      const { data: builderRow, error: builderError } = await (admin as any)
        .from("builder_sites")
        .select("id")
        .eq("id", body.siteId)
        .maybeSingle();
      if (builderError) {
        log("error", "Failed to resolve builder_sites.site_id", { error: builderError });
      } else {
        resolvedBuilderSiteId = builderRow?.id ?? null;
      }
    }

    const maybeTrackResponseDelay = async (
      elapsedMs: number,
      conversationIdForEvent: string,
      metadata?: Record<string, unknown>
    ) => {
      if (elapsedMs < 5000) return;
      await insertEventOnce({
        businessId,
        siteId: resolvedWebsiteSiteId ?? null,
        type: "bot_response_delayed",
        conversationId: conversationIdForEvent,
        extra: { ms: elapsedMs, ...(metadata ?? {}) }
      });
    };

    // 2) Create conversation if needed
    let conversationId = body.conversationId ?? null;
    let isNewConversation = false;

    if (conversationId) {
      const { data: existingConversation, error: existingConversationError } = await (admin as any)
        .from("chat_conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("business_id", businessId)
        .maybeSingle();

      if (existingConversationError) {
        return NextResponse.json({ error: existingConversationError.message }, { status: 500 });
      }

      if (!existingConversation?.id) {
        conversationId = null;
      }
    }

    if (!conversationId) {
      const { data: convo, error: convoErr } = await (admin as any)
        .from("chat_conversations")
        .insert({
          business_id: businessId,
          site_id: resolvedWebsiteSiteId ?? null,
          user_name: body.name ?? null,
          user_email: body.email ?? null,
          is_lead: !!(body.email || body.phone)
        })
        .select("id")
        .single();

      if (convoErr) {
        return NextResponse.json({ error: convoErr.message }, { status: 500 });
      }

      conversationId = convo.id;
      isNewConversation = true;
    }

    if (!conversationId) {
      return NextResponse.json({ error: "Conversation not initialized" }, { status: 500 });
    }

    if (isNewConversation) {
      try {
        await safeInsertAnalyticsEvent("Failed to log conversation_started event", {
          businessId,
          siteId: body.siteId ?? null,
          type: "conversation_started",
          metadata: { conversation_id: conversationId }
        });

        const { count: conversationCount } = await (admin as any)
          .from("chat_conversations")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId);

        if (conversationCount && conversationCount >= 1) {
          await awardBadgeIfNew(businessId, "first_conversation", { conversation_id: conversationId });
        }
        if (conversationCount && conversationCount >= 50) {
          await awardBadgeIfNew(businessId, "fifty_conversations", { conversation_id: conversationId });
        }
        if (conversationCount && conversationCount >= 100) {
          await awardBadgeIfNew(businessId, "hundred_conversations", { conversation_id: conversationId });
        }
      } catch (error) {
        log("error", "Failed to handle conversation start badges", { error });
      }
    }

    // 3) Store user message
    const { data: userMessage, error: msgErr } = await (admin as any)
      .from("chat_messages")
      .insert({
        conversation_id: conversationId,
        sender: "user",
        message_text: body.message
      })
      .select("id")
      .single();

    if (msgErr || !userMessage) {
      return NextResponse.json({ error: msgErr?.message ?? "Failed to save message" }, { status: 500 });
    }

    const messageId = userMessage.id as string;

    await safeInsertAnalyticsEvent("Failed to log message_received event", {
      businessId,
      siteId: body.siteId ?? null,
      type: "message_received",
      metadata: { conversation_id: conversationId, message_id: messageId }
    });

    const { count: userMessageCount, error: userMessageCountError } = await (admin as any)
      .from("chat_messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversationId)
      .eq("sender", "user");

    if (userMessageCountError) {
      log("error", "Failed to count user messages", { error: userMessageCountError });
    } else if (userMessageCount === 1) {
      await insertEventOnce({
        businessId,
        siteId: body.siteId ?? null,
        type: "first_message_sent",
        conversationId,
        messageId
      });
      await safeInsertWebsiteEvent("Failed to log chat_started website event", {
        businessId,
        siteId: body.siteId ?? null,
        pagePath: resolvedPagePath,
        pageTitle: null,
        eventType: "chat_started",
        channel: "chatbot",
        sessionId: resolvedSessionId,
        referrer: body.referrer ?? null,
        userAgent,
        countryCode,
        city
      });
    }

    const feedbackAlreadySubmitted = await hasConversationFeedback(conversationId);
    const gratitudeMatched = isGratitudeMessage(body.message);
    if (gratitudeMatched && !feedbackAlreadySubmitted) {
      await (admin as any)
        .from("chat_conversations")
        .update({ should_prompt_feedback: true })
        .eq("id", conversationId);
    }

    const extractedLead = extractLeadInfo(body.message);
    const leadName = pickFirstNonEmpty(body.name, extractedLead.name);
    const leadEmail = pickFirstNonEmpty(body.email, extractedLead.email);
    const leadPhone = pickFirstNonEmpty(body.phone, extractedLead.phone);
    const hasContactDetails = Boolean(leadEmail || leadPhone);
    const providedContactInfo = hasContactDetails || isProvidingContactInfo(body.message);
    const askedForBusinessContact = isAskingForBusinessContactInfo(body.message);

    if (ANALYTICS_DEBUG) {
      log("info", "Lead/contact detection", {
        conversationId,
        hasContactDetails,
        providedContactInfo,
        askedForBusinessContact,
        leadNamePresent: Boolean(leadName),
        leadEmailPresent: Boolean(leadEmail),
        leadPhonePresent: Boolean(leadPhone)
      });
    }

    if (hasContactDetails) {
      try {
        const { data: existingLead } = await (admin as any)
          .from("leads")
          .select("id, name, email, phone")
          .eq("conversation_id", conversationId)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();

        let leadId: string | null = existingLead?.id ?? null;
        let insertedLead = false;
        let addedContact = false;

        if (!existingLead) {
          const emailFallbackName = leadEmail ? leadEmail.split("@")[0] : "";
          const leadNameValue = leadName?.trim() || emailFallbackName.trim() || "Website visitor";
          const { data: lead, error: leadErr } = await (admin as any)
            .from("leads")
            .insert({
              business_id: businessId,
              conversation_id: conversationId,
              name: leadNameValue,
              email: leadEmail ?? null,
              phone: leadPhone ?? null,
              source: "siroundchat"
            })
            .select("id")
            .single();

          if (leadErr || !lead) {
            if (leadErr?.code === "23505") {
              const { data: retryLead } = await (admin as any)
                .from("leads")
                .select("id")
                .eq("conversation_id", conversationId)
                .order("created_at", { ascending: true })
                .limit(1)
                .maybeSingle();
              if (retryLead?.id) {
                leadId = retryLead.id as string;
              } else {
                log("error", "Failed to recover duplicate lead insert", { error: leadErr });
              }
            } else {
              log("error", "Failed to persist lead from chat", { error: leadErr });
            }
          } else {
            leadId = lead.id as string;
            insertedLead = true;
          }
        } else {
          const updatePayload: Record<string, string> = {};
          const willAddContact = Boolean(
            (!existingLead.email && leadEmail) || (!existingLead.phone && leadPhone)
          );

          if (!existingLead.name && leadName) {
            updatePayload.name = leadName;
          }
          if (!existingLead.email && leadEmail) {
            updatePayload.email = leadEmail;
          }
          if (!existingLead.phone && leadPhone) {
            updatePayload.phone = leadPhone;
          }

          if (Object.keys(updatePayload).length) {
            const { error: updateError } = await (admin as any)
              .from("leads")
              .update(updatePayload)
              .eq("id", existingLead.id);

            if (updateError) {
              log("error", "Failed to update lead from chat", { error: updateError });
            } else if (willAddContact) {
              addedContact = true;
            }
          }

          leadId = existingLead.id as string;
        }

        const conversationUpdate: Record<string, unknown> = {};
        if (leadId) {
          conversationUpdate.is_lead = true;
        }
        if (leadName) {
          conversationUpdate.user_name = leadName;
        }
        if (leadEmail) {
          conversationUpdate.user_email = leadEmail;
        }
        if (Object.keys(conversationUpdate).length) {
          await (admin as any).from("chat_conversations").update(conversationUpdate).eq("id", conversationId);
        }

        const shouldLogLeadEvent = Boolean(leadId && (insertedLead || addedContact));
        if (leadId && shouldLogLeadEvent) {
          await safeInsertAnalyticsEvent("Failed to log lead_created event", {
            businessId,
            siteId: body.siteId ?? null,
            type: "lead_created",
            metadata: { conversation_id: conversationId, lead_id: leadId }
          });
          await safeInsertWebsiteEvent("Failed to log lead_submitted website event", {
            businessId,
            siteId: body.siteId ?? null,
            pagePath: resolvedPagePath,
            pageTitle: null,
            eventType: "lead_submitted",
            channel: "chatbot",
            leadType: "chat",
            leadId,
            sessionId: resolvedSessionId,
            referrer: body.referrer ?? null,
            userAgent,
            countryCode,
            city
          });

          const detailParts = [
            leadName ? `Name: ${leadName}` : null,
            leadEmail ? `Email: ${leadEmail}` : null,
            leadPhone ? `Phone: ${leadPhone}` : null
          ].filter(Boolean);

          await createNotificationIfNotExists(
            businessId,
            {
              title: "✅ New lead captured",
              body: detailParts.length ? detailParts.join(" • ") : "A new lead was captured from your chat.",
              severity: "success",
              category: "revenue",
              cta_label: "View lead",
              cta_url: "/dashboard/leads",
              data: { conversation_id: conversationId, lead_id: leadId }
            },
            "lead",
            insertedLead ? `lead:${leadId}:created` : `lead:${leadId}:contact-added`
          );

          await awardBadgeIfNew(businessId, "first_lead", { lead_id: leadId });

          const { count: leadsLast30Days } = await (admin as any)
            .from("leads")
            .select("id", { count: "exact", head: true })
            .eq("business_id", businessId)
            .gte("created_at", new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString());

          if (leadsLast30Days && leadsLast30Days >= 10) {
            await awardBadgeIfNew(businessId, "ten_leads_month", { lead_id: leadId });
          }
        }
      } catch (error) {
        log("error", "Failed to handle lead capture from chat", { error });
      }
    }

    const normalizedMessage = normalizeText(body.message);
    const messageTokens = normalizedMessage ? new Set(normalizedMessage.split(" ").filter(Boolean)) : new Set<string>();
    const messageKeywords = new Set(Array.from(messageTokens).filter((token) => token.length > 2));

    if (messageTokens.size) {
      const { data: topicRows, error: topicsError } = await (admin as any)
        .from("business_topics")
        .select("topic, keywords")
        .eq("business_id", businessId)
        .eq("enabled", true);

      if (topicsError) {
        log("error", "Failed to load business topics", { error: topicsError });
      } else if (topicRows?.length) {
        const matchedTopics = new Set<string>();

        (topicRows as Array<{ topic: string; keywords: string[] | null }>).forEach((row) => {
          const topicLabel = toText(row.topic);
          if (!topicLabel) return;

          const terms = [topicLabel, ...(row.keywords ?? [])];
          for (const term of terms) {
            const normalizedTerm = normalizeText(toText(term));
            if (!normalizedTerm) continue;
            const isPhrase = normalizedTerm.includes(" ");
            if (isPhrase && normalizedMessage.includes(normalizedTerm)) {
              matchedTopics.add(topicLabel);
              break;
            }
            if (!isPhrase && messageTokens.has(normalizedTerm)) {
              matchedTopics.add(topicLabel);
              break;
            }
          }
        });

        if (matchedTopics.size) {
          const { data: existingTopicRows, error: existingTopicError } = await (admin as any)
            .from("analytics_events")
            .select("metadata")
            .eq("business_id", businessId)
            .eq("type", "topic_mentioned")
            .filter("metadata->>message_id", "eq", messageId);

          if (existingTopicError) {
            log("error", "Failed to check existing topic events", { error: existingTopicError });
          }

          const existingTopics = new Set<string>();
          (existingTopicRows ?? []).forEach((row: any) => {
            const topic = row?.metadata?.topic;
            if (typeof topic === "string") {
              existingTopics.add(topic);
            }
          });

          const topicsToInsert = Array.from(matchedTopics).filter((topic) => !existingTopics.has(topic));
          if (topicsToInsert.length) {
            await Promise.all(
              topicsToInsert.map((topic) =>
                safeInsertAnalyticsEvent("Failed to log topic_mentioned event", {
                  businessId,
                  siteId: body.siteId ?? null,
                  type: "topic_mentioned",
                  metadata: { topic, conversation_id: conversationId, message_id: messageId }
                })
              )
            );
          }
        }
      }
    }

    if (askedForBusinessContact && !providedContactInfo) {
      try {
        await safeInsertAnalyticsEvent("Failed to log contact_intent_detected event", {
          businessId,
          siteId: body.siteId ?? null,
          type: "contact_intent_detected",
          metadata: { conversation_id: conversationId, message_id: messageId }
        });
        await insertEventOnce({
          businessId,
          siteId: body.siteId ?? null,
          type: "intent_detected",
          conversationId,
          messageId,
          intent: "contact"
        });

        await createNotificationIfNotExists(
          businessId,
          {
            title: "🔥 Someone asked for your contact info!",
            body: "A visitor asked how to reach you. Reply fast — they might become a customer.",
            severity: "critical",
            category: "revenue",
            cta_label: "Open conversation",
            cta_url: `/dashboard/conversations/${conversationId}`,
            data: { conversation_id: conversationId }
          },
          "contact_intent",
          messageId
        );

        await awardBadgeIfNew(businessId, "first_contact_intent", { conversation_id: conversationId });
      } catch (error) {
        log("error", "Failed to handle contact intent", { error });
      }
    }

    const { data: takeoverRow, error: takeoverError } = await (admin as any)
      .from("chat_conversations")
      .select("takeover_enabled, should_prompt_feedback, followup_prompted_at")
      .eq("id", conversationId)
      .maybeSingle();

    if (takeoverError) {
      log("error", "Failed to load takeover status", { error: takeoverError });
    }

    const takeoverEnabled = Boolean(takeoverRow?.takeover_enabled);
    const shouldPromptFeedback = Boolean(takeoverRow?.should_prompt_feedback);
    const followupPromptedAt = takeoverRow?.followup_prompted_at
      ? new Date(takeoverRow.followup_prompted_at)
      : null;
    if (takeoverEnabled) {
      return NextResponse.json({
        reply: getTakeoverReply(body.message),
        conversationId,
        takeover: true,
        userMessageId: messageId
      });
    }

    const consumeFeedbackPrompt = async (assistantMessageIdValue: string | null) => {
      if (!assistantMessageIdValue) return false;
      if (!shouldPromptFeedback || feedbackAlreadySubmitted) return false;
      await (admin as any)
        .from("chat_conversations")
        .update({ should_prompt_feedback: false, feedback_prompted_at: new Date().toISOString() })
        .eq("id", conversationId);
      return true;
    };

    let reservationState = { ...DEFAULT_RESERVATION_STATE };
    const { data: reservationRow, error: reservationError } = await (admin as any)
      .from("conversation_reservation_state")
      .select("state")
      .eq("conversation_id", conversationId)
      .maybeSingle();

    if (reservationError) {
      log("error", "Failed to load reservation state", { error: reservationError });
    } else if (reservationRow?.state) {
      reservationState = sanitizeReservationState(reservationRow.state);
    }

    let orchestratorActions: Array<Record<string, unknown>> = [];
    let orchestratorReply: string | null = null;
    let orchestratorCustomerId: string | null = null;

    try {
      const orchestratorResult = await runChatbotOrchestrator(admin as any, {
        businessId,
        conversationId,
        message: body.message,
        customerSignals: {
          name: body.name ?? null,
          email: body.email ?? null,
          phone: body.phone ?? null,
          channel: "web_chat"
        },
        reservationContext: {
          partySize: reservationState.party_size,
          time: reservationState.time
        }
      });

      orchestratorActions = orchestratorResult.actions as Array<Record<string, unknown>>;
      orchestratorReply = orchestratorResult.assistantMessage;
      orchestratorCustomerId = orchestratorResult.customer?.id ?? null;
    } catch (error) {
      log("warn", "Orchestrator execution failed in chat route", { error, conversationId });
    }

    const orchestratorUpsell = extractUpsellAction(orchestratorActions);
    const askedForOffer = isOfferIntent(normalizedMessage, messageTokens);

    const inReservationFlow = isReservationIntent(body.message, reservationState);
    const reservationFlowStarting =
      inReservationFlow && (reservationState.mode === "none" || reservationState.mode === "submitted");
    if (inReservationFlow) {
      let reply = "";
      let assistantMessageId: string | null = null;

      if (reservationFlowStarting) {
        await insertEventOnce({
          businessId,
          siteId: body.siteId ?? null,
          type: "intent_detected",
          conversationId,
          messageId,
          intent: "reservation"
        });
        await insertEventOnce({
          businessId,
          siteId: body.siteId ?? null,
          type: "reservation_started",
          conversationId,
          messageId
        });
      }

      if (reservationState.mode === "none") {
        reservationState = { ...DEFAULT_RESERVATION_STATE, mode: "collecting" };
      }
      if (reservationState.mode === "submitted") {
        reservationState = { ...DEFAULT_RESERVATION_STATE, mode: "collecting" };
      }

      if (isCancelIntent(body.message)) {
        reservationState = { ...DEFAULT_RESERVATION_STATE, mode: "none" };
        reply = "No problem - I won't create a reservation.";
      } else if (reservationState.mode === "ready_to_confirm") {
        if (isConfirmYes(body.message)) {
          if (reservationState.date && reservationState.time && reservationState.name && reservationState.phone) {
            const datetimeIso = buildReservationDateTime(
              reservationState.date,
              reservationState.time,
              businessTimeZone
            );

            if (!datetimeIso) {
              reservationState.mode = "collecting";
              reservationState.last_prompt = "date";
              reply = "I couldn't read the date/time. What date would you like to reserve? (YYYY-MM-DD)";
            } else {
              const { data: reservation, error: reservationInsertError } = await (admin as any)
                .from("reservations")
                .insert({
                  business_id: businessId,
                  conversation_id: conversationId,
                  customer_name: reservationState.name,
                  customer_phone: reservationState.phone,
                  customer_email: reservationState.email ?? null,
                  party_size: reservationState.party_size ?? null,
                  datetime: datetimeIso,
                  notes: reservationState.notes ?? null,
                  status: "pending"
                })
                .select("id")
                .single();

              if (reservationInsertError || !reservation) {
                log("error", "Failed to create reservation", { error: reservationInsertError });
                await insertEventOnce({
                  businessId,
                  siteId: body.siteId ?? null,
                  type: "reservation_failed",
                  conversationId,
                  messageId,
                  extra: { reason: reservationInsertError?.message ?? "insert_failed" }
                });
                reply = "Sorry - I couldn't submit that reservation. Please try again.";
              } else {
                reservationState.mode = "submitted";
                reservationState.confirmed = true;
                reservationState.reservation_id = reservation.id as string;
                reservationState.last_prompt = null;

                await insertEventOnce({
                  businessId,
                  siteId: body.siteId ?? null,
                  type: "reservation_created",
                  conversationId,
                  reservationId: reservation.id as string
                });

                await insertEventOnce({
                  businessId,
                  siteId: body.siteId ?? null,
                  type: "reservation_completed",
                  conversationId,
                  reservationId: reservation.id as string
                });

                try {
                  await scheduleReservationFollowups(
                    admin as any,
                    {
                      id: reservation.id as string,
                      business_id: businessId,
                      conversation_id: conversationId,
                      customer_name: reservationState.name,
                      datetime: datetimeIso
                    },
                    orchestratorCustomerId
                  );
                } catch (followupError) {
                  log("error", "Failed to schedule reservation followups", {
                    error: followupError,
                    reservationId: reservation.id
                  });
                }

                const detailParts = [
                  reservationState.name ? `Name: ${reservationState.name}` : null,
                  reservationState.date && reservationState.time
                    ? `When: ${reservationState.date} ${reservationState.time}`
                    : null,
                  reservationState.party_size ? `Party size: ${reservationState.party_size}` : null
                ].filter(Boolean);

                await createNotificationIfNotExists(
                  businessId,
                  {
                    title: "🎉 New reservation request",
                    body: detailParts.length
                      ? detailParts.join(" • ")
                      : "A new reservation request was created.",
                    severity: "celebration",
                    category: "ops",
                    cta_label: "View reservations",
                    cta_url: "/dashboard/reservations",
                    data: { conversation_id: conversationId }
                  },
                  "reservation",
                  reservation.id as string
                );

                reply = "Thanks! Your reservation request is submitted. We'll confirm shortly.";
              }
            }
          } else {
            reservationState.mode = "collecting";
            const missingField = getMissingReservationField(reservationState);
            reservationState.last_prompt = missingField ?? null;
            reply = promptForField(missingField ?? "name");
          }
        } else if (isConfirmNo(body.message)) {
          reservationState = { ...DEFAULT_RESERVATION_STATE, mode: "none" };
          reply = "No problem - I won't submit it.";
        } else {
          reply = "Please reply Yes or No to confirm.";
        }
      } else {
        const lastPrompt = reservationState.last_prompt;
        const allowLooseName = lastPrompt === "name";
        let invalidDateInput = false;

        if (lastPrompt === "name") {
          const name = extractName(body.message, allowLooseName);
          if (name) reservationState.name = reservationState.name ?? name;
        } else if (lastPrompt === "date") {
          const date = extractDate(body.message);
          if (date) {
            reservationState.date = reservationState.date ?? date;
          } else if (!reservationState.date) {
            invalidDateInput = true;
          }
        } else if (lastPrompt === "time") {
          const time = extractTime(body.message);
          if (time) reservationState.time = reservationState.time ?? time;
        } else if (lastPrompt === "phone") {
          const phone = extractPhone(body.message);
          if (phone) reservationState.phone = reservationState.phone ?? phone;
        } else if (lastPrompt === "email") {
          const email = extractEmail(body.message);
          if (email) reservationState.email = reservationState.email ?? email;
        } else if (lastPrompt === "party_size") {
          const partySize = extractPartySize(body.message);
          if (partySize) reservationState.party_size = reservationState.party_size ?? partySize;
        } else {
          if (!reservationState.name) {
            const name = extractName(body.message, false);
            if (name) reservationState.name = name;
          }
          if (!reservationState.date) {
            const date = extractDate(body.message);
            if (date) reservationState.date = date;
          }
          if (!reservationState.time) {
            const time = extractTime(body.message);
            if (time) reservationState.time = time;
          }
          if (!reservationState.phone) {
            const phone = extractPhone(body.message);
            if (phone) reservationState.phone = phone;
          }
        }

        if (invalidDateInput) {
          reservationState.mode = "collecting";
          reservationState.last_prompt = "date";
          reply = "Please enter a date in YYYY-MM-DD format.";
        } else {
          const missingField = getMissingReservationField(reservationState);
          if (missingField) {
            reservationState.mode = "collecting";
            reservationState.last_prompt = missingField ?? null;
            reply = promptForField(missingField);
          } else {
            reservationState.mode = "ready_to_confirm";
            reservationState.last_prompt = "confirm";
            reply = `${summarizeReservation(reservationState)}\nConfirm? (Yes/No)`;
          }
        }
      }

      await (admin as any)
        .from("conversation_reservation_state")
        .upsert(
          { conversation_id: conversationId, business_id: businessId, state: reservationState },
          { onConflict: "conversation_id" }
        );

      const { data: assistantMessage, error: assistantErr } = await (admin as any)
        .from("chat_messages")
        .insert({
          conversation_id: conversationId,
          sender: "assistant",
          message_text: reply
        })
        .select("id")
        .single();

      if (assistantErr) {
        log("error", "Failed to persist assistant message", { error: assistantErr });
      }

      assistantMessageId = assistantMessage?.id ? String(assistantMessage.id) : null;

      await maybeTrackResponseDelay(Date.now() - requestStartMs, conversationId);

      const promptFeedback = await consumeFeedbackPrompt(assistantMessageId);

      return NextResponse.json({
        reply,
        conversationId,
        userMessageId: messageId,
        assistantMessageId,
        promptFeedback,
        actions: orchestratorActions
      });
    }

    if (orchestratorReply) {
      let replyFromOrchestrator = orchestratorReply;
      if (orchestratorUpsell) {
        const upsellReply = buildUpsellReply(orchestratorUpsell);
        if (askedForOffer || replyFromOrchestrator.includes(UNKNOWN_REPLY)) {
          replyFromOrchestrator = upsellReply;
        } else if (!normalizeText(replyFromOrchestrator).includes(normalizeText(orchestratorUpsell.title))) {
          replyFromOrchestrator = `${replyFromOrchestrator}\n\n${upsellReply}`;
        }
      }

      const { data: assistantMessage, error: assistantErr } = await (admin as any)
        .from("chat_messages")
        .insert({
          conversation_id: conversationId,
          sender: "assistant",
          message_text: replyFromOrchestrator
        })
        .select("id")
        .single();

      if (assistantErr) {
        log("error", "Failed to persist orchestrator assistant message", { error: assistantErr });
      }

      const assistantMessageId = assistantMessage?.id ? String(assistantMessage.id) : null;
      const promptFeedback = await consumeFeedbackPrompt(assistantMessageId);
      await maybeTrackResponseDelay(Date.now() - requestStartMs, conversationId);

      return NextResponse.json({
        reply: replyFromOrchestrator,
        conversationId,
        userMessageId: messageId,
        assistantMessageId,
        promptFeedback,
        actions: orchestratorActions
      });
    }

    // 4) Embed query
    const embedRes = await openai.embeddings.create({
      model: EMBEDDING_MODEL,
      input: body.message
    });

    const queryEmbedding = embedRes.data?.[0]?.embedding;
    if (!queryEmbedding || !Array.isArray(queryEmbedding)) {
      return NextResponse.json({ error: "Embedding failed" }, { status: 500 });
    }

    // 5) Retrieve chunks
    const fetchMatches = async () => {
      const primary = await (admin as any).rpc("match_document_chunks", {
        query_embedding: queryEmbedding,
        match_business_id: businessId,
        match_count: 5
      });

      if (!primary.error) return primary;

      const fallback = await (admin as any).rpc("match_document_chunks", {
        query_embedding: queryEmbedding,
        business: businessId,
        match_count: 5
      });

      if (!fallback.error) return fallback;
      return primary;
    };

    const { data: matches, error: matchErr } = await fetchMatches();
    if (matchErr) {
      log("error", "Chunk retrieval failed", { error: matchErr });
    }

    const chunks = (matchErr ? [] : matches ?? []) as Array<{
      chunk_id: string;
      content: string;
      similarity: number;
    }>;

    // Build context
    const contextParts: string[] = [];
    let contextLength = 0;

    for (let i = 0; i < chunks.length; i++) {
      const sim = typeof chunks[i].similarity === "number" ? chunks[i].similarity.toFixed(3) : "0.000";
      const content = toText(chunks[i].content);
      const snippet = `Snippet ${i + 1} (similarity ${sim}):\n${content}`;
      if (contextLength + snippet.length > 6000) break;
      contextParts.push(snippet);
      contextLength += snippet.length;
    }

    const context = contextParts.join("\n\n");

    let faqContext = "";
    if (messageKeywords.size) {
      const { data: faqRows, error: faqError } = await (admin as any)
        .from("business_faq_items")
        .select("question, answer")
        .eq("business_id", businessId)
        .order("created_at", { ascending: false })
        .limit(20);

      if (faqError) {
        log("error", "Failed to load FAQ items", { error: faqError });
      } else if (faqRows?.length) {
        const faqContextParts: string[] = [];
        let faqContextLength = 0;
        let faqIndex = 1;

        for (const row of faqRows as Array<{ question: string; answer: string }>) {
          const question = toText(row.question);
          const answer = toText(row.answer);
          if (!question || !answer) continue;

          const questionTokens = normalizeText(question)
            .split(" ")
            .filter((token) => token.length > 2);
          const answerTokens = normalizeText(answer)
            .split(" ")
            .filter((token) => token.length > 2);

          const isRelevant =
            questionTokens.some((token) => messageKeywords.has(token)) ||
            answerTokens.some((token) => messageKeywords.has(token));

          if (!isRelevant) continue;

          const snippet = `FAQ ${faqIndex}:\nQ: ${question}\nA: ${answer}`;
          if (faqContextLength + snippet.length > 2000) break;
          faqContextParts.push(snippet);
          faqContextLength += snippet.length;
          faqIndex += 1;
          if (faqContextParts.length >= 6) break;
        }

        faqContext = faqContextParts.join("\n\n");
      }
    }

    // 6) Chat
    const systemPrompt = SYSTEM_PROMPT(businessName, body.tonePreset ?? undefined);

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
      { role: "system", content: context ? `Context:\n${context}` : "Context:\n(No matching context found.)" }
    ];

    if (faqContext) {
      messages.push({ role: "system", content: `FAQ context:\n${faqContext}` });
    }

    // Load recent conversation history so the assistant has memory.
    const { data: historyRows, error: historyErr } = await (admin as any)
      .from("chat_messages")
      .select("sender, message_text, created_at")
      .eq("conversation_id", conversationId)
      .order("created_at", { ascending: false })
      .limit(12);

    if (historyErr) {
      log("error", "Failed to load chat history", { error: historyErr });
    }

    const history = (historyRows ?? [])
      .slice()
      .reverse()
      .map((row: any) => ({
        role: toRole(row.sender),
        content: toText(row.message_text).trim()
      }))
      .filter((m: any) => m.content.length > 0);

    messages.push(...history);

    let reply = UNKNOWN_REPLY;

    // IMPORTANT: only call the model if you have context (keeps your strict “don’t guess business facts” rule)
    if (context || faqContext) {
      const completion = await openai.chat.completions.create({
        model: CHAT_MODEL,
        temperature: 0.2,
        messages
      });

      reply = completion.choices?.[0]?.message?.content?.trim() || UNKNOWN_REPLY;
    }

    if (orchestratorUpsell) {
      const upsellReply = buildUpsellReply(orchestratorUpsell);
      if (askedForOffer || reply.includes(UNKNOWN_REPLY)) {
        reply = upsellReply;
      } else if (!normalizeText(reply).includes(normalizeText(orchestratorUpsell.title))) {
        reply = `${reply}\n\n${upsellReply}`;
      }
    }

    const followupCandidate = !followupPromptedAt ? detectInterestFollowup(body.message) : null;
    let appendedFollowup = false;
    if (followupCandidate) {
      reply = `${reply}\n\n${followupCandidate.question}`;
      appendedFollowup = true;
    }

    // 7) Store assistant reply
    const { data: assistantMessage, error: assistantErr } = await (admin as any)
      .from("chat_messages")
      .insert({
        conversation_id: conversationId,
        sender: "assistant",
        message_text: reply
      })
      .select("id")
      .single();

    if (assistantErr) {
      log("error", "Failed to persist assistant message", { error: assistantErr });
    }

    const assistantMessageId = assistantMessage?.id ? String(assistantMessage.id) : null;

    if (appendedFollowup) {
      await (admin as any)
        .from("chat_conversations")
        .update({ followup_prompted_at: new Date().toISOString() })
        .eq("id", conversationId);
    }

    if (reply.includes(UNKNOWN_REPLY)) {
      try {
        await safeInsertAnalyticsEvent("Failed to log fallback_occurred event", {
          businessId,
          siteId: body.siteId ?? null,
          type: "fallback_occurred",
          metadata: {
            conversation_id: conversationId,
            message_id: assistantMessageId ?? messageId
          }
        });
        await insertEventOnce({
          businessId,
          siteId: body.siteId ?? null,
          type: "fallback_triggered",
          conversationId,
          messageId: assistantMessageId ?? messageId
        });

        const { count: fallbackCount } = await (admin as any)
          .from("analytics_events")
          .select("id", { count: "exact", head: true })
          .eq("business_id", businessId)
          .eq("type", "fallback_occurred")
          .gte("timestamp", new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString());

        if (fallbackCount && fallbackCount >= 5) {
          const windowKey = new Date().toISOString().slice(0, 10);
          await createNotificationIfNotExists(
            businessId,
            {
              title: "Customers are asking questions your bot can’t answer",
              body: "We detected multiple unanswered questions in the last 24h. Add missing info to improve conversions.",
              severity: "warning",
              category: "quality",
              cta_label: "Improve bot knowledge",
              cta_url: "/dashboard/documents",
              data: {}
            },
            "fallback_threshold_24h",
            windowKey
          );
        }
      } catch (error) {
        log("error", "Failed to handle fallback notification", { error });
      }
    }

    const promptFeedback = await consumeFeedbackPrompt(assistantMessageId);

    // 8) Response (debug sources only for authed dashboard)
    const response: {
      reply: string;
      conversationId: string;
      userMessageId: string;
      assistantMessageId: string | null;
      promptFeedback?: boolean;
      actions?: Array<Record<string, unknown>>;
      sources?: Array<{ chunkId: string; similarity: number; preview: string }>;
    } = {
      reply,
      conversationId,
      userMessageId: messageId,
      assistantMessageId,
      promptFeedback,
      actions: orchestratorActions
    };

    if (canDebug) {
      response.sources = chunks.map((c) => ({
        chunkId: c.chunk_id,
        similarity: c.similarity,
        preview: toText(c.content).slice(0, 200)
      }));
    }

    await maybeTrackResponseDelay(Date.now() - requestStartMs, conversationId);

    return NextResponse.json(response);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

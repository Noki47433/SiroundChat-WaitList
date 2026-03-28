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
import { getBusinessEntitlementAccess } from "@/lib/server/billing-access";
import { runChatbotOrchestrator } from "@/lib/chatbot/orchestrator";
import { scheduleReservationFollowups } from "@/lib/automations/scheduler";
import {
  findBlockingRulesForDate,
  findOccasionClosureRules,
  listApprovedUpdateRules,
  selectRelevantUpdateRules,
  type ChatbotUpdateRuleRow
} from "@/lib/chatbot/update-info";
import {
  buildSiroundChatDemoSystemPrompt,
  getSiroundChatDemoFallbackReply,
  getSiroundChatDemoReply,
  isSiroundChatDemoBot
} from "@/lib/chatbot/siroundchat-demo";

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

const resolveSmallTalkReply = (message: string) => {
  const normalized = normalizeText(message);
  if (!normalized) return null;

  const tokens = new Set(normalized.split(" ").filter(Boolean));
  const isAlbanian = detectChatLocale(message) === "sq";

  const isGreeting =
    ["hello", "hi", "hey", "yo", "sup"].some((token) => tokens.has(token)) ||
    ["pershendetje", "tung", "tungjatjeta", "mirdita", "hej"].some((token) => tokens.has(token));

  const isHowAreYou =
    normalized.includes("how are you") ||
    normalized.includes("si je") ||
    normalized.includes("si jeni") ||
    normalized.includes("qysh je") ||
    normalized.includes("cka po bon");

  if (!isGreeting && !isHowAreYou) return null;

  if (isAlbanian) {
    if (isHowAreYou) return "Mirë jam. Si mund të të ndihmoj sot?";
    return "Përshëndetje. Si mund të të ndihmoj sot?";
  }

  if (isHowAreYou) return "I'm good. How can I help you today?";
  return "Hey. How can I help you today?";
};

const resolveLanguageSwitchReply = (message: string) => {
  const normalized = normalizeText(message);
  if (!normalized) return null;

  if (
    normalized.includes("fol shqip") ||
    normalized.includes("flit shqip") ||
    normalized.includes("shqip ju lutem") ||
    normalized.includes("speak albanian") ||
    normalized.includes("reply in albanian")
  ) {
    return {
      locale: "sq" as const,
      reply: "Po, po flas shqip. Si mund të të ndihmoj?"
    };
  }

  if (
    normalized.includes("fol anglisht") ||
    normalized.includes("flit anglisht") ||
    normalized.includes("speak english") ||
    normalized.includes("reply in english")
  ) {
    return {
      locale: "en" as const,
      reply: "Sure, I'll speak English. How can I help you?"
    };
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

type ReservationMode = "none" | "collecting" | "choosing_slot" | "ready_to_confirm" | "submitted";
type ReservationLocale = "en" | "sq";

type ReservationSlotOption = {
  time: string;
  start_at_iso: string;
};

type SuggestedReservationOption = ReservationSlotOption & {
  date: string;
  label: string;
};

type SalesOpportunityKind = "menu" | "operational" | null;

type ReservationState = {
  mode: ReservationMode;
  locale: ReservationLocale;
  name: string | null;
  phone: string | null;
  email: string | null;
  date: string | null;
  time: string | null;
  party_size: number | null;
  notes: string | null;
  available_slots: ReservationSlotOption[] | null;
  selected_start_at_iso: string | null;
  last_prompt: string | null;
  blocked_date: string | null;
  blocked_reason: string | null;
  confirmed: boolean | null;
  reservation_id: string | null;
};

const DEFAULT_RESERVATION_STATE: ReservationState = {
  mode: "none",
  locale: "en",
  name: null,
  phone: null,
  email: null,
  date: null,
  time: null,
  party_size: null,
  notes: null,
  available_slots: null,
  selected_start_at_iso: null,
  last_prompt: null,
  blocked_date: null,
  blocked_reason: null,
  confirmed: null,
  reservation_id: null
};

const RESERVATION_TRIGGER_PHRASES = [
  "book a table",
  "make a reservation",
  "make a reseration",
  "table reservation"
];
const RESERVATION_TRIGGER_WORDS = [
  "reservation",
  "reseration",
  "reservtion",
  "reservim",
  "reserve",
  "book",
  "booking",
  "appointment",
  "termin",
  "rezervo",
  "rezervim",
  "rezervimi",
  "rezervime",
  "rezervoj"
];
const RESERVATION_CANCEL_WORDS = ["cancel", "never mind", "nevermind", "stop"];
const YES_WORDS = ["yes", "yep", "yeah", "ok", "okay", "confirm", "sure", "po"];
const NO_WORDS = ["no", "nope", "cancel", "stop", "jo"];
const ALBANIAN_TAKEOVER_HINTS = ["rezervo", "termin", "numri", "kontakti", "kontakt", "telefon", "whatsapp", "instagram"];
const ALBANIAN_CHAT_HINTS = [
  "a muj",
  "a mund",
  "me bo",
  "ni rezervim",
  "rezervim",
  "rezervoj",
  "rezervo",
  "per bajram",
  "bajram",
  "neser",
  "sot",
  "ora",
  "persona",
  "persona",
  "sa veta",
  "faleminderit"
];
const ALBANIAN_GENERAL_HINTS = [
  ...ALBANIAN_CHAT_HINTS,
  "pershendetje",
  "përshëndetje",
  "shqip",
  "fol shqip",
  "flit shqip",
  "hej",
  "si je",
  "si jeni",
  "qysh je",
  "qysh jeni",
  "a ka",
  "ndonje",
  "ndonjë",
  "ofert",
  "oferta",
  "cmim",
  "çmim",
  "qka",
  "qa",
  "kallzom",
  "porosit",
  "porosi",
  "kepurdh",
  "kërpudh",
  "alergj",
  "lokacion",
  "orari"
];
const ENGLISH_GENERAL_HINTS = [
  "hello",
  "hi",
  "hey",
  "how are you",
  "offer",
  "offers",
  "deal",
  "deals",
  "discount",
  "menu",
  "reservation",
  "book",
  "reserve",
  "location",
  "hours",
  "price",
  "prices"
];
const GRATITUDE_PHRASES = ["thanks", "thank you", "thx", "ty", "appreciate it", "appreciate you"];
const GRATITUDE_NEGATIONS = ["no thanks", "not thanks", "no thank you"];

const detectChatLocale = (message: string, current?: ReservationLocale | null): ReservationLocale => {
  const normalized = normalizeText(message);
  if (!normalized) return current ?? "en";

  const tokens = new Set(normalized.split(" ").filter(Boolean));
  const albanianScore =
    ALBANIAN_GENERAL_HINTS.filter((hint) => normalized.includes(hint)).length +
    ["hej", "si", "je", "jeni", "qysh", "muj", "mund", "rezervim", "rezervo", "ofert", "oferta", "bajram", "qa", "qka", "porosit", "kepurdha", "kallzom"].filter(
      (token) => tokens.has(token)
    ).length;
  const englishScore =
    ENGLISH_GENERAL_HINTS.filter((hint) => normalized.includes(hint)).length +
    ["hello", "hi", "hey", "how", "are", "offer", "offers", "deal", "menu", "book", "reserve", "location", "hours", "price"].filter(
      (token) => tokens.has(token)
    ).length;

  if (albanianScore > englishScore) return "sq";
  if (englishScore > albanianScore) return "en";
  return current ?? "en";
};

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

const detectReservationLocale = (message: string, current?: ReservationLocale | null): ReservationLocale => {
  if (current === "sq") return "sq";
  const normalized = normalizeText(message);
  if (!normalized) return current ?? "en";
  if (ALBANIAN_CHAT_HINTS.some((hint) => normalized.includes(hint))) return "sq";
  const tokens = new Set(normalized.split(" ").filter(Boolean));
  if (["muj", "mund", "rezervim", "bajram", "neser", "sot", "ora", "veta"].some((token) => tokens.has(token))) {
    return "sq";
  }
  return current ?? "en";
};

const MONTH_NAME_MAP: Record<string, number> = {
  january: 1,
  jan: 1,
  february: 2,
  feb: 2,
  march: 3,
  mar: 3,
  april: 4,
  apr: 4,
  may: 5,
  june: 6,
  jun: 6,
  july: 7,
  jul: 7,
  august: 8,
  aug: 8,
  september: 9,
  sept: 9,
  sep: 9,
  october: 10,
  oct: 10,
  november: 11,
  nov: 11,
  december: 12,
  dec: 12
};

type ReservationQuickReplyCommand =
  | { type: "change_date"; isoDate: string }
  | { type: "change_slot"; startAtIso: string }
  | { type: "change_date_prompt" }
  | null;

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
const OPERATIONAL_SELLING_PHRASES = [
  "where are you located",
  "what are your hours",
  "what time are you open",
  "how can i contact you",
  "where are you",
  "ku jeni",
  "ku gjindeni",
  "cili eshte lokacioni",
  "cili është lokacioni",
  "orari",
  "numri i telefonit"
];
const OPERATIONAL_SELLING_WORDS = [
  "location",
  "address",
  "hours",
  "open",
  "contact",
  "phone",
  "lokacion",
  "adresa",
  "orari",
  "kontakt",
  "telefon",
  "numri"
];

type UpsellReplyAction = {
  type: "show_offer";
  offerId: string;
  title: string;
  description: string;
  price: string | null;
  cta: string;
};

const DIETARY_INTENT_WORDS = [
  "allergy",
  "allergic",
  "allergies",
  "allergjik",
  "alergjik",
  "gluten",
  "vegan",
  "vegetarian",
  "halal",
  "mushroom",
  "mushrooms",
  "kepurdh",
  "këpurdh",
  "kërpudh",
  "pa",
  "without"
];

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

const localizeOfferCta = (locale: ReservationLocale) =>
  locale === "sq" ? "A don me e përdor këtë ofertë?" : "Would you like to use this offer?";

const buildOfferLeadReply = (locale: ReservationLocale) =>
  locale === "sq" ? "Po, kemi një ofertë aktive tani 👇" : "Yes, we have an active offer right now 👇";

const buildUpsellReply = (action: UpsellReplyAction, locale: ReservationLocale) => {
  const pricePart = action.price ? ` (${action.price})` : "";
  const descriptionText =
    action.description.endsWith(".") || action.description.endsWith("!") || action.description.endsWith("?")
      ? action.description
      : `${action.description}.`;
  const ctaText =
    action.cta.endsWith(".") || action.cta.endsWith("!") || action.cta.endsWith("?") ? action.cta : `${action.cta}?`;
  if (locale === "sq") {
    return `Po, kemi ${action.title}${pricePart}. ${descriptionText} ${ctaText}`;
  }
  return `Yes, we have ${action.title}${pricePart}. ${descriptionText} ${ctaText}`;
};

const isOfferIntent = (normalizedMessage: string, messageTokens: Set<string>) => {
  if (!normalizedMessage) return false;
  if (OFFER_INTENT_PHRASES.some((phrase) => normalizedMessage.includes(phrase))) return true;
  return OFFER_INTENT_WORDS.some((keyword) => messageTokens.has(keyword));
};

const isDietaryOrAllergyIntent = (normalizedMessage: string, messageTokens: Set<string>) => {
  if (!normalizedMessage) return false;
  if (
    normalizedMessage.includes("without mushrooms") ||
    normalizedMessage.includes("pa kepurdha") ||
    normalizedMessage.includes("pa kërpudha")
  ) {
    return true;
  }
  return DIETARY_INTENT_WORDS.some((keyword) => normalizedMessage.includes(keyword) || messageTokens.has(keyword));
};

const isOperationalSellingOpportunity = (message: string, normalizedMessage: string, messageTokens: Set<string>) => {
  if (isAskingForBusinessContactInfo(message)) return true;
  if (OPERATIONAL_SELLING_PHRASES.some((phrase) => normalizedMessage.includes(phrase))) return true;
  return OPERATIONAL_SELLING_WORDS.some((keyword) => messageTokens.has(keyword));
};

const buildSalesFollowup = (locale: ReservationLocale, rules: ChatbotUpdateRuleRow[]) => {
  const recommendationRule = rules.find((rule) => rule.category === "recommendation");
  if (recommendationRule) {
    return locale === "sq"
      ? `Edhe një sugjerim: ${recommendationRule.title} është një prej zgjedhjeve më të mira. Don me ta rekomandu më afër?`
      : `One quick recommendation: ${recommendationRule.title} is one of the best picks here. Want me to recommend it properly?`;
  }

  const offerRule = rules.find((rule) => rule.category === "offer");
  if (offerRule) {
    return locale === "sq"
      ? "Edhe diçka: kemi një ofertë aktive tani. Don me ta tregu?"
      : "One more thing: we have an active offer right now. Want me to show it to you?";
  }

  return null;
};

const MENU_SELLING_PHRASES = [
  "a boni pica",
  "a beni pica",
  "a keni pica",
  "do you have pizza",
  "do you make pizza",
  "what pizza",
  "pizza",
  "pica",
  "pasta",
  "menuja",
  "menu"
];

const MENU_SELLING_WORDS = [
  "pizza",
  "pica",
  "pasta",
  "menu",
  "menuja",
  "dish",
  "food",
  "meal",
  "porosit",
  "porosi",
  "ushqim"
];

const detectSalesOpportunityKind = (message: string, normalizedMessage: string, messageTokens: Set<string>): SalesOpportunityKind => {
  if (
    MENU_SELLING_PHRASES.some((phrase) => normalizedMessage.includes(phrase)) ||
    MENU_SELLING_WORDS.some((keyword) => messageTokens.has(keyword))
  ) {
    return "menu";
  }

  if (isOperationalSellingOpportunity(message, normalizedMessage, messageTokens)) {
    return "operational";
  }

  return null;
};

type CatalogPriceRow = {
  name: string;
  price: number | null;
  description?: string | null;
};

const PRICE_INTENT_PHRASES = [
  "what are your prices",
  "what are the prices",
  "menu prices",
  "price list",
  "how much",
  "how much is",
  "how much are",
  "sa kushton",
  "sa kushtojne",
  "sa kushtojnë",
  "sa jane cmimet",
  "sa janë çmimet",
  "cmimet",
  "çmimet"
];

const PRICE_INTENT_WORDS = ["price", "prices", "pricing", "cost", "cmim", "çmim", "cmimet", "çmimet"];

const isDirectPriceIntent = (normalizedMessage: string, messageTokens: Set<string>) =>
  PRICE_INTENT_PHRASES.some((phrase) => normalizedMessage.includes(phrase)) ||
  PRICE_INTENT_WORDS.some((keyword) => messageTokens.has(keyword));

const formatCatalogPrice = (price: number) => {
  if (Number.isInteger(price)) return `${price}`;
  return price.toFixed(2).replace(/\.00$/, "");
};

const buildCatalogPriceReply = (items: CatalogPriceRow[], locale: ReservationLocale = "en") => {
  const lines = items
    .filter((item) => typeof item.name === "string" && item.name.trim().length > 0 && typeof item.price === "number")
    .slice(0, 6)
    .map((item) => `- ${item.name} — €${formatCatalogPrice(item.price as number)}`);

  if (!lines.length) {
    return locale === "sq"
      ? "Për momentin nuk i kam çmimet e sakta të konfiguruara në sistem. Nëse don, mund të të ndihmoj me rezervim ose me sugjerime nga menuja."
      : "I don't have the exact menu prices configured right now. If you want, I can still help with a reservation or with menu recommendations.";
  }

  if (locale === "sq") {
    return `Po, këto janë disa prej çmimeve tona aktuale:\n${lines.join("\n")}\nNëse don, mund të ta sugjeroj edhe një zgjedhje të mirë ose të ta rezervoj një tavolinë.`;
  }

  return `Here are some of our current prices:\n${lines.join("\n")}\nIf you want, I can also recommend something good or reserve a table for you.`;
};

const buildProactiveSalesFollowup = (
  locale: ReservationLocale,
  kind: SalesOpportunityKind,
  rules: ChatbotUpdateRuleRow[]
) => {
  if (!kind) return null;

  const recommendationRule = rules.find((rule) => rule.category === "recommendation");
  const offerRule = rules.find((rule) => rule.category === "offer");

  if (kind === "menu") {
    const parts: string[] = [];
    if (recommendationRule) {
      parts.push(
        locale === "sq"
          ? `Ta rekomandoj edhe ${recommendationRule.title} si një zgjedhje shumë të mirë.`
          : `I’d also recommend ${recommendationRule.title} as a strong pick.`
      );
    }
    if (offerRule) {
      parts.push(
        locale === "sq"
          ? "Edhe një plus: për rezervime përmes chatbot-it kemi një ofertë aktive tani 👇"
          : "One more thing: we have an active offer for chatbot reservations right now 👇"
      );
    }
    parts.push(locale === "sq" ? "A don me ta rezervu një tavolinë?" : "Would you like me to reserve a table for you?");
    return parts.join(" ");
  }

  return buildSalesFollowup(locale, rules);
};

const REQUIRED_RESERVATION_FIELDS: Array<keyof ReservationState> = ["date", "time", "party_size", "name", "phone"];

const pad2 = (value: number) => value.toString().padStart(2, "0");

const localizeOccasionLabel = (label: string | null | undefined, locale: ReservationLocale) => {
  if (!label) return locale === "sq" ? "atë ditë" : "that day";
  const normalized = normalizeText(label);
  if (locale === "sq" && normalized === "eid") return "Bajram";
  return label;
};

const sanitizeReservationState = (state: unknown): ReservationState => {
  if (!state || typeof state !== "object") return { ...DEFAULT_RESERVATION_STATE };
  const next = { ...DEFAULT_RESERVATION_STATE, ...(state as Record<string, unknown>) };
  const rawSlots = Array.isArray((state as any).available_slots)
    ? ((state as any).available_slots as Array<Record<string, unknown>>)
    : [];
  const availableSlots = rawSlots
    .map((slot) => {
      if (!slot || typeof slot !== "object") return null;
      const time = typeof slot.time === "string" ? slot.time.trim() : "";
      const start_at_iso = typeof slot.start_at_iso === "string" ? slot.start_at_iso.trim() : "";
      if (!time || !start_at_iso) return null;
      return { time, start_at_iso };
    })
    .filter(Boolean) as ReservationSlotOption[];

  return {
    ...next,
    locale: next.locale === "sq" ? "sq" : "en",
    available_slots: availableSlots.length ? availableSlots : null,
    selected_start_at_iso:
      typeof next.selected_start_at_iso === "string" && next.selected_start_at_iso.trim()
        ? next.selected_start_at_iso
        : null,
    blocked_date: typeof next.blocked_date === "string" && next.blocked_date.trim() ? next.blocked_date : null,
    blocked_reason: typeof next.blocked_reason === "string" && next.blocked_reason.trim() ? next.blocked_reason : null,
    mode:
      next.mode === "collecting" ||
      next.mode === "choosing_slot" ||
      next.mode === "ready_to_confirm" ||
      next.mode === "submitted"
        ? next.mode
        : "none"
  };
};

const isReservationIntent = (message: string, state: ReservationState) => {
  if (state.mode === "collecting" || state.mode === "choosing_slot" || state.mode === "ready_to_confirm") return true;
  const normalized = normalizeText(message);
  if (!normalized) return false;

  for (const phrase of RESERVATION_TRIGGER_PHRASES) {
    if (normalized.includes(phrase)) return true;
  }

  const tokens = new Set(normalized.split(" ").filter(Boolean));
  if (RESERVATION_TRIGGER_WORDS.some((word) => tokens.has(word))) return true;

  // Catch common Albanian/English misspellings like "reservim", "rezerv...", etc.
  return Array.from(tokens).some((token) => token.startsWith("rezerv") || token.startsWith("reserv"));
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

const isAskingForAlternativeOptions = (message: string) => {
  const normalized = normalizeText(message);
  if (!normalized) return false;

  const tokens = new Set(normalized.split(" ").filter(Boolean));
  const wantsAvailability =
    ["available", "avaliable", "availiable", "availability", "free", "open", "dates", "date", "options", "option"].some((token) =>
      tokens.has(token)
    ) ||
    ["lire", "lirë", "termin", "termine", "data", "datat", "opsione", "opsionet", "orare"].some((token) =>
      tokens.has(token)
    ) ||
    normalized.includes("show me some dates") ||
    normalized.includes("me trego disa data") ||
    normalized.includes("m'trego disa data") ||
    normalized.includes("ma jep disa data") ||
    normalized.includes("ma jep disa opsione") ||
    normalized.includes("me jep disa opsione");

  const asksToCheck =
    ["check", "show", "give", "find"].some((token) => tokens.has(token)) ||
    ["kontrollo", "shiko", "trego", "jep", "gjej"].some((token) => tokens.has(token)) ||
    normalized.includes("show me") ||
    normalized.includes("give me") ||
    normalized.includes("a mundesh me kontrollu") ||
    normalized.includes("a muj me pa");

  if (wantsAvailability && asksToCheck) return true;

  return [
    "what is available",
    "whats available",
    "what's available",
    "whats avaliable",
    "what's avaliable",
    "give me some options",
    "show me some options",
    "show me options",
    "show me some dates",
    "any options",
    "check availability",
    "check whats available",
    "check what's available",
    "check whats avaliable",
    "check what's avaliable",
    "what works",
    "next available",
    "available options",
    "give me options",
    "a ka diqka te lire",
    "a ka diçka të lirë",
    "cka ka lire",
    "çka ka lirë",
    "qka ka lire",
    "qka ka lirë",
    "me trego data",
    "trego data",
    "me jep data",
    "me jep opsione",
    "kontrollo qa ka lire",
    "kontrollo cka ka lire"
  ].some((phrase) => normalized.includes(phrase));
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
  return parts.length >= 1 && parts.length <= 4 ? trimmed : null;
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

const toIsoDate = (year: number, month: number, day: number) => {
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return null;
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const probe = new Date(Date.UTC(year, month - 1, day));
  if (probe.getUTCFullYear() !== year || probe.getUTCMonth() + 1 !== month || probe.getUTCDate() !== day) {
    return null;
  }
  return `${year}-${pad2(month)}-${pad2(day)}`;
};

const shiftDateFromToday = (days: number) => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + days);
  return toIsoDate(date.getFullYear(), date.getMonth() + 1, date.getDate());
};

const parseReservationQuickReplyCommand = (message: string): ReservationQuickReplyCommand => {
  const trimmed = message.trim();
  if (!trimmed) return null;

  if (trimmed.startsWith("change_date:")) {
    const isoDate = trimmed.slice("change_date:".length).trim();
    const normalized = toIsoDate(...(isoDate.split("-").map(Number) as [number, number, number]));
    return normalized ? { type: "change_date", isoDate: normalized } : null;
  }

  if (trimmed.startsWith("change_slot:")) {
    const startAtIso = trimmed.slice("change_slot:".length).trim();
    const probe = new Date(startAtIso);
    return Number.isNaN(probe.getTime()) ? null : { type: "change_slot", startAtIso };
  }

  if (trimmed === "change_date_prompt") {
    return { type: "change_date_prompt" };
  }

  return null;
};

const extractDate = (message: string) => {
  const quickReply = parseReservationQuickReplyCommand(message);
  if (quickReply?.type === "change_date") {
    return quickReply.isoDate;
  }

  const isoMatch = message.match(/\b(20\d{2})-(\d{2})-(\d{2})\b/);
  if (isoMatch) {
    return toIsoDate(Number(isoMatch[1]), Number(isoMatch[2]), Number(isoMatch[3]));
  }

  const normalized = normalizeText(message);
  if (normalized.includes("day after tomorrow")) {
    return shiftDateFromToday(2);
  }
  if (normalized.includes("tomorrow") || normalized.includes("neser") || normalized.includes("neserme")) {
    return shiftDateFromToday(1);
  }
  if (normalized.includes("today") || normalized.includes("sot")) {
    return shiftDateFromToday(0);
  }

  const ordinalMonthMatch = normalized.match(
    /\b(?:on\s+the\s+)?(\d{1,2})(?:st|nd|rd|th)\b(?:\s+of\s+([a-z]+)|\s+([a-z]+))?(?:\s*,?\s*(20\d{2}))?\b/
  );
  if (ordinalMonthMatch?.[1]) {
    const day = Number(ordinalMonthMatch[1]);
    const monthToken = ordinalMonthMatch[2] ?? ordinalMonthMatch[3] ?? "";
    const now = new Date();
    let month = monthToken ? MONTH_NAME_MAP[monthToken] ?? 0 : now.getMonth() + 1;
    let year = ordinalMonthMatch[4] ? Number(ordinalMonthMatch[4]) : now.getFullYear();
    if (month) {
      const candidate = toIsoDate(year, month, day);
      if (candidate) {
        const todayKey = toIsoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
        if (!ordinalMonthMatch[4] && todayKey && candidate < todayKey) {
          if (monthToken) {
            year += 1;
          } else {
            month += 1;
            if (month > 12) {
              month = 1;
              year += 1;
            }
          }
        }
      }
      return toIsoDate(year, month, day);
    }
  }

  const numericMatch = message.match(/\b(\d{1,2})[\/.\-](\d{1,2})(?:[\/.\-](\d{2,4}))?\b/);
  if (!numericMatch) return null;

  const first = Number(numericMatch[1]);
  const second = Number(numericMatch[2]);
  if (!Number.isFinite(first) || !Number.isFinite(second)) return null;

  let month = 0;
  let day = 0;
  if (first > 12 && second <= 12) {
    day = first;
    month = second;
  } else if (second > 12 && first <= 12) {
    month = first;
    day = second;
  } else {
    day = first;
    month = second;
  }

  const now = new Date();
  let year = now.getFullYear();
  if (numericMatch[3]) {
    const yearPart = Number(numericMatch[3]);
    if (!Number.isFinite(yearPart)) return null;
    year = yearPart < 100 ? 2000 + yearPart : yearPart;
  } else {
    const thisYearCandidate = toIsoDate(year, month, day);
    if (thisYearCandidate) {
      const todayKey = toIsoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
      if (todayKey && thisYearCandidate < todayKey) {
        year += 1;
      }
    }
  }

  return toIsoDate(year, month, day);
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

const summarizeReservation = (state: ReservationState, locale: ReservationLocale = "en") => {
  const parts: string[] = [];
  if (locale === "sq") {
    if (state.name) parts.push(`Emri: ${state.name}`);
    if (state.date && state.time) parts.push(`Kur: ${state.date} ${state.time}`);
    if (state.phone) parts.push(`Telefoni: ${state.phone}`);
    if (state.party_size) parts.push(`Persona: ${state.party_size}`);
    if (state.email) parts.push(`Email: ${state.email}`);
    if (state.notes) parts.push(`Shënime: ${state.notes}`);
    return parts.join(" • ");
  }

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

const promptForField = (field: keyof ReservationState, locale: ReservationLocale = "en") => {
  if (locale === "sq") {
    switch (field) {
      case "party_size":
        return "Sa persona do të jeni? 🍽️";
      case "name":
        return "Perfekt, në çfarë emri ta vendos rezervimin? 😊";
      case "date":
        return "Super. Cila datë të përshtatet? Mund të thuash sot, nesër, ose një datë si 2026-03-09.";
      case "time":
        return "Shumë mirë. Në sa ora ta rezervoj? (p.sh. 19:30)";
      case "phone":
        return "Ma jep edhe një numër telefoni në rast se duhet t'ju kontaktojmë? 📞";
      default:
        return "Më jep detajet dhe e rregulloj për ty.";
    }
  }

  switch (field) {
    case "party_size":
      return "Awesome. How many guests should I reserve for? 🍽️";
    case "name":
      return "Perfect, what name should I put the reservation under? 😊";
    case "date":
      return "Love it. What day works best for you? You can say today, tomorrow, or a date like 2026-03-09.";
    case "time":
      return "Great. What time should I lock it in for? (for example 19:30)";
    case "phone":
      return "Could I grab a phone number in case we need to reach you? 📞";
    default:
      return "Share the details and I'll set it up for you.";
  }
};

const formatTimeForZone = (iso: string, timeZone: string) => {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false
  }).format(date);
};

const timeToMinutes = (hhmm: string | null | undefined) => {
  if (!hhmm) return null;
  const match = hhmm.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  if (!Number.isFinite(hour) || !Number.isFinite(minute)) return null;
  return hour * 60 + minute;
};

const getRelevantSlotsForPrompt = (slots: ReservationSlotOption[], requestedTime?: string | null, limit = 12) => {
  if (!requestedTime) return slots.slice(0, limit);
  const requestedMinutes = timeToMinutes(requestedTime);
  if (requestedMinutes === null) return slots.slice(0, limit);

  return [...slots]
    .sort((a, b) => {
      const aMinutes = timeToMinutes(a.time) ?? 0;
      const bMinutes = timeToMinutes(b.time) ?? 0;
      const aDelta = Math.abs(aMinutes - requestedMinutes);
      const bDelta = Math.abs(bMinutes - requestedMinutes);
      if (aDelta !== bDelta) return aDelta - bDelta;
      return aMinutes - bMinutes;
    })
    .slice(0, limit)
    .sort((a, b) => (timeToMinutes(a.time) ?? 0) - (timeToMinutes(b.time) ?? 0));
};

const renderSlotsPrompt = (slots: ReservationSlotOption[], locale: ReservationLocale = "en") => {
  const text = slots.map((slot) => `• ${slot.time}`).join("\n");
  if (locale === "sq") {
    return `Këto orare janë të lira:\n${text}\nCilin të ta rezervoj?`;
  }
  return `Great news, we have these times open:\n${text}\nWhich one should I lock in for you?`;
};

const buildQuickReplyActions = (items: Array<{ label: string; value: string }>) =>
  items.map((item) => ({
    type: "quick_reply" as const,
    label: item.label,
    value: item.value
  }));

const renderAlternativeOptionsPrompt = (
  base: string,
  suggestions: SuggestedReservationOption[],
  locale: ReservationLocale = "en"
) => {
  if (!suggestions.length) return base;
  const lines = suggestions.map((suggestion) => `• ${suggestion.label}`).join("\n");
  if (locale === "sq") {
    return `${base}\nKëto janë disa alternativa:\n${lines}`;
  }
  return `${base}\nHere are some alternatives:\n${lines}`;
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
      .select("id, business_name, industry, timezone, generated_starter_knowledge", { count: "exact" })
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
    const chatbotAccess = await getBusinessEntitlementAccess(businessId, "chatbot");
    if (!chatbotAccess.allowed) {
      return NextResponse.json({ error: "Chatbot is not available on the current plan" }, { status: 403 });
    }

    const businessName = toText(biz.business_name) || "this business";
    const isSiroundChatDemo = isSiroundChatDemoBot({ widgetKey: body.key, businessName });
    const businessTimeZone = toText(biz.timezone) || "Europe/Belgrade";
    const starterKnowledge = toText((biz as { generated_starter_knowledge?: string | null }).generated_starter_knowledge).trim();
    const starterKnowledgeContext =
      starterKnowledge.length > 4500 ? `${starterKnowledge.slice(0, 4500).trim()}\n…` : starterKnowledge;
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

    const ensureFounderConversationRow = async (targetConversationId: string) => {
      try {
        await (admin as any).from("conversations").upsert(
          {
            id: targetConversationId,
            business_id: businessId,
            channel: "web",
            visitor_id: body.name ?? null,
            status: "open",
            last_message_at: new Date().toISOString(),
            created_at: new Date().toISOString()
          },
          { onConflict: "id" }
        );
      } catch (error) {
        // Keep legacy-only deployments working if founder tables are unavailable.
      }
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

    await ensureFounderConversationRow(conversationId);

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
            } else if (
              leadErr?.code === "23503" &&
              typeof leadErr?.message === "string" &&
              leadErr.message.includes("leads_conversation_id_fkey")
            ) {
              await ensureFounderConversationRow(conversationId);
              const { data: retryAfterSync, error: retryAfterSyncError } = await (admin as any)
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

              if (retryAfterSyncError || !retryAfterSync) {
                log("error", "Failed to persist lead from chat after conversation sync", {
                  error: retryAfterSyncError ?? leadErr
                });
              } else {
                leadId = retryAfterSync.id as string;
                insertedLead = true;
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

    let approvedUpdateRules: ChatbotUpdateRuleRow[] = [];
    try {
      approvedUpdateRules = await listApprovedUpdateRules(admin as any, businessId);
    } catch (error) {
      log("warn", "Failed to load approved update rules in chat route", { error, businessId });
    }

    let orchestratorActions: Array<Record<string, unknown>> = [];
    let orchestratorReply: string | null = null;
    let orchestratorCustomerId: string | null = null;
    const chatLocale = detectChatLocale(body.message, reservationState.locale);
    const hasDietaryIntent = isDietaryOrAllergyIntent(normalizedMessage, messageTokens);
    const salesOpportunityKind = isSiroundChatDemo ? null : detectSalesOpportunityKind(body.message, normalizedMessage, messageTokens);

    const directDemoReply = isSiroundChatDemo ? getSiroundChatDemoReply(body.message, chatLocale) : null;
    if (directDemoReply) {
      const { data: assistantMessage, error: assistantErr } = await (admin as any)
        .from("chat_messages")
        .insert({
          conversation_id: conversationId,
          sender: "assistant",
          message_text: directDemoReply
        })
        .select("id")
        .single();

      if (assistantErr) {
        log("error", "Failed to persist demo assistant message", { error: assistantErr });
      }

      const assistantMessageId = assistantMessage?.id ? String(assistantMessage.id) : null;
      await maybeTrackResponseDelay(Date.now() - requestStartMs, conversationId);
      const promptFeedback = await consumeFeedbackPrompt(assistantMessageId);

      return NextResponse.json({
        reply: directDemoReply,
        conversationId,
        userMessageId: messageId,
        assistantMessageId,
        promptFeedback,
        actions: []
      });
    }

    if (!isSiroundChatDemo) {
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
        orchestratorActions = orchestratorActions.map((action) =>
          action?.type === "show_offer"
            ? {
                ...action,
                cta: localizeOfferCta(chatLocale)
              }
            : action
        );
      } catch (error) {
        log("warn", "Orchestrator execution failed in chat route", { error, conversationId });
      }
    }

    const orchestratorUpsell = extractUpsellAction(orchestratorActions);
    const askedForOffer = isOfferIntent(normalizedMessage, messageTokens);

    const appOrigin = new URL(req.url).origin;
    const getBlockingRules = (state: ReservationState) => {
      if (!state.date) return [];
      return findBlockingRulesForDate(approvedUpdateRules, state.date, state.party_size ?? null);
    };
    const getAvailableSlots = async (state: ReservationState): Promise<ReservationSlotOption[]> => {
      if (!state.date || !state.party_size) return [];
      const params = new URLSearchParams({
        restaurantId: businessId,
        date: state.date,
        partySize: String(state.party_size)
      });

      const availabilityRes = await fetch(`${appOrigin}/api/reservations/availability?${params.toString()}`, {
        method: "GET",
        cache: "no-store"
      });
      const availabilityBody = await availabilityRes.json().catch(() => null);
      if (!availabilityRes.ok) {
        return [];
      }

      const available = ((availabilityBody?.slots ?? []) as Array<{
        startAtISO: string;
        available: boolean;
      }>)
        .filter((slot) => slot.available)
        .map((slot) => ({
          time: formatTimeForZone(slot.startAtISO, businessTimeZone),
          start_at_iso: slot.startAtISO
        }));

      return available;
    };

    const getSuggestedAlternatives = async (state: ReservationState): Promise<SuggestedReservationOption[]> => {
      if (!state.date || !state.party_size) return [];
      const baseDate = new Date(`${state.date}T12:00:00Z`);
      if (Number.isNaN(baseDate.getTime())) return [];

      const suggestions: SuggestedReservationOption[] = [];
      for (let offset = 1; offset <= 7; offset += 1) {
        const candidate = new Date(baseDate.getTime());
        candidate.setUTCDate(candidate.getUTCDate() + offset);
        const date = candidate.toISOString().slice(0, 10);
        const candidateState = { ...state, date };
        if (getBlockingRules(candidateState).length) continue;
        const slots = await getAvailableSlots(candidateState);
        if (!slots.length) continue;
        const first = slots[0];
        suggestions.push({
          ...first,
          date,
          label: `${date} at ${first.time}`
        });
        if (suggestions.length >= 3) break;
      }
      return suggestions;
    };

    const createReservationViaRoute = async (state: ReservationState) => {
      const startAtISO =
        state.selected_start_at_iso ??
        (state.date && state.time ? buildReservationDateTime(state.date, state.time, businessTimeZone) : null);

      if (!startAtISO || !state.name || !state.phone || !state.party_size) {
        return { ok: false as const, code: "invalid_state", message: "Missing reservation fields" };
      }

      const createRes = await fetch(`${appOrigin}/api/reservations/create`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          restaurantId: businessId,
          customerName: state.name,
          customerPhone: state.phone,
          customerEmail: state.email ?? null,
          partySize: state.party_size,
          startAtISO,
          notes: state.notes ?? null,
          source: "chatbot",
          conversationId
        })
      });
      const createBody = await createRes.json().catch(() => null);

      if (!createRes.ok) {
        return {
          ok: false as const,
          code: createBody?.code ?? "create_failed",
          message: createBody?.error ?? "Failed to create reservation"
        };
      }

      return {
        ok: true as const,
        reservationId: createBody?.reservation?.id as string | undefined,
        startAtISO
      };
    };

    const inReservationFlow = !isSiroundChatDemo && isReservationIntent(body.message, reservationState);
    const reservationFlowStarting =
      inReservationFlow && (reservationState.mode === "none" || reservationState.mode === "submitted");
    if (inReservationFlow) {
      let reply = "";
      let assistantMessageId: string | null = null;
      const reservationLocale = detectReservationLocale(body.message, reservationState.locale);
      reservationState.locale = reservationLocale;

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
        await safeInsertWebsiteEvent("Failed to log reservation_started website event", {
          businessId,
          siteId: body.siteId ?? null,
          pagePath: resolvedPagePath,
          pageTitle: null,
          eventType: "reservation_started",
          channel: "chatbot",
          sessionId: resolvedSessionId,
          referrer: body.referrer ?? null,
          userAgent,
          countryCode,
          city
        });
      }

      if (reservationState.mode === "none") {
        reservationState = { ...DEFAULT_RESERVATION_STATE, mode: "collecting", locale: reservationLocale };
      }
      if (reservationState.mode === "submitted") {
        reservationState = { ...DEFAULT_RESERVATION_STATE, mode: "collecting", locale: reservationLocale };
      }

      const quickReplyCommand = parseReservationQuickReplyCommand(body.message);
      const forcedAlternativeDate = quickReplyCommand?.type === "change_date" ? quickReplyCommand.isoDate : null;
      const forcedAlternativeSlotIso = quickReplyCommand?.type === "change_slot" ? quickReplyCommand.startAtIso : null;
      const promptedDateReset = quickReplyCommand?.type === "change_date_prompt";
      const occasionClosureRule =
        !forcedAlternativeDate && !reservationState.date
          ? findOccasionClosureRules(approvedUpdateRules, body.message)[0] ?? null
          : null;

      if (forcedAlternativeDate) {
        reservationState.date = forcedAlternativeDate;
        reservationState.time = null;
        reservationState.available_slots = null;
        reservationState.selected_start_at_iso = null;
        reservationState.mode = "collecting";
        reservationState.last_prompt = null;
        reservationState.blocked_date = null;
        reservationState.blocked_reason = null;
      }

      if (promptedDateReset) {
        reservationState.mode = "collecting";
        reservationState.date = null;
        reservationState.time = null;
        reservationState.available_slots = null;
        reservationState.selected_start_at_iso = null;
        reservationState.last_prompt = "date";
      }

      if (isCancelIntent(body.message)) {
        reservationState = { ...DEFAULT_RESERVATION_STATE, mode: "none" };
        reply = reservationLocale === "sq" ? "Në rregull - nuk do ta krijoj rezervimin." : "No problem - I won't create a reservation.";
      } else if (occasionClosureRule) {
        const closureMetadata = occasionClosureRule.metadata as { blocked_dates?: string[] };
        reservationState.mode = "collecting";
        reservationState.last_prompt = "date";
        reservationState.available_slots = null;
        reservationState.selected_start_at_iso = null;
        reservationState.blocked_date = closureMetadata.blocked_dates?.[0] ?? null;
        reservationState.blocked_reason = occasionClosureRule.body;
        const blockedDate = closureMetadata.blocked_dates?.[0] ?? null;
        const occasionLabel = localizeOccasionLabel(
          (occasionClosureRule.metadata as { occasion_label?: string | null }).occasion_label ?? "Eid",
          reservationLocale
        );
        reply =
          reservationLocale === "sq"
            ? `Jemi të mbyllur${blockedDate ? ` më ${blockedDate}` : ""} për ${occasionLabel}. Jep një datë tjetër dhe e kontrolloj çfarë ka të lirë.`
            : `${occasionClosureRule.body} Share another date and I'll check what is available.`;
      } else if (reservationState.mode === "ready_to_confirm") {
        if (isConfirmYes(body.message)) {
          if (
            reservationState.date &&
            reservationState.time &&
            reservationState.name &&
            reservationState.phone &&
            reservationState.party_size
          ) {
            const blockingRules = getBlockingRules(reservationState);
            if (blockingRules.length) {
              reservationState.mode = "collecting";
              reservationState.last_prompt = "date";
              reservationState.available_slots = null;
              reservationState.selected_start_at_iso = null;
              const suggestions = await getSuggestedAlternatives(reservationState);
              reply = renderAlternativeOptionsPrompt(
                reservationLocale === "sq"
                  ? `Kjo datë nuk është e disponueshme. Zgjidh një datë tjetër dhe po të jap opsionet më të mira.`
                  : `${blockingRules[0]?.body ?? "That date is unavailable."} Pick another date and I'll line up the next best options.`,
                suggestions,
                reservationLocale
              );
              orchestratorActions = [
                ...orchestratorActions,
                ...buildQuickReplyActions(
                  suggestions.map((suggestion) => ({
                    label: suggestion.label,
                    value: `change_date:${suggestion.date}`
                  }))
                )
              ];
            } else {
              const createResult = await createReservationViaRoute(reservationState);

              if (!createResult.ok || !createResult.reservationId) {
                await insertEventOnce({
                  businessId,
                  siteId: body.siteId ?? null,
                  type: "reservation_failed",
                  conversationId,
                  messageId,
                  extra: { reason: createResult.message ?? createResult.code ?? "create_failed" }
                });

                if (createResult.code === "capacity_conflict") {
                  const refreshedSlots = await getAvailableSlots(reservationState);
                  if (refreshedSlots.length) {
                    reservationState.mode = "choosing_slot";
                    reservationState.last_prompt = "slot_pick";
                    reservationState.available_slots = refreshedSlots;
                    reservationState.selected_start_at_iso = null;
                    reply =
                      reservationLocale === "sq"
                        ? `Ai orar sapo u mbush, por ende mund të të sistemoj. ✨\n${renderSlotsPrompt(refreshedSlots, reservationLocale)}`
                        : `That time just filled up, but I can still get you in. ✨\n${renderSlotsPrompt(refreshedSlots, reservationLocale)}`;
                    orchestratorActions = [
                      ...orchestratorActions,
                      ...buildQuickReplyActions(
                        refreshedSlots.slice(0, 4).map((slot) => ({
                          label: slot.time,
                          value: `change_slot:${slot.start_at_iso}`
                        }))
                      )
                    ];
                  } else {
                    reservationState.mode = "collecting";
                    reservationState.last_prompt = "date";
                    reservationState.available_slots = null;
                    reservationState.selected_start_at_iso = null;
                    const suggestions = await getSuggestedAlternatives(reservationState);
                    reply = renderAlternativeOptionsPrompt(
                      reservationLocale === "sq"
                        ? "Ai orar është plot tani. Zgjidh një datë tjetër dhe po të sugjeroj opsionet më të afërta."
                        : "That time is fully booked right now. Pick another date and I'll suggest the next available options.",
                      suggestions,
                      reservationLocale
                    );
                    orchestratorActions = [
                      ...orchestratorActions,
                      ...buildQuickReplyActions(
                        suggestions.map((suggestion) => ({
                          label: suggestion.label,
                          value: `change_date:${suggestion.date}`
                        }))
                      )
                    ];
                  }
                } else {
                  reply = "I hit a quick hiccup submitting that booking. Please try once more and I'll take care of it.";
                }
              } else {
                reservationState.mode = "submitted";
                reservationState.confirmed = true;
                reservationState.reservation_id = createResult.reservationId;
                reservationState.last_prompt = null;
                reservationState.available_slots = null;

                await insertEventOnce({
                  businessId,
                  siteId: body.siteId ?? null,
                  type: "reservation_created",
                  conversationId,
                  reservationId: createResult.reservationId
                });

                await insertEventOnce({
                  businessId,
                  siteId: body.siteId ?? null,
                  type: "reservation_completed",
                  conversationId,
                  reservationId: createResult.reservationId
                });
                await safeInsertWebsiteEvent("Failed to log reservation_completed website event", {
                  businessId,
                  siteId: body.siteId ?? null,
                  pagePath: resolvedPagePath,
                  pageTitle: null,
                  eventType: "reservation_completed",
                  channel: "chatbot",
                  sessionId: resolvedSessionId,
                  referrer: body.referrer ?? null,
                  userAgent,
                  countryCode,
                  city
                });

                try {
                  await scheduleReservationFollowups(
                    admin as any,
                    {
                      id: createResult.reservationId,
                      business_id: businessId,
                      conversation_id: conversationId,
                      customer_name: reservationState.name,
                      datetime: createResult.startAtISO ?? ""
                    },
                    orchestratorCustomerId
                  );
                } catch (followupError) {
                  log("error", "Failed to schedule reservation followups", {
                    error: followupError,
                    reservationId: createResult.reservationId
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
                  createResult.reservationId
                );

                reply =
                  reservationLocale === "sq"
                    ? `Perfekt, ${reservationState.name}! 🎉 Rezervimi yt u konfirmua për ${reservationState.party_size} persona më ${reservationState.date} në ora ${reservationState.time}. Mezi presim t'ju mirëpresim!`
                    : `Amazing, ${reservationState.name}! 🎉 You're booked for a party of ${reservationState.party_size} on ${reservationState.date} at ${reservationState.time}. We can't wait to welcome you!`;
              }
            }
          } else {
            reservationState.mode = "collecting";
            const missingField = getMissingReservationField(reservationState);
            reservationState.last_prompt = missingField ?? null;
            reply = promptForField(missingField ?? "date", reservationLocale);
          }
        } else if (isConfirmNo(body.message)) {
          reservationState = { ...DEFAULT_RESERVATION_STATE, mode: "none" };
          reply = reservationLocale === "sq" ? "Pa problem 👍 Nuk do ta dërgoj rezervimin." : "No problem at all 👍 I won't submit it.";
        } else {
          reply = reservationLocale === "sq" ? "Mjafton të përgjigjesh me Po ose Jo dhe e rregulloj unë. 😊" : "Just reply with Yes or No and I'll handle it. 😊";
        }
      } else if (reservationState.mode === "choosing_slot") {
        const extractedTime = extractTime(body.message);
        const normalizedUserMessage = normalizeText(body.message);
        const selectedSlot =
          (forcedAlternativeSlotIso
            ? (reservationState.available_slots ?? []).find((slot) => slot.start_at_iso === forcedAlternativeSlotIso) ??
              {
                time: formatTimeForZone(forcedAlternativeSlotIso, businessTimeZone),
                start_at_iso: forcedAlternativeSlotIso
              }
            : null) ??
          (reservationState.available_slots ?? []).find((slot) => slot.time === extractedTime) ??
          (reservationState.available_slots ?? []).find((slot) => normalizedUserMessage.includes(normalizeText(slot.time)));

        if (!selectedSlot) {
          if (reservationState.available_slots?.length) {
            reply = renderSlotsPrompt(reservationState.available_slots, reservationLocale);
            orchestratorActions = [
              ...orchestratorActions,
              ...buildQuickReplyActions(
                reservationState.available_slots.slice(0, 4).map((slot) => ({
                  label: slot.time,
                  value: `change_slot:${slot.start_at_iso}`
                }))
              )
            ];
          } else {
            reservationState.mode = "collecting";
            reservationState.last_prompt = "date";
            reply =
              reservationLocale === "sq"
                ? "Në rregull. Më jep një datë tjetër dhe e kontrolloj disponueshmërinë."
                : "Got it. Share another date and I'll check fresh availability for you.";
          }
        } else {
          reservationState.time = selectedSlot.time;
          reservationState.selected_start_at_iso = selectedSlot.start_at_iso;
          reservationState.mode = "ready_to_confirm";
          reservationState.last_prompt = "confirm";
          reply =
            reservationLocale === "sq"
              ? `Perfekt, ja përmbledhja e rezervimit:\n${summarizeReservation(reservationState, reservationLocale)}\nTa konfirmoj tani? (Po/Jo)`
              : `Perfect, here's your booking summary:\n${summarizeReservation(reservationState, reservationLocale)}\nShould I confirm this now? (Yes/No)`;
          orchestratorActions = [
            ...orchestratorActions,
            ...buildQuickReplyActions([
              { label: reservationLocale === "sq" ? "Konfirmo" : "Confirm", value: "Yes" },
              { label: reservationLocale === "sq" ? "Ndrysho datën" : "Change date", value: "change_date_prompt" },
              { label: reservationLocale === "sq" ? "Anulo" : "Cancel", value: "No" }
            ])
          ];
        }
      } else {
        const lastPrompt = reservationState.last_prompt;
        const allowLooseName = lastPrompt === "name";
        let invalidDateInput = false;
        let dateWasUpdated = Boolean(forcedAlternativeDate);
        let handledAlternativeRequest = false;

        if (lastPrompt === "name") {
          const name = extractName(body.message, allowLooseName);
          if (name) reservationState.name = name;
        } else if (lastPrompt === "date") {
          const date = extractDate(body.message);
          if (date) {
            reservationState.date = date;
            reservationState.time = null;
            reservationState.available_slots = null;
            reservationState.selected_start_at_iso = null;
            reservationState.blocked_date = null;
            reservationState.blocked_reason = null;
            dateWasUpdated = true;
          } else if (!reservationState.date) {
            invalidDateInput = true;
          }
        } else if (lastPrompt === "time") {
          const time = extractTime(body.message);
          if (time) reservationState.time = time;
        } else if (lastPrompt === "phone") {
          const phone = extractPhone(body.message);
          if (phone) reservationState.phone = phone;
        } else if (lastPrompt === "email") {
          const email = extractEmail(body.message);
          if (email) reservationState.email = email;
        } else if (lastPrompt === "party_size") {
          const partySize = extractPartySize(body.message);
          if (partySize) reservationState.party_size = partySize;
        } else {
          if (!reservationState.date) {
            const date = extractDate(body.message);
            if (date) {
              reservationState.date = date;
              reservationState.blocked_date = null;
              reservationState.blocked_reason = null;
              dateWasUpdated = true;
            }
          }
          if (!reservationState.time) {
            const time = extractTime(body.message);
            if (time) reservationState.time = time;
          }
          if (!reservationState.party_size) {
            const partySize = extractPartySize(body.message);
            if (partySize) reservationState.party_size = partySize;
          }
          if (!reservationState.name) {
            const name = extractName(body.message, false);
            if (name) reservationState.name = name;
          }
          if (!reservationState.phone) {
            const phone = extractPhone(body.message);
            if (phone) reservationState.phone = phone;
          }
        }

        const shouldHandleAlternativeRequest =
          !reservationState.date &&
          reservationState.blocked_date &&
          isAskingForAlternativeOptions(body.message) &&
          (lastPrompt === "date" || reservationState.mode === "collecting");

        if (shouldHandleAlternativeRequest) {
          handledAlternativeRequest = true;
          invalidDateInput = false;

          if (!reservationState.party_size) {
            reservationState.mode = "collecting";
            reservationState.last_prompt = "party_size";
            reply =
              reservationLocale === "sq"
                ? `Po. Për sa persona t'i kontrolloj opsionet pas ${reservationState.blocked_date}?`
                : `Sure. How many guests should I check for after ${reservationState.blocked_date}?`;
          } else {
            const suggestions = await getSuggestedAlternatives({
              ...reservationState,
              date: reservationState.blocked_date
            });
            reservationState.mode = "collecting";
            reservationState.last_prompt = "date";
            reply = renderAlternativeOptionsPrompt(
              reservationState.blocked_reason
                ? reservationLocale === "sq"
                  ? `Jemi të mbyllur në atë datë. Këto janë opsionet më të afërta që mund të ofroj.`
                  : `${reservationState.blocked_reason} Here are the next best options I can offer.`
                : reservationLocale === "sq"
                  ? "Kjo datë nuk është e disponueshme. Këto janë opsionet më të afërta që mund të ofroj."
                  : "That date is unavailable. Here are the next best options I can offer.",
              suggestions,
              reservationLocale
            );
            orchestratorActions = [
              ...orchestratorActions,
              ...buildQuickReplyActions(
                suggestions.map((suggestion) => ({
                  label: suggestion.label,
                  value: `change_date:${suggestion.date}`
                }))
              )
            ];
          }
        }

        if (invalidDateInput) {
          reservationState.mode = "collecting";
          reservationState.last_prompt = "date";
          reply =
            reservationLocale === "sq"
              ? "Nuk e kapa datën. Mund të thuash sot, nesër, ose një datë si 2026-03-09."
              : "I didn't catch the date. You can say today, tomorrow, or a date like 2026-03-09.";
        } else if (!handledAlternativeRequest) {
          const missingField = getMissingReservationField(reservationState);
          if (missingField && !(dateWasUpdated && missingField === "time" && reservationState.party_size)) {
            reservationState.mode = "collecting";
            reservationState.last_prompt = missingField ?? null;
            reply = promptForField(missingField, reservationLocale);
          } else {
            const blockingRules = getBlockingRules(reservationState);
            if (blockingRules.length) {
              reservationState.mode = "collecting";
              reservationState.last_prompt = "date";
              reservationState.available_slots = null;
              reservationState.selected_start_at_iso = null;
              const suggestions = await getSuggestedAlternatives(reservationState);
              reply = renderAlternativeOptionsPrompt(
                reservationLocale === "sq"
                  ? "Kjo datë nuk është e disponueshme. Më jep një datë tjetër dhe po kontrolloj opsionet më të mira."
                  : `${blockingRules[0]?.body ?? "That date is unavailable."} Share another date and I'll check the next best options.`,
                suggestions,
                reservationLocale
              );
              orchestratorActions = [
                ...orchestratorActions,
                ...buildQuickReplyActions(
                  suggestions.map((suggestion) => ({
                    label: suggestion.label,
                    value: `change_date:${suggestion.date}`
                  }))
                )
              ];
            } else {
              const availableSlots = await getAvailableSlots(reservationState);
              if (!availableSlots.length) {
                reservationState.mode = "collecting";
                reservationState.last_prompt = "date";
                reservationState.available_slots = null;
                reservationState.selected_start_at_iso = null;
                const suggestions = await getSuggestedAlternatives(reservationState);
                reply = renderAlternativeOptionsPrompt(
                  reservationLocale === "sq"
                    ? "Duket që ajo datë është plot. Më jep një ditë tjetër dhe po të gjej orare të lira."
                    : "Looks like we're fully booked on that date. Share another day and I'll find open times for you.",
                  suggestions,
                  reservationLocale
                );
                orchestratorActions = [
                  ...orchestratorActions,
                  ...buildQuickReplyActions(
                    suggestions.map((suggestion) => ({
                      label: suggestion.label,
                      value: `change_date:${suggestion.date}`
                    }))
                  )
                ];
              } else {
                const matchedRequestedSlot = reservationState.time
                  ? availableSlots.find((slot) => slot.time === reservationState.time) ?? null
                  : null;

                if (matchedRequestedSlot) {
                  reservationState.time = matchedRequestedSlot.time;
                  reservationState.selected_start_at_iso = matchedRequestedSlot.start_at_iso;
                  reservationState.mode = "ready_to_confirm";
                  reservationState.last_prompt = "confirm";
                  reservationState.available_slots = availableSlots;
                  reply =
                    reservationLocale === "sq"
                      ? `Perfekt, ja përmbledhja e rezervimit:\n${summarizeReservation(reservationState, reservationLocale)}\nTa konfirmoj tani? (Po/Jo)`
                      : `Perfect, here's your booking summary:\n${summarizeReservation(reservationState, reservationLocale)}\nShould I confirm this now? (Yes/No)`;
                  orchestratorActions = [
                    ...orchestratorActions,
                    ...buildQuickReplyActions([
                      { label: reservationLocale === "sq" ? "Konfirmo" : "Confirm", value: "Yes" },
                      { label: reservationLocale === "sq" ? "Ndrysho datën" : "Change date", value: "change_date_prompt" },
                      { label: reservationLocale === "sq" ? "Anulo" : "Cancel", value: "No" }
                    ])
                  ];
                } else {
                  const promptSlots = getRelevantSlotsForPrompt(availableSlots, reservationState.time, 12);
                  reservationState.mode = "choosing_slot";
                  reservationState.last_prompt = "slot_pick";
                  reservationState.available_slots = availableSlots;
                  reservationState.selected_start_at_iso = null;
                  reply =
                    reservationState.time && reservationLocale === "sq"
                      ? `Ora ${reservationState.time} nuk është e lirë. Këto orare janë të lira:\n${promptSlots
                          .map((slot) => `• ${slot.time}`)
                          .join("\n")}\nCilin të ta rezervoj?`
                      : reservationState.time
                        ? `The time ${reservationState.time} is not available. Here are the open times:\n${promptSlots
                            .map((slot) => `• ${slot.time}`)
                            .join("\n")}\nWhich one should I lock in for you?`
                        : renderSlotsPrompt(promptSlots, reservationLocale);
                  orchestratorActions = [
                    ...orchestratorActions,
                    ...buildQuickReplyActions(
                      promptSlots.slice(0, 4).map((slot) => ({
                        label: slot.time,
                        value: `change_slot:${slot.start_at_iso}`
                      }))
                    )
                  ];
                }
              }
            }
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

    if (!orchestratorReply && askedForOffer) {
      try {
        const approvedOfferRules = approvedUpdateRules.filter(
          (rule) => rule.category === "offer" && rule.enabled && rule.approval_status === "approved"
        );
        const matchedOfferRules = await selectRelevantUpdateRules(approvedOfferRules, body.message);
        const matchedOfferRule = matchedOfferRules[0] ?? approvedOfferRules[0] ?? null;

        if (matchedOfferRule) {
          orchestratorReply = buildOfferLeadReply(chatLocale);
          if (!orchestratorActions.some((action) => action?.type === "show_offer")) {
            orchestratorActions.push({
              type: "show_offer",
              offerId: matchedOfferRule.id,
              title: matchedOfferRule.title,
              description: matchedOfferRule.body,
              price: null,
              cta: localizeOfferCta(chatLocale)
            });
          }
        }
      } catch (error) {
        log("warn", "Direct offer fallback failed in chat route", { error, conversationId });
      }
    }

    if (orchestratorReply) {
      let replyFromOrchestrator = orchestratorReply;
      if (orchestratorUpsell) {
        const upsellReply = buildUpsellReply(orchestratorUpsell, chatLocale);
        if (askedForOffer || replyFromOrchestrator.includes(UNKNOWN_REPLY)) {
          replyFromOrchestrator = buildOfferLeadReply(chatLocale);
        } else if (
          !hasDietaryIntent &&
          !normalizeText(replyFromOrchestrator).includes(normalizeText(orchestratorUpsell.title))
        ) {
          replyFromOrchestrator = `${replyFromOrchestrator}\n\n${upsellReply}`;
        }
      }
      if (
        salesOpportunityKind === "menu" &&
        !hasDietaryIntent &&
        !orchestratorActions.some((action) => action?.type === "show_offer")
      ) {
        const menuOfferRule = approvedUpdateRules.find((rule) => rule.category === "offer");
        if (menuOfferRule) {
          orchestratorActions.push({
            type: "show_offer",
            offerId: menuOfferRule.id,
            title: menuOfferRule.title,
            description: menuOfferRule.body,
            price: null,
            cta: localizeOfferCta(chatLocale)
          });
        }
      }
      const proactiveSalesFollowup =
        !askedForOffer &&
        !hasDietaryIntent &&
        !replyFromOrchestrator.includes(UNKNOWN_REPLY) &&
        salesOpportunityKind
          ? buildProactiveSalesFollowup(chatLocale, salesOpportunityKind, approvedUpdateRules)
          : null;
      if (proactiveSalesFollowup && !normalizeText(replyFromOrchestrator).includes(normalizeText(proactiveSalesFollowup))) {
        replyFromOrchestrator = `${replyFromOrchestrator}\n\n${proactiveSalesFollowup}`;
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

    const context = isSiroundChatDemo ? "" : contextParts.join("\n\n");

    let faqContext = "";
    if (!isSiroundChatDemo && messageKeywords.size) {
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
    const systemPrompt = isSiroundChatDemo
      ? buildSiroundChatDemoSystemPrompt()
      : SYSTEM_PROMPT(businessName, body.tonePreset ?? undefined);

    const messages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
      { role: "system", content: systemPrompt },
      { role: "system", content: chatLocale === "sq" ? "Reply in Albanian (Kosovar tone). Do not switch to English unless the user switches." : "Reply in English. Do not switch languages unless the user switches." },
      ...(!isSiroundChatDemo && starterKnowledgeContext
        ? [{ role: "system" as const, content: `Starter knowledge:\n${starterKnowledgeContext}` }]
        : []),
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

    const languageSwitch = resolveLanguageSwitchReply(body.message);
    const smallTalkReply = languageSwitch?.reply ?? resolveSmallTalkReply(body.message);
    const directPriceIntent = !isSiroundChatDemo && isDirectPriceIntent(normalizedMessage, messageTokens);
    let reply = smallTalkReply ?? (isSiroundChatDemo ? "" : UNKNOWN_REPLY);

    if (!smallTalkReply && directPriceIntent) {
      const { data: catalogPriceRows } = await (admin as any)
        .from("catalog_items")
        .select("name,price,description")
        .eq("business_id", businessId)
        .eq("is_active", true)
        .not("price", "is", null)
        .limit(12);

      reply = buildCatalogPriceReply((catalogPriceRows ?? []) as CatalogPriceRow[], chatLocale);
    }

    // IMPORTANT: only call the model if you have context (keeps your strict “don’t guess business facts” rule)
    if (!smallTalkReply && !directPriceIntent && (isSiroundChatDemo || starterKnowledgeContext || context || faqContext)) {
      const completion = await openai.chat.completions.create({
        model: CHAT_MODEL,
        temperature: 0.2,
        messages
      });

      reply = completion.choices?.[0]?.message?.content?.trim() || (isSiroundChatDemo ? getSiroundChatDemoFallbackReply(chatLocale) : UNKNOWN_REPLY);
    }

    if (isSiroundChatDemo && (!reply || reply.includes(UNKNOWN_REPLY))) {
      reply = getSiroundChatDemoFallbackReply(chatLocale);
    }

    if (orchestratorUpsell) {
      const upsellReply = buildUpsellReply(orchestratorUpsell, chatLocale);
      if (askedForOffer || reply.includes(UNKNOWN_REPLY)) {
        reply = buildOfferLeadReply(chatLocale);
      } else if (!hasDietaryIntent && !normalizeText(reply).includes(normalizeText(orchestratorUpsell.title))) {
        reply = `${reply}\n\n${upsellReply}`;
      }
    }

    if (
      salesOpportunityKind === "menu" &&
      !hasDietaryIntent &&
      !orchestratorActions.some((action) => action?.type === "show_offer")
    ) {
      const menuOfferRule = approvedUpdateRules.find((rule) => rule.category === "offer");
      if (menuOfferRule) {
        orchestratorActions.push({
          type: "show_offer",
          offerId: menuOfferRule.id,
          title: menuOfferRule.title,
          description: menuOfferRule.body,
          price: null,
          cta: localizeOfferCta(chatLocale)
        });
      }
    }

    const proactiveSalesFollowup =
      !askedForOffer &&
      !hasDietaryIntent &&
      !reply.includes(UNKNOWN_REPLY) &&
      salesOpportunityKind
        ? buildProactiveSalesFollowup(chatLocale, salesOpportunityKind, approvedUpdateRules)
        : null;
    if (proactiveSalesFollowup && !normalizeText(reply).includes(normalizeText(proactiveSalesFollowup))) {
      reply = `${reply}\n\n${proactiveSalesFollowup}`;
    }

    const followupCandidate = !followupPromptedAt ? detectInterestFollowup(body.message) : null;
    const shouldSuppressFollowup =
      Boolean(followupCandidate) &&
      ((followupCandidate?.intent === "menu_pricing" && directPriceIntent) ||
        (followupCandidate?.intent === "reservation" && inReservationFlow));
    let appendedFollowup = false;
    if (followupCandidate && !shouldSuppressFollowup) {
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

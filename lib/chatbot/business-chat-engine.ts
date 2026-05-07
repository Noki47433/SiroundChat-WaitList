import "server-only";

import OpenAI from "openai";
import { SYSTEM_PROMPT, UNKNOWN_REPLY } from "@/lib/ai/system-prompt";
import { calculateAiTextCostUsd } from "@/lib/ai/costs";
import { runChatbotOrchestrator } from "@/lib/chatbot/orchestrator";
import {
  findBlockingRulesForDate,
  findOccasionClosureRules,
  listApprovedUpdateRules,
  type ChatbotUpdateRuleRow
} from "@/lib/chatbot/update-info";
import { normalizeText } from "@/lib/notifications/detectors";
import { createReservationRecord } from "@/lib/reservations/operations";
import {
  generateSlotsForDate,
  getOrCreateReservationSettings,
  getTimeLabel,
  loadCapacityRelevantReservations,
  computeUsedCapacityForInterval,
  ensureRestaurantBootstrap
} from "@/lib/reservations/service";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { getTimeZoneOffsetMs } from "@/lib/utils/timezone";

const CHAT_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";
const EMBEDDING_MODEL = "text-embedding-3-small";

let openaiClient: OpenAI | null = null;

const getOpenAIClient = () => {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error("Missing OPENAI_API_KEY");
  }
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
};

export type BusinessChatChannel = "website" | "whatsapp" | "instagram";

export type BusinessChatMessage = {
  role: "user" | "assistant";
  content: string;
};

export type BusinessChatAction =
  | {
      type: "create_reservation";
      payload: {
        reservationId: string;
        status: "pending" | "confirmed";
        source: "website" | "whatsapp" | "instagram";
      };
    }
  | {
      type: "create_lead";
      payload?: Record<string, unknown>;
    }
  | {
      type: "quick_reply";
      label: string;
      value: string;
    }
  | {
      type: "show_offer";
      [key: string]: unknown;
    }
  | {
      type: "none";
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

export type ReservationDraftState = {
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

export type BusinessChatEngineResult = {
  replyText: string;
  actions: BusinessChatAction[];
  statePatch: {
    reservationDraft: ReservationDraftState;
    intent: string | null;
    linkedReservationId?: string | null;
  };
  usage?: {
    promptTokens: number;
    completionTokens: number;
    costUsd: number;
  };
};

type ReservationQuickReplyCommand =
  | { type: "change_date"; isoDate: string }
  | { type: "change_slot"; startAtIso: string }
  | { type: "change_date_prompt" }
  | null;

type BusinessRow = {
  id: string;
  business_name: string | null;
  timezone: string | null;
  generated_starter_knowledge: string | null;
};

const DEFAULT_RESERVATION_DRAFT: ReservationDraftState = {
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

const NAME_PATTERNS: RegExp[] = [
  /\bmy name is\s+([a-z][a-z'\- ]{1,60})/i,
  /\bi am\s+([a-z][a-z'\- ]{1,60})/i,
  /\bi'm\s+([a-z][a-z'\- ]{1,60})/i,
  /\bthis is\s+([a-z][a-z'\- ]{1,60})/i,
  /\bname:\s*([a-z][a-z'\- ]{1,60})/i
];

const EMAIL_REGEX = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_REGEX = /(\+?\d[\d\s().-]{6,}\d)/;
const RESERVATION_TRIGGER_PHRASES = ["book a table", "make a reservation", "table reservation"];
const RESERVATION_TRIGGER_WORDS = [
  "reservation",
  "reservim",
  "reserve",
  "book",
  "booking",
  "appointment",
  "termin",
  "rezervo",
  "rezervim",
  "rezervoj"
];
const RESERVATION_CANCEL_WORDS = ["cancel", "never mind", "nevermind", "stop"];
const YES_WORDS = ["yes", "yep", "yeah", "ok", "okay", "confirm", "sure", "po"];
const NO_WORDS = ["no", "nope", "cancel", "stop", "jo"];
const REQUIRED_RESERVATION_FIELDS: Array<keyof ReservationDraftState> = ["date", "time", "party_size", "name", "phone"];
const ALBANIAN_HINTS = [
  "pershendetje",
  "përshëndetje",
  "shqip",
  "rezervim",
  "rezervo",
  "persona",
  "sa veta",
  "neser",
  "sot",
  "ora",
  "faleminderit"
];
const PRICE_INTENT_PHRASES = [
  "what are your prices",
  "what are the prices",
  "menu prices",
  "price list",
  "how much",
  "sa kushton",
  "sa kushtojne",
  "cmimet",
  "çmimet"
];
const PRICE_INTENT_WORDS = ["price", "prices", "pricing", "cost", "cmim", "çmim", "cmimet", "çmimet"];

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

const pad2 = (value: number) => value.toString().padStart(2, "0");

const cleanText = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const normalizePhone = (value: string) => value.replace(/[^\d+]/g, "");

const buildQuickReplyActions = (items: Array<{ label: string; value: string }>): BusinessChatAction[] =>
  items.map((item) => ({ type: "quick_reply", label: item.label, value: item.value }));

const buildPendingReservationReply = (locale: ReservationLocale) =>
  locale === "sq"
    ? "Kërkesa për rezervim u dërgua ✅ Restoranti do ta konfirmojë së shpejti."
    : "Your reservation request has been sent ✅ The restaurant will confirm it shortly.";

const sanitizeReservationDraft = (value: unknown): ReservationDraftState => {
  if (!value || typeof value !== "object") return { ...DEFAULT_RESERVATION_DRAFT };

  const raw = value as Record<string, unknown>;
  const rawSlots = Array.isArray(raw.available_slots) ? raw.available_slots : [];
  const availableSlots = rawSlots
    .map((slot) => {
      if (!slot || typeof slot !== "object") return null;
      const typedSlot = slot as Record<string, unknown>;
      const time = cleanText(typedSlot.time);
      const start_at_iso = cleanText(typedSlot.start_at_iso);
      if (!time || !start_at_iso) return null;
      return { time, start_at_iso };
    })
    .filter(Boolean) as ReservationSlotOption[];

  return {
    ...DEFAULT_RESERVATION_DRAFT,
    ...raw,
    locale: raw.locale === "sq" ? "sq" : "en",
    mode:
      raw.mode === "collecting" ||
      raw.mode === "choosing_slot" ||
      raw.mode === "ready_to_confirm" ||
      raw.mode === "submitted"
        ? raw.mode
        : "none",
    name: cleanText(raw.name) || null,
    phone: cleanText(raw.phone) || null,
    email: cleanText(raw.email) || null,
    date: cleanText(raw.date) || null,
    time: cleanText(raw.time) || null,
    party_size: typeof raw.party_size === "number" && Number.isFinite(raw.party_size) ? raw.party_size : null,
    notes: cleanText(raw.notes) || null,
    available_slots: availableSlots.length ? availableSlots : null,
    selected_start_at_iso: cleanText(raw.selected_start_at_iso) || null,
    last_prompt: cleanText(raw.last_prompt) || null,
    blocked_date: cleanText(raw.blocked_date) || null,
    blocked_reason: cleanText(raw.blocked_reason) || null,
    confirmed: typeof raw.confirmed === "boolean" ? raw.confirmed : null,
    reservation_id: cleanText(raw.reservation_id) || null
  };
};

const detectChatLocale = (message: string, current?: ReservationLocale | null): ReservationLocale => {
  const normalized = normalizeText(message);
  if (!normalized) return current ?? "en";
  if (ALBANIAN_HINTS.some((hint) => normalized.includes(hint))) return "sq";
  return current ?? "en";
};

const detectReservationLocale = (message: string, current?: ReservationLocale | null): ReservationLocale => {
  if (current === "sq") return "sq";
  return detectChatLocale(message, current);
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
  if (normalized.includes("day after tomorrow")) return shiftDateFromToday(2);
  if (normalized.includes("tomorrow") || normalized.includes("neser")) return shiftDateFromToday(1);
  if (normalized.includes("today") || normalized.includes("sot")) return shiftDateFromToday(0);

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
    const todayKey = toIsoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
    if (thisYearCandidate && todayKey && thisYearCandidate < todayKey) {
      year += 1;
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

const timeToMinutes = (hhmm: string | null | undefined) => {
  if (!hhmm) return null;
  const match = hhmm.match(/^(\d{2}):(\d{2})$/);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
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

const summarizeReservation = (state: ReservationDraftState, locale: ReservationLocale = "en") => {
  const parts: string[] = [];
  if (locale === "sq") {
    if (state.name) parts.push(`Emri: ${state.name}`);
    if (state.date && state.time) parts.push(`Kur: ${state.date} ${state.time}`);
    if (state.phone) parts.push(`Telefoni: ${state.phone}`);
    if (state.party_size) parts.push(`Persona: ${state.party_size}`);
    if (state.notes) parts.push(`Shënime: ${state.notes}`);
    return parts.join(" • ");
  }

  if (state.name) parts.push(`Name: ${state.name}`);
  if (state.date && state.time) parts.push(`When: ${state.date} ${state.time}`);
  if (state.phone) parts.push(`Phone: ${state.phone}`);
  if (state.party_size) parts.push(`Party size: ${state.party_size}`);
  if (state.notes) parts.push(`Special request: ${state.notes}`);
  return parts.join(" • ");
};

const getMissingReservationField = (state: ReservationDraftState) =>
  REQUIRED_RESERVATION_FIELDS.find((field) => !state[field]);

const promptForField = (field: keyof ReservationDraftState, locale: ReservationLocale = "en") => {
  if (locale === "sq") {
    switch (field) {
      case "party_size":
        return "Sa persona do të jeni?";
      case "name":
        return "Në çfarë emri ta vendos rezervimin?";
      case "date":
        return "Cila datë të përshtatet? Mund të thuash sot, nesër, ose një datë si 2026-05-10.";
      case "time":
        return "Në sa ora ta rezervoj? (p.sh. 19:30)";
      case "phone":
        return "Ma jep edhe një numër telefoni në rast se duhet t'ju kontaktojmë.";
      default:
        return "Më jep detajet dhe e rregulloj për ty.";
    }
  }

  switch (field) {
    case "party_size":
      return "How many guests should I reserve for?";
    case "name":
      return "What name should I put the reservation under?";
    case "date":
      return "What day works best for you? You can say today, tomorrow, or a date like 2026-05-10.";
    case "time":
      return "What time should I book it for? (for example 19:30)";
    case "phone":
      return "Could I grab a phone number in case the restaurant needs to reach you?";
    default:
      return "Share the details and I’ll set it up for you.";
  }
};

const isReservationIntent = (message: string, state: ReservationDraftState) => {
  if (state.mode === "collecting" || state.mode === "choosing_slot" || state.mode === "ready_to_confirm") return true;
  const normalized = normalizeText(message);
  if (!normalized) return false;

  if (RESERVATION_TRIGGER_PHRASES.some((phrase) => normalized.includes(phrase))) return true;
  const tokens = new Set(normalized.split(" ").filter(Boolean));
  if (RESERVATION_TRIGGER_WORDS.some((word) => tokens.has(word))) return true;
  return Array.from(tokens).some((token) => token.startsWith("rezerv") || token.startsWith("reserv"));
};

const isCancelIntent = (message: string) => {
  const normalized = normalizeText(message);
  return RESERVATION_CANCEL_WORDS.some((word) => normalized.includes(word));
};

const isConfirmYes = (message: string) => {
  const normalized = normalizeText(message);
  return YES_WORDS.some((word) => normalized === word || normalized.includes(` ${word}`) || normalized.startsWith(`${word} `));
};

const isConfirmNo = (message: string) => {
  const normalized = normalizeText(message);
  return NO_WORDS.some((word) => normalized === word || normalized.includes(` ${word}`) || normalized.startsWith(`${word} `));
};

const isDirectPriceIntent = (normalizedMessage: string, messageTokens: Set<string>) =>
  PRICE_INTENT_PHRASES.some((phrase) => normalizedMessage.includes(phrase)) ||
  PRICE_INTENT_WORDS.some((keyword) => messageTokens.has(keyword));

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
      reply: "Sure, I’ll speak English. How can I help you?"
    };
  }

  return null;
};

const resolveSmallTalkReply = (message: string) => {
  const normalized = normalizeText(message);
  if (!normalized) return null;

  const tokens = new Set(normalized.split(" ").filter(Boolean));
  const isAlbanian = detectChatLocale(message) === "sq";
  const isGreeting =
    ["hello", "hi", "hey"].some((token) => tokens.has(token)) ||
    ["pershendetje", "përshëndetje", "hej", "mirdita"].some((token) => tokens.has(token));
  const isHowAreYou =
    normalized.includes("how are you") ||
    normalized.includes("si je") ||
    normalized.includes("si jeni") ||
    normalized.includes("qysh je");

  if (!isGreeting && !isHowAreYou) return null;

  if (isAlbanian) {
    return isHowAreYou ? "Mirë jam. Si mund të të ndihmoj sot?" : "Përshëndetje. Si mund të të ndihmoj sot?";
  }

  return isHowAreYou ? "I’m good. How can I help you today?" : "Hi. How can I help you today?";
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

const buildCatalogPriceReply = (items: Array<{ name: string; price: number | null }>, locale: ReservationLocale = "en") => {
  const lines = items
    .filter((item) => typeof item.name === "string" && item.name.trim().length > 0 && typeof item.price === "number")
    .slice(0, 6)
    .map((item) => `- ${item.name} — €${Number(item.price).toFixed(2).replace(/\.00$/, "")}`);

  if (!lines.length) {
    return locale === "sq"
      ? "Për momentin nuk i kam çmimet e sakta të konfiguruara. Nëse don, mund të të ndihmoj me rezervim."
      : "I don’t have the exact menu prices configured right now. If you want, I can still help with a reservation.";
  }

  if (locale === "sq") {
    return `Po, këto janë disa prej çmimeve tona aktuale:\n${lines.join("\n")}`;
  }

  return `Here are some of our current prices:\n${lines.join("\n")}`;
};

async function fetchBusiness(admin: any, businessId: string): Promise<BusinessRow> {
  const { data, error } = await admin
    .from("businesses")
    .select("id, business_name, timezone, generated_starter_knowledge")
    .eq("id", businessId)
    .single();

  if (error || !data?.id) {
    throw new Error(error?.message ?? "Business not found");
  }

  return data as BusinessRow;
}

async function buildKnowledgeReply(params: {
  admin: any;
  business: BusinessRow;
  customerMessage: string;
  messageHistory: BusinessChatMessage[];
  locale: ReservationLocale;
}) {
  const { admin, business, customerMessage, messageHistory, locale } = params;
  const normalizedMessage = normalizeText(customerMessage);
  const messageTokens = normalizedMessage ? new Set(normalizedMessage.split(" ").filter(Boolean)) : new Set<string>();
  const messageKeywords = new Set(Array.from(messageTokens).filter((token) => token.length > 2));

  const smallTalkReply = resolveLanguageSwitchReply(customerMessage)?.reply ?? resolveSmallTalkReply(customerMessage);
  if (smallTalkReply) {
    return { replyText: smallTalkReply, usage: undefined };
  }

  if (isDirectPriceIntent(normalizedMessage, messageTokens)) {
    const { data: catalogPriceRows } = await admin
      .from("catalog_items")
      .select("name,price")
      .eq("business_id", business.id)
      .eq("is_active", true)
      .not("price", "is", null)
      .limit(12);

    return {
      replyText: buildCatalogPriceReply((catalogPriceRows ?? []) as Array<{ name: string; price: number | null }>, locale),
      usage: undefined
    };
  }

  const openai = getOpenAIClient();
  const embedRes = await openai.embeddings.create({
    model: EMBEDDING_MODEL,
    input: customerMessage
  });

  const queryEmbedding = embedRes.data?.[0]?.embedding;
  if (!queryEmbedding || !Array.isArray(queryEmbedding)) {
    return { replyText: UNKNOWN_REPLY, usage: undefined };
  }

  const fetchMatches = async () => {
    const primary = await admin.rpc("match_document_chunks", {
      query_embedding: queryEmbedding,
      match_business_id: business.id,
      match_count: 5
    });

    if (!primary.error) return primary;

    return admin.rpc("match_document_chunks", {
      query_embedding: queryEmbedding,
      business: business.id,
      match_count: 5
    });
  };

  const { data: matches } = await fetchMatches();
  const chunks = (matches ?? []) as Array<{ chunk_id: string; content: string; similarity: number }>;

  const contextParts: string[] = [];
  let contextLength = 0;
  for (let index = 0; index < chunks.length; index += 1) {
    const chunk = chunks[index];
    const content = cleanText(chunk.content);
    if (!content) continue;
    const snippet = `Snippet ${index + 1}:\n${content}`;
    if (contextLength + snippet.length > 6000) break;
    contextParts.push(snippet);
    contextLength += snippet.length;
  }

  let faqContext = "";
  if (messageKeywords.size) {
    const { data: faqRows } = await admin
      .from("business_faq_items")
      .select("question, answer")
      .eq("business_id", business.id)
      .order("created_at", { ascending: false })
      .limit(20);

    if (faqRows?.length) {
      const faqContextParts: string[] = [];
      let faqContextLength = 0;
      let faqIndex = 1;
      for (const row of faqRows as Array<{ question: string; answer: string }>) {
        const question = cleanText(row.question);
        const answer = cleanText(row.answer);
        if (!question || !answer) continue;

        const tokens = new Set(
          `${normalizeText(question)} ${normalizeText(answer)}`
            .split(" ")
            .filter((token) => token.length > 2)
        );
        const isRelevant = Array.from(messageKeywords).some((keyword) => tokens.has(keyword));
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

  const starterKnowledge = cleanText(business.generated_starter_knowledge);
  const starterKnowledgeContext =
    starterKnowledge.length > 4500 ? `${starterKnowledge.slice(0, 4500).trim()}\n…` : starterKnowledge;
  const context = contextParts.join("\n\n");

  if (!starterKnowledgeContext && !context && !faqContext) {
    return { replyText: UNKNOWN_REPLY, usage: undefined };
  }

  const completion = await openai.chat.completions.create({
    model: CHAT_MODEL,
    temperature: 0.2,
    messages: [
      { role: "system", content: SYSTEM_PROMPT(cleanText(business.business_name) || "this business") },
      {
        role: "system",
        content:
          locale === "sq"
            ? "Reply in Albanian (Kosovar tone). Do not switch to English unless the user switches."
            : "Reply in English. Do not switch languages unless the user switches."
      },
      ...(starterKnowledgeContext
        ? [{ role: "system" as const, content: `Starter knowledge:\n${starterKnowledgeContext}` }]
        : []),
      { role: "system", content: context ? `Context:\n${context}` : "Context:\n(No matching context found.)" },
      ...(faqContext ? [{ role: "system" as const, content: `FAQ context:\n${faqContext}` }] : []),
      ...messageHistory.map((message) => ({
        role: message.role,
        content: message.content
      }))
    ]
  });

  return {
    replyText: completion.choices?.[0]?.message?.content?.trim() || UNKNOWN_REPLY,
    usage: {
      promptTokens: completion.usage?.prompt_tokens ?? 0,
      completionTokens: completion.usage?.completion_tokens ?? 0,
      costUsd: calculateAiTextCostUsd(
        completion.usage?.prompt_tokens ?? 0,
        completion.usage?.completion_tokens ?? 0
      )
    }
  };
}

async function getAvailableSlots(params: {
  admin: any;
  restaurantId: string;
  date: string;
  partySize: number;
  timeZone: string;
}) {
  const restaurant = await ensureReservationRestaurant(params.admin, params.restaurantId);
  const settings = await getOrCreateReservationSettings(params.admin, params.restaurantId);
  const slots = generateSlotsForDate({
    date: params.date,
    timeZone: restaurant.timezone ?? params.timeZone,
    intervalMin: settings.slot_interval_min,
    durationMin: settings.default_duration_min,
    startHour: 9,
    endHour: 23
  });

  if (!slots.length) return [] as ReservationSlotOption[];

  const reservations = await loadCapacityRelevantReservations(params.admin, {
    restaurantId: params.restaurantId,
    intervalStart: slots[0].startAt,
    intervalEnd: slots[slots.length - 1].endAt,
    settings
  });

  return slots
    .map((slot) => {
      const usedCapacity = computeUsedCapacityForInterval(reservations, slot.startAt, slot.endAt, settings);
      const available = usedCapacity + params.partySize <= restaurant.total_capacity;
      if (!available) return null;
      return {
        time: getTimeLabel(slot.startAt.toISOString(), params.timeZone),
        start_at_iso: slot.startAt.toISOString()
      };
    })
    .filter(Boolean) as ReservationSlotOption[];
}

async function ensureReservationRestaurant(admin: any, businessId: string) {
  const restaurant = await ensureRestaurantBootstrap(admin, businessId);
  if (!restaurant) {
    throw new Error("Restaurant not found");
  }
  return restaurant;
}

async function getSuggestedAlternatives(params: {
  admin: any;
  restaurantId: string;
  state: ReservationDraftState;
  rules: ChatbotUpdateRuleRow[];
  timeZone: string;
}) {
  const { state, rules } = params;
  if (!state.date || !state.party_size) return [] as SuggestedReservationOption[];
  const baseDate = new Date(`${state.date}T12:00:00Z`);
  if (Number.isNaN(baseDate.getTime())) return [];

  const suggestions: SuggestedReservationOption[] = [];
  for (let offset = 1; offset <= 7; offset += 1) {
    const candidate = new Date(baseDate.getTime());
    candidate.setUTCDate(candidate.getUTCDate() + offset);
    const date = candidate.toISOString().slice(0, 10);
    if (findBlockingRulesForDate(rules, date, state.party_size).length) continue;
    const slots = await getAvailableSlots({
      admin: params.admin,
      restaurantId: params.restaurantId,
      date,
      partySize: state.party_size,
      timeZone: params.timeZone
    });
    if (!slots.length) continue;
    suggestions.push({
      ...slots[0],
      date,
      label: `${date} at ${slots[0].time}`
    });
    if (suggestions.length >= 3) break;
  }
  return suggestions;
}

async function runReservationFlow(params: {
  admin: any;
  businessId: string;
  channel: BusinessChatChannel;
  conversationId?: string;
  customerMessage: string;
  reservationDraft: ReservationDraftState;
  locale: ReservationLocale;
  updateRules: ChatbotUpdateRuleRow[];
}) {
  const state = { ...params.reservationDraft };
  const restaurant = await ensureReservationRestaurant(params.admin, params.businessId);
  const timeZone = restaurant.timezone ?? "Europe/Belgrade";
  const actions: BusinessChatAction[] = [];
  let reply = "";

  if (state.mode === "none") {
    state.mode = "collecting";
  }
  if (state.mode === "submitted") {
    state.mode = "collecting";
    state.confirmed = null;
    state.reservation_id = null;
  }

  state.locale = params.locale;

  const quickReplyCommand = parseReservationQuickReplyCommand(params.customerMessage);
  const forcedAlternativeDate = quickReplyCommand?.type === "change_date" ? quickReplyCommand.isoDate : null;
  const forcedAlternativeSlotIso = quickReplyCommand?.type === "change_slot" ? quickReplyCommand.startAtIso : null;
  const promptedDateReset = quickReplyCommand?.type === "change_date_prompt";

  if (forcedAlternativeDate) {
    state.date = forcedAlternativeDate;
    state.time = null;
    state.available_slots = null;
    state.selected_start_at_iso = null;
    state.mode = "collecting";
    state.last_prompt = null;
    state.blocked_date = null;
    state.blocked_reason = null;
  }

  if (promptedDateReset) {
    state.mode = "collecting";
    state.date = null;
    state.time = null;
    state.available_slots = null;
    state.selected_start_at_iso = null;
    state.last_prompt = "date";
  }

  if (isCancelIntent(params.customerMessage)) {
    return {
      replyText:
        params.locale === "sq" ? "Në rregull. Nuk do ta dërgoj kërkesën për rezervim." : "No problem. I won’t send the reservation request.",
      state,
      actions
    };
  }

  const occasionClosureRule =
    !forcedAlternativeDate && !state.date ? findOccasionClosureRules(params.updateRules, params.customerMessage)[0] ?? null : null;

  if (occasionClosureRule) {
    const closureMetadata = occasionClosureRule.metadata as { blocked_dates?: string[] };
    state.mode = "collecting";
    state.last_prompt = "date";
    state.available_slots = null;
    state.selected_start_at_iso = null;
    state.blocked_date = closureMetadata.blocked_dates?.[0] ?? null;
    state.blocked_reason = occasionClosureRule.body;
    reply =
      params.locale === "sq"
        ? `Jemi të mbyllur${state.blocked_date ? ` më ${state.blocked_date}` : ""}. Jep një datë tjetër dhe e kontrolloj çfarë ka të lirë.`
        : `${occasionClosureRule.body} Share another date and I’ll check what is available.`;
    return { replyText: reply, state, actions };
  }

  if (state.mode === "ready_to_confirm") {
    if (isConfirmYes(params.customerMessage)) {
      if (state.date && state.time && state.name && state.phone && state.party_size) {
        const blockingRules = findBlockingRulesForDate(params.updateRules, state.date, state.party_size);
        if (blockingRules.length) {
          state.mode = "collecting";
          state.last_prompt = "date";
          state.available_slots = null;
          state.selected_start_at_iso = null;
          const suggestions = await getSuggestedAlternatives({
            admin: params.admin,
            restaurantId: params.businessId,
            state,
            rules: params.updateRules,
            timeZone
          });
          reply = renderAlternativeOptionsPrompt(
            params.locale === "sq"
              ? "Kjo datë nuk është e disponueshme. Zgjidh një datë tjetër dhe po të jap opsionet më të mira."
              : `${blockingRules[0]?.body ?? "That date is unavailable."} Pick another date and I’ll line up the next best options.`,
            suggestions,
            params.locale
          );
          actions.push(
            ...buildQuickReplyActions(
              suggestions.map((suggestion) => ({
                label: suggestion.label,
                value: `change_date:${suggestion.date}`
              }))
            )
          );
          return { replyText: reply, state, actions };
        }

        const startAtISO =
          state.selected_start_at_iso ?? buildReservationDateTime(state.date, state.time, timeZone);

        if (!startAtISO) {
          state.mode = "collecting";
          state.last_prompt = "date";
          return {
            replyText:
              params.locale === "sq"
                ? "Nuk e kapa saktë datën ose orën. Më jep edhe një herë datën."
                : "I didn’t catch the date or time correctly. Share the date once more.",
            state,
            actions
          };
        }

        const reservationStatus =
          params.channel === "whatsapp" || params.channel === "instagram" ? "pending" : "confirmed";
        const reservationSource =
          params.channel === "whatsapp" ? "whatsapp" : params.channel === "instagram" ? "instagram" : "website";
        const created = await createReservationRecord({
          adminClient: params.admin,
          restaurantId: params.businessId,
          customerName: state.name,
          customerPhone: state.phone,
          customerEmail: state.email,
          partySize: state.party_size,
          startAtISO,
          notes: state.notes,
          source: reservationSource,
          createdBy: "chatbot",
          status: reservationStatus,
          conversationId: params.channel === "website" ? params.conversationId ?? null : null,
          sourceConversationId: params.conversationId ?? null,
          sendSmsAlert: true
        });

        state.mode = "submitted";
        state.confirmed = reservationStatus === "confirmed";
        state.reservation_id = created.reservation.id as string;
        state.last_prompt = null;
        state.available_slots = null;
        state.selected_start_at_iso = null;

        actions.push({
          type: "create_reservation",
          payload: {
            reservationId: created.reservation.id as string,
            status: reservationStatus,
            source: reservationSource
          }
        });

        reply =
          reservationStatus === "pending"
            ? buildPendingReservationReply(params.locale)
            : params.locale === "sq"
              ? `Perfekt, ${state.name}. Rezervimi yt u konfirmua për ${state.party_size} persona më ${state.date} në ora ${state.time}.`
              : `Perfect, ${state.name}. You’re booked for ${state.party_size} guests on ${state.date} at ${state.time}.`;

        return { replyText: reply, state, actions };
      }

      const missingField = getMissingReservationField(state) ?? "date";
      state.mode = "collecting";
      state.last_prompt = missingField;
      return { replyText: promptForField(missingField, params.locale), state, actions };
    }

    if (isConfirmNo(params.customerMessage)) {
      return {
        replyText:
          params.locale === "sq" ? "Në rregull. Nuk do ta dërgoj kërkesën." : "No problem. I won’t send the request.",
        state: { ...DEFAULT_RESERVATION_DRAFT, locale: params.locale },
        actions
      };
    }

    return {
      replyText:
        params.locale === "sq"
          ? "Mjafton të përgjigjesh me Po ose Jo dhe e rregulloj unë."
          : "Just reply with Yes or No and I’ll handle it.",
      state,
      actions
    };
  }

  if (state.mode === "choosing_slot") {
    const extractedTime = extractTime(params.customerMessage);
    const normalizedMessage = normalizeText(params.customerMessage);
    const selectedSlot =
      (forcedAlternativeSlotIso
        ? (state.available_slots ?? []).find((slot) => slot.start_at_iso === forcedAlternativeSlotIso) ??
          {
            time: formatTimeForZone(forcedAlternativeSlotIso, timeZone),
            start_at_iso: forcedAlternativeSlotIso
          }
        : null) ??
      (state.available_slots ?? []).find((slot) => slot.time === extractedTime) ??
      (state.available_slots ?? []).find((slot) => normalizedMessage.includes(normalizeText(slot.time)));

    if (!selectedSlot) {
      if (state.available_slots?.length) {
        return { replyText: renderSlotsPrompt(state.available_slots, params.locale), state, actions };
      }
      state.mode = "collecting";
      state.last_prompt = "date";
      return {
        replyText:
          params.locale === "sq"
            ? "Më jep një datë tjetër dhe e kontrolloj përsëri disponueshmërinë."
            : "Share another date and I’ll check fresh availability for you.",
        state,
        actions
      };
    }

    state.time = selectedSlot.time;
    state.selected_start_at_iso = selectedSlot.start_at_iso;
    state.mode = "ready_to_confirm";
    state.last_prompt = "confirm";

    actions.push(
      ...buildQuickReplyActions([
        { label: params.locale === "sq" ? "Konfirmo" : "Confirm", value: "Yes" },
        { label: params.locale === "sq" ? "Ndrysho datën" : "Change date", value: "change_date_prompt" },
        { label: params.locale === "sq" ? "Anulo" : "Cancel", value: "No" }
      ])
    );

    return {
      replyText:
        params.locale === "sq"
          ? `Perfekt, ja përmbledhja e rezervimit:\n${summarizeReservation(state, params.locale)}\nTa dërgoj tani? (Po/Jo)`
          : `Perfect, here’s your reservation summary:\n${summarizeReservation(state, params.locale)}\nShould I send this now? (Yes/No)`,
      state,
      actions
    };
  }

  const lastPrompt = state.last_prompt;
  const allowLooseName = lastPrompt === "name";
  let invalidDateInput = false;
  let dateWasUpdated = Boolean(forcedAlternativeDate);

  if (lastPrompt === "name") {
    const name = extractName(params.customerMessage, allowLooseName);
    if (name) state.name = name;
  } else if (lastPrompt === "date") {
    const date = extractDate(params.customerMessage);
    if (date) {
      state.date = date;
      state.time = null;
      state.available_slots = null;
      state.selected_start_at_iso = null;
      state.blocked_date = null;
      state.blocked_reason = null;
      dateWasUpdated = true;
    } else if (!state.date) {
      invalidDateInput = true;
    }
  } else if (lastPrompt === "time") {
    const time = extractTime(params.customerMessage);
    if (time) state.time = time;
  } else if (lastPrompt === "phone") {
    const phone = extractPhone(params.customerMessage);
    if (phone) state.phone = phone;
  } else if (lastPrompt === "email") {
    const email = extractEmail(params.customerMessage);
    if (email) state.email = email;
  } else if (lastPrompt === "party_size") {
    const partySize = extractPartySize(params.customerMessage);
    if (partySize) state.party_size = partySize;
  } else {
    if (!state.date) {
      const date = extractDate(params.customerMessage);
      if (date) {
        state.date = date;
        state.blocked_date = null;
        state.blocked_reason = null;
        dateWasUpdated = true;
      }
    }
    if (!state.time) {
      const time = extractTime(params.customerMessage);
      if (time) state.time = time;
    }
    if (!state.party_size) {
      const partySize = extractPartySize(params.customerMessage);
      if (partySize) state.party_size = partySize;
    }
    if (!state.name) {
      const name = extractName(params.customerMessage, false);
      if (name) state.name = name;
    }
    if (!state.phone) {
      const phone = extractPhone(params.customerMessage);
      if (phone) state.phone = phone;
    }
    if (!state.notes) {
      const normalizedMessage = normalizeText(params.customerMessage);
      if (normalizedMessage.includes("special request") || normalizedMessage.includes("allergy")) {
        state.notes = cleanText(params.customerMessage);
      }
    }
  }

  if (invalidDateInput) {
    state.mode = "collecting";
    state.last_prompt = "date";
    return {
      replyText:
        params.locale === "sq"
          ? "Nuk e kapa datën. Mund të thuash sot, nesër, ose një datë si 2026-05-10."
          : "I didn’t catch the date. You can say today, tomorrow, or a date like 2026-05-10.",
      state,
      actions
    };
  }

  const missingField = getMissingReservationField(state);
  if (missingField && !(dateWasUpdated && missingField === "time" && state.party_size)) {
    state.mode = "collecting";
    state.last_prompt = missingField;
    return { replyText: promptForField(missingField, params.locale), state, actions };
  }

  if (!state.date || !state.party_size) {
    state.mode = "collecting";
    state.last_prompt = getMissingReservationField(state) ?? "date";
    return { replyText: promptForField((state.last_prompt as keyof ReservationDraftState) ?? "date", params.locale), state, actions };
  }

  const blockingRules = findBlockingRulesForDate(params.updateRules, state.date, state.party_size);
  if (blockingRules.length) {
    state.mode = "collecting";
    state.last_prompt = "date";
    state.available_slots = null;
    state.selected_start_at_iso = null;
    const suggestions = await getSuggestedAlternatives({
      admin: params.admin,
      restaurantId: params.businessId,
      state,
      rules: params.updateRules,
      timeZone
    });
    reply = renderAlternativeOptionsPrompt(
      params.locale === "sq"
        ? "Kjo datë nuk është e disponueshme. Më jep një datë tjetër dhe po kontrolloj opsionet më të mira."
        : `${blockingRules[0]?.body ?? "That date is unavailable."} Share another date and I’ll check the next best options.`,
      suggestions,
      params.locale
    );
    actions.push(
      ...buildQuickReplyActions(
        suggestions.map((suggestion) => ({
          label: suggestion.label,
          value: `change_date:${suggestion.date}`
        }))
      )
    );
    return { replyText: reply, state, actions };
  }

  const availableSlots = await getAvailableSlots({
    admin: params.admin,
    restaurantId: params.businessId,
    date: state.date,
    partySize: state.party_size,
    timeZone
  });

  if (!availableSlots.length) {
    state.mode = "collecting";
    state.last_prompt = "date";
    state.available_slots = null;
    state.selected_start_at_iso = null;
    const suggestions = await getSuggestedAlternatives({
      admin: params.admin,
      restaurantId: params.businessId,
      state,
      rules: params.updateRules,
      timeZone
    });
    reply = renderAlternativeOptionsPrompt(
      params.locale === "sq"
        ? "Duket që ajo datë është plot. Më jep një ditë tjetër dhe po të gjej orare të lira."
        : "Looks like that date is fully booked. Share another day and I’ll find open times for you.",
      suggestions,
      params.locale
    );
    actions.push(
      ...buildQuickReplyActions(
        suggestions.map((suggestion) => ({
          label: suggestion.label,
          value: `change_date:${suggestion.date}`
        }))
      )
    );
    return { replyText: reply, state, actions };
  }

  const matchedRequestedSlot = state.time ? availableSlots.find((slot) => slot.time === state.time) ?? null : null;

  if (matchedRequestedSlot) {
    state.time = matchedRequestedSlot.time;
    state.selected_start_at_iso = matchedRequestedSlot.start_at_iso;
    state.mode = "ready_to_confirm";
    state.last_prompt = "confirm";
    state.available_slots = availableSlots;
    actions.push(
      ...buildQuickReplyActions([
        { label: params.locale === "sq" ? "Konfirmo" : "Confirm", value: "Yes" },
        { label: params.locale === "sq" ? "Ndrysho datën" : "Change date", value: "change_date_prompt" },
        { label: params.locale === "sq" ? "Anulo" : "Cancel", value: "No" }
      ])
    );
    return {
      replyText:
        params.locale === "sq"
          ? `Perfekt, ja përmbledhja e rezervimit:\n${summarizeReservation(state, params.locale)}\nTa dërgoj tani? (Po/Jo)`
          : `Perfect, here’s your reservation summary:\n${summarizeReservation(state, params.locale)}\nShould I send this now? (Yes/No)`,
      state,
      actions
    };
  }

  const promptSlots = getRelevantSlotsForPrompt(availableSlots, state.time, 12);
  state.mode = "choosing_slot";
  state.last_prompt = "slot_pick";
  state.available_slots = availableSlots;
  state.selected_start_at_iso = null;

  actions.push(
    ...buildQuickReplyActions(
      promptSlots.slice(0, 4).map((slot) => ({
        label: slot.time,
        value: `change_slot:${slot.start_at_iso}`
      }))
    )
  );

  return {
    replyText:
      state.time && params.locale === "sq"
        ? `Ora ${state.time} nuk është e lirë. Këto orare janë të lira:\n${promptSlots
            .map((slot) => `• ${slot.time}`)
            .join("\n")}\nCilin të ta rezervoj?`
        : state.time
          ? `The time ${state.time} is not available. Here are the open times:\n${promptSlots
              .map((slot) => `• ${slot.time}`)
              .join("\n")}\nWhich one should I lock in for you?`
          : renderSlotsPrompt(promptSlots, params.locale),
    state,
    actions
  };
}

export async function generateBusinessChatbotReply({
  businessId,
  channel,
  conversationId,
  customerMessage,
  customerExternalId,
  messageHistory = [],
  metadata
}: {
  businessId: string;
  channel: BusinessChatChannel;
  conversationId?: string;
  customerMessage: string;
  customerExternalId?: string;
  messageHistory?: BusinessChatMessage[];
  metadata?: Record<string, unknown>;
}): Promise<BusinessChatEngineResult> {
  const admin = getSupabaseAdminClient() as any;
  const business = await fetchBusiness(admin, businessId);
  const reservationDraft = sanitizeReservationDraft(metadata?.reservationDraft);
  const locale = detectReservationLocale(customerMessage, reservationDraft.locale);
  let updateRules: ChatbotUpdateRuleRow[] = [];
  try {
    updateRules = await listApprovedUpdateRules(admin, businessId);
  } catch {
    updateRules = [];
  }

  const inReservationFlow = isReservationIntent(customerMessage, reservationDraft);
  if (inReservationFlow) {
    const result = await runReservationFlow({
      admin,
      businessId,
      channel,
      conversationId,
      customerMessage,
      reservationDraft,
      locale,
      updateRules
    });

    return {
      replyText: result.replyText,
      actions: result.actions.length ? result.actions : [{ type: "none" }],
      statePatch: {
        reservationDraft: result.state,
        intent: "reservation",
        linkedReservationId: result.state.reservation_id
      }
    };
  }

  let orchestratorReply: string | null = null;
  let orchestratorActions: BusinessChatAction[] = [];
  if (channel === "website" && conversationId) {
    try {
      const orchestratorResult = await runChatbotOrchestrator(admin, {
        businessId,
        conversationId,
        message: customerMessage,
        customerSignals: {
          name: cleanText(metadata?.customerName) || null,
          email: cleanText(metadata?.customerEmail) || null,
          phone: cleanText(metadata?.customerPhone) || null,
          channel: "web_chat",
          externalId: customerExternalId ?? null
        },
        reservationContext: {
          partySize: reservationDraft.party_size,
          time: reservationDraft.time
        }
      });
      orchestratorReply = orchestratorResult.assistantMessage;
      orchestratorActions = (orchestratorResult.actions as BusinessChatAction[]) ?? [];
    } catch {
      orchestratorReply = null;
      orchestratorActions = [];
    }
  }

  if (orchestratorReply && !orchestratorReply.includes(UNKNOWN_REPLY)) {
    return {
      replyText: orchestratorReply,
      actions: orchestratorActions.length ? orchestratorActions : [{ type: "none" }],
      statePatch: {
        reservationDraft,
        intent: null
      }
    };
  }

  const knowledgeResult = await buildKnowledgeReply({
    admin,
    business,
    customerMessage,
    messageHistory,
    locale
  });

  return {
    replyText: knowledgeResult.replyText,
    actions: orchestratorActions.length ? orchestratorActions : [{ type: "none" }],
    statePatch: {
      reservationDraft,
      intent: null
    },
    usage: knowledgeResult.usage
  };
}

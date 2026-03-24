import { getOpenAIClient } from "@/lib/ai/client";
import { normalizeText } from "@/lib/notifications/detectors";
import { log } from "@/lib/utils/log";

export const UPDATE_RULE_CATEGORIES = [
  "offer",
  "closure",
  "reservation_constraint",
  "recommendation",
  "service_notice",
  "faq",
  "general_notice"
] as const;

export type UpdateRuleCategory = (typeof UPDATE_RULE_CATEGORIES)[number];

export type ChatbotUpdateEntryRow = {
  id: string;
  business_id: string;
  input_text: string;
  status: "pending_review" | "applied" | "discarded";
  created_at: string;
  updated_at: string;
};

export type ClosureRuleMetadata = {
  blocked_dates?: string[];
  blocked_weekdays?: number[];
  occasion_label?: string | null;
  occasion_aliases?: string[];
  scope?: "reservation_only" | "reservation_and_general_queries" | "general_queries";
  unavailable?: boolean;
};

export type OfferRuleMetadata = {
  offer_summary?: string | null;
  active_from?: string | null;
  active_until?: string | null;
  eligibility?: string | null;
  customer_intents?: string[];
  upsell_contexts?: string[];
};

export type RecommendationRuleMetadata = {
  item_name?: string | null;
  when_to_suggest?: string[];
  reason?: string | null;
  aliases?: string[];
};

export type ReservationConstraintRuleMetadata = {
  blocked_dates?: string[];
  blocked_weekdays?: number[];
  min_party_size?: number | null;
  max_party_size?: number | null;
  time_windows?: string[];
};

export type FaqRuleMetadata = {
  question_intents?: string[];
  answer_scope?: string | null;
};

export type NoticeRuleMetadata = {
  intent_labels?: string[];
  applies_when?: string | null;
};

export type UpdateRuleMetadata =
  | ClosureRuleMetadata
  | OfferRuleMetadata
  | RecommendationRuleMetadata
  | ReservationConstraintRuleMetadata
  | FaqRuleMetadata
  | NoticeRuleMetadata
  | Record<string, unknown>;

export type ChatbotUpdateRuleRow = {
  id: string;
  business_id: string;
  entry_id: string | null;
  category: UpdateRuleCategory;
  title: string;
  body: string;
  keywords: string[];
  metadata: UpdateRuleMetadata | null;
  enabled: boolean;
  approval_status: "pending" | "approved" | "discarded";
  created_at: string;
  updated_at: string;
  triggerSummary?: string;
};

export type ExtractedUpdateRule = {
  category: UpdateRuleCategory;
  title: string;
  body: string;
  keywords: string[];
  metadata: UpdateRuleMetadata;
};

export type UpdateRuleSelectionContext = {
  reservationDate?: string | null;
  partySize?: number | null;
  reservationFlowActive?: boolean;
};

const UPDATE_INFO_MODEL = process.env.OPENAI_CHAT_MODEL || "gpt-4o-mini";

const getErrorMessage = (error: unknown) => {
  if (!error || typeof error !== "object") return "";
  const message = "message" in error ? (error as { message?: unknown }).message : "";
  return typeof message === "string" ? message : "";
};

export const isMissingUpdateInfoSchemaError = (error: unknown) => {
  if (!error || typeof error !== "object") return false;
  const code = "code" in error ? (error as { code?: unknown }).code : "";
  const message = getErrorMessage(error);
  if (code !== "PGRST205" && code !== "42P01") return false;
  return /chatbot_update_entries|chatbot_update_rules/i.test(message);
};

const STOPWORDS = new Set([
  "the",
  "and",
  "for",
  "with",
  "that",
  "this",
  "from",
  "your",
  "have",
  "will",
  "would",
  "about",
  "into",
  "they",
  "them",
  "their",
  "when",
  "where",
  "what",
  "which",
  "than",
  "then",
  "just",
  "much",
  "very",
  "also",
  "only",
  "more",
  "less",
  "after",
  "before",
  "during",
  "until",
  "dont",
  "doesnt",
  "cant",
  "wont",
  "closed",
  "open",
  "offer",
  "offers",
  "business",
  "customers",
  "customer",
  "restaurant",
  "barbershop",
  "clinic",
  "agency",
  "chatbot",
  "website",
  "please",
  "because",
  "2026",
  "2027",
  "2028",
  "2029"
]);

const GENERIC_TRIGGER_TERMS = new Set([
  ...STOPWORDS,
  "are",
  "year",
  "date",
  "dates",
  "day",
  "days",
  "time",
  "times",
  "menu",
  "food",
  "item",
  "items",
  "service",
  "services",
  "question",
  "questions",
  "notice",
  "notes",
  "info",
  "information",
  "available",
  "availability",
  "reservation",
  "reservations",
  "booking",
  "bookings",
  "customers",
  "customer",
  "today",
  "tomorrow",
  "weekend",
  "week",
  "month"
]);

const OCCASION_ALIASES: Record<string, string[]> = {
  Eid: ["eid", "eid al fitr", "eid al-fitr", "fitr bajram", "bajram", "bajrami", "ramazan bajrami"],
  Christmas: ["christmas", "xmas"],
  "New Year": ["new year", "new years", "new year's"],
  Ramadan: ["ramadan", "ramazan"],
  Easter: ["easter", "pascha"],
  Thanksgiving: ["thanksgiving"]
};

const CLOSURE_PATTERNS = [
  /\b(we are closed|we're closed|closed on|not open|do not work|don't work|day off|unavailable on|no service on)\b/i,
  /\b(no reservations on|not taking bookings on|we wont be open|we won't be open)\b/i
];

const OFFER_PATTERNS = [
  /\b(offer|discount|promo|promotion|2 ?for ?1|two for one|free|complimentary|special)\b/i,
  /\b(get|includes?)\b.*\b(free|discount|off)\b/i
];

const RECOMMENDATION_PATTERNS = [
  /\b(recommend|suggest|signature|popular|best seller|must try|house favorite)\b/i,
  /\btry the\b/i
];

const RESERVATION_CONSTRAINT_PATTERNS = [
  /\b(reservations only|booking only|last seating|last booking|minimum spend|min spend|min party|max party|party of|walk-?ins only|no walk-?ins)\b/i
];

const FAQ_PATTERNS = [/\?/, /\bif someone asks\b/i, /\bwhen customers ask\b/i];
const SERVICE_NOTICE_PATTERNS = [/\b(service notice|important|please note|availability|unavailable|limited)\b/i];

const RESERVATION_INTENT_PHRASES = ["make a reservation", "book a table", "reserve a table", "table reservation"];
const RESERVATION_INTENT_WORDS = ["reservation", "reserve", "booking", "book", "table", "availability", "rezervim", "rezervo", "termin"];
const OFFER_INTENT_WORDS = ["offer", "deal", "discount", "promo", "promotion", "special", "free", "complimentary", "ofert", "oferta"];
const RECOMMENDATION_INTENT_PHRASES = ["what should i order", "what do you recommend", "what do you suggest"];
const RECOMMENDATION_INTENT_WORDS = ["recommend", "suggest", "menu", "dish", "food", "order", "popular", "signature", "favorite"];
const OPERATIONAL_QUERY_WORDS = ["open", "closed", "work", "hours", "available", "availability", "holiday", "contact", "location", "price"];

const DAY_NAME_MAP: Record<string, number> = {
  sunday: 0,
  monday: 1,
  tuesday: 2,
  wednesday: 3,
  thursday: 4,
  friday: 5,
  saturday: 6
};

const normalizeIsoDate = (value: string) => {
  const trimmed = value.trim();
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    return `${isoMatch[1]}-${isoMatch[2]}-${isoMatch[3]}`;
  }

  const dottedMatch = trimmed.match(/^(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})$/);
  if (!dottedMatch) return null;
  const day = dottedMatch[1].padStart(2, "0");
  const month = dottedMatch[2].padStart(2, "0");
  const rawYear = dottedMatch[3];
  const year = rawYear.length === 2 ? `20${rawYear}` : rawYear;
  return `${year}-${month}-${day}`;
};

const dedupeStrings = (items: Array<string | null | undefined>) =>
  Array.from(new Set(items.map((item) => (typeof item === "string" ? item.trim() : "")).filter(Boolean)));

const dedupeNumbers = (items: Array<number | null | undefined>) =>
  Array.from(new Set(items.filter((item): item is number => typeof item === "number" && Number.isFinite(item))));

const containsPhrase = (haystack: string, phrase: string) => {
  const normalizedHaystack = ` ${normalizeText(haystack)} `;
  const normalizedPhrase = normalizeText(phrase);
  if (!normalizedPhrase) return false;
  return normalizedHaystack.includes(` ${normalizedPhrase} `);
};

const isMeaningfulTriggerTerm = (value: string) => {
  const normalized = normalizeText(value);
  if (!normalized) return false;
  if (/^\d+$/.test(normalized)) return false;
  if (GENERIC_TRIGGER_TERMS.has(normalized)) return false;
  if (normalized.length < 4 && !["eid"].includes(normalized)) return false;
  return true;
};

const filterMeaningfulPhrases = (items: Array<string | null | undefined>) =>
  dedupeStrings(items).filter((item) => {
    const normalized = normalizeText(item);
    if (!normalized) return false;
    if (normalized.includes(" ")) {
      const parts = normalized.split(/\s+/).filter(Boolean);
      return parts.some((part) => isMeaningfulTriggerTerm(part));
    }
    return isMeaningfulTriggerTerm(normalized);
  });

const hasMeaningfulPhraseMatch = (message: string, phrases: Array<string | null | undefined>) =>
  filterMeaningfulPhrases(phrases).some((phrase) => containsPhrase(message, phrase));

const extractDates = (input: string) => {
  const matches = new Set<string>();
  const regex = /(\d{4}-\d{2}-\d{2}|\d{1,2}[./-]\d{1,2}[./-]\d{2,4})/g;
  for (const match of input.matchAll(regex)) {
    const normalized = normalizeIsoDate(match[0]);
    if (normalized) matches.add(normalized);
  }
  return Array.from(matches);
};

const extractWeekdays = (input: string) => {
  const normalized = normalizeText(input);
  const days = Object.entries(DAY_NAME_MAP)
    .filter(([name]) => containsPhrase(normalized, name))
    .map(([, index]) => index);
  return dedupeNumbers(days);
};

const extractLegacyKeywords = (input: string) => {
  const normalized = normalizeText(input);
  const words = normalized
    .split(/[^a-z0-9+]+/)
    .map((word) => word.trim())
    .filter((word) => word.length >= 4 && !STOPWORDS.has(word) && !/^\d+$/.test(word));
  return dedupeStrings(words).slice(0, 8);
};

const detectOccasion = (input: string) => {
  const normalized = normalizeText(input);
  for (const [label, aliases] of Object.entries(OCCASION_ALIASES)) {
    if (aliases.some((alias) => containsPhrase(normalized, alias))) {
      return {
        label,
        aliases
      };
    }
  }
  return null;
};

const extractPartyLimit = (input: string, mode: "min" | "max") => {
  const normalized = normalizeText(input);
  const regex =
    mode === "min"
      ? /\b(?:minimum|min)\s+(?:party size\s+)?(?:of\s+)?(\d{1,2})\b/
      : /\b(?:maximum|max)\s+(?:party size\s+)?(?:of\s+)?(\d{1,2})\b/;
  const match = normalized.match(regex);
  if (!match?.[1]) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
};

const inferCategory = (input: string): UpdateRuleCategory => {
  if (CLOSURE_PATTERNS.some((pattern) => pattern.test(input))) return "closure";
  if (OFFER_PATTERNS.some((pattern) => pattern.test(input))) return "offer";
  if (RECOMMENDATION_PATTERNS.some((pattern) => pattern.test(input))) return "recommendation";
  if (RESERVATION_CONSTRAINT_PATTERNS.some((pattern) => pattern.test(input))) return "reservation_constraint";
  if (FAQ_PATTERNS.some((pattern) => pattern.test(input))) return "faq";
  if (SERVICE_NOTICE_PATTERNS.some((pattern) => pattern.test(input))) return "service_notice";
  return "general_notice";
};

const ensureSentence = (value: string) => {
  const trimmed = value.replace(/\s+/g, " ").trim();
  if (!trimmed) return "";
  return /[.!?]$/.test(trimmed) ? trimmed : `${trimmed}.`;
};

const compactTitle = (text: string, fallback: string) => {
  const cleaned = text
    .replace(/\s+/g, " ")
    .replace(/^[-*\u2022\s]+/, "")
    .trim();
  if (!cleaned) return fallback;
  const limit = 54;
  if (cleaned.length <= limit) return cleaned;
  const sliced = cleaned.slice(0, limit);
  const lastSpace = sliced.lastIndexOf(" ");
  return `${(lastSpace > 20 ? sliced.slice(0, lastSpace) : sliced).trim()}...`;
};

const defaultTitleForCategory = (category: UpdateRuleCategory) => {
  switch (category) {
    case "closure":
      return "Closure notice";
    case "offer":
      return "Offer";
    case "reservation_constraint":
      return "Booking notice";
    case "recommendation":
      return "Recommendation";
    case "service_notice":
      return "Service notice";
    case "faq":
      return "FAQ";
    default:
      return "Business update";
  }
};

const splitEntryText = (input: string) =>
  input
    .split(/\n+/)
    .flatMap((block) => block.split(/(?<=[.!?])\s+(?=[A-Z0-9])/))
    .map((piece) => piece.trim())
    .filter((piece) => piece.length >= 8);

const inferOfferIntents = (text: string) => {
  const normalized = normalizeText(text);
  const intents: string[] = [];
  if (normalized.includes("offer") || normalized.includes("deal") || normalized.includes("discount") || normalized.includes("promo")) {
    intents.push("when_customer_asks_for_offers");
  }
  if (normalized.includes("free") || normalized.includes("complimentary") || normalized.includes("2 for 1")) {
    intents.push("when_customer_asks_about_promotions");
  }
  return dedupeStrings(intents.length ? intents : ["when_customer_asks_for_offers"]);
};

const inferRecommendationAliases = (text: string) => {
  const quoted = Array.from(text.matchAll(/["“”']([^"“”']{3,60})["“”']/g)).map((match) => match[1]);
  const capitalized = text
    .split(/[,.;]/)
    .map((piece) => piece.trim())
    .filter((piece) => /^[A-Z][A-Za-z0-9 '&-]{2,60}$/.test(piece));
  return filterMeaningfulPhrases([...quoted, ...capitalized, ...extractLegacyKeywords(text)]).slice(0, 6);
};

const deriveIntentLabelsFromText = (text: string) => {
  const normalized = normalizeText(text);
  const phrases: string[] = [];

  const ifAsksMatches = Array.from(
    text.matchAll(/\b(?:if|when)\s+(?:someone|somebody|customer|customers|guest|guests|people)\s+(?:asks?|ask)\s+(?:about\s+)?([^.,;!?]+)/gi)
  );
  for (const match of ifAsksMatches) {
    if (match[1]) phrases.push(match[1].trim());
  }

  const quoted = Array.from(text.matchAll(/["“”']([^"“”']{3,80})["“”']/g)).map((match) => match[1]);
  phrases.push(...quoted);

  if (normalized.includes("offer") || normalized.includes("deal") || normalized.includes("discount") || normalized.includes("promo")) {
    phrases.push("offers", "deals", "promotions");
  }
  if (normalized.includes("closed") || normalized.includes("unavailable")) {
    phrases.push("availability", "open today", "closed today");
  }

  return filterMeaningfulPhrases([...phrases, ...extractLegacyKeywords(text)]).slice(0, 6);
};

const buildDeterministicMetadata = (category: UpdateRuleCategory, text: string) => {
  const dates = extractDates(text);
  const weekdays = extractWeekdays(text);
  const occasion = detectOccasion(text);

  if (category === "closure") {
    return {
      blocked_dates: dates,
      blocked_weekdays: weekdays,
      occasion_label: occasion?.label ?? null,
      occasion_aliases: occasion?.aliases ?? [],
      scope: "reservation_and_general_queries",
      unavailable: true
    } satisfies ClosureRuleMetadata;
  }

  if (category === "offer") {
    return {
      offer_summary: ensureSentence(text),
      active_from: dates[0] ?? null,
      active_until: dates[1] ?? dates[0] ?? null,
      eligibility: null,
      customer_intents: inferOfferIntents(text),
      upsell_contexts: ["when_customer_shows_interest", "when_customer_asks_for_recommendation"]
    } satisfies OfferRuleMetadata;
  }

  if (category === "reservation_constraint") {
    return {
      blocked_dates: dates,
      blocked_weekdays: weekdays,
      min_party_size: extractPartyLimit(text, "min"),
      max_party_size: extractPartyLimit(text, "max"),
      time_windows: []
    } satisfies ReservationConstraintRuleMetadata;
  }

  if (category === "recommendation") {
    const aliases = inferRecommendationAliases(text);
    return {
      item_name: aliases[0] ?? null,
      when_to_suggest: ["when_customer_asks_for_recommendation", "when_customer_asks_what_is_popular"],
      reason: ensureSentence(text),
      aliases
    } satisfies RecommendationRuleMetadata;
  }

  if (category === "faq") {
    return {
      question_intents: deriveIntentLabelsFromText(text),
      answer_scope: "general"
    } satisfies FaqRuleMetadata;
  }

  return {
    intent_labels: deriveIntentLabelsFromText(text),
    applies_when: category === "service_notice" ? "when_customer_asks_about_availability_or_operations" : "when_business_context_matches"
  } satisfies NoticeRuleMetadata;
};

const buildDeterministicRule = (piece: string, forcedCategory?: UpdateRuleCategory): ExtractedUpdateRule => {
  const category = forcedCategory ?? inferCategory(piece);
  const metadata = buildDeterministicMetadata(category, piece);
  const occasionLabel = category === "closure" ? (metadata as ClosureRuleMetadata).occasion_label : null;

  const title =
    category === "closure" && occasionLabel
      ? `Closed for ${occasionLabel}`
      : category === "recommendation" && (metadata as RecommendationRuleMetadata).item_name
        ? `Recommend ${(metadata as RecommendationRuleMetadata).item_name}`
        : compactTitle(piece, defaultTitleForCategory(category));

  return {
    category,
    title,
    body: ensureSentence(piece),
    keywords: [],
    metadata
  };
};

const normalizeMetadata = (category: UpdateRuleCategory, metadata: unknown, textFallback: string) => {
  const base = metadata && typeof metadata === "object" ? (metadata as Record<string, unknown>) : {};
  const deterministic = buildDeterministicMetadata(category, textFallback);

  if (category === "closure") {
    const occasion = detectOccasion(`${String(base.occasion_label ?? "")} ${textFallback}`);
    return {
      blocked_dates: dedupeStrings([
        ...(Array.isArray(base.blocked_dates) ? base.blocked_dates.map(String) : []),
        ...((deterministic as ClosureRuleMetadata).blocked_dates ?? [])
      ]),
      blocked_weekdays: dedupeNumbers([
        ...(Array.isArray(base.blocked_weekdays) ? base.blocked_weekdays.map((item) => Number(item)) : []),
        ...((deterministic as ClosureRuleMetadata).blocked_weekdays ?? [])
      ]),
      occasion_label:
        typeof base.occasion_label === "string" && base.occasion_label.trim()
          ? base.occasion_label.trim()
          : occasion?.label ?? (deterministic as ClosureRuleMetadata).occasion_label ?? null,
      occasion_aliases: dedupeStrings([
        ...(Array.isArray(base.occasion_aliases) ? base.occasion_aliases.map(String) : []),
        ...(occasion?.aliases ?? []),
        ...((deterministic as ClosureRuleMetadata).occasion_aliases ?? [])
      ]),
      scope:
        base.scope === "reservation_only" || base.scope === "general_queries" || base.scope === "reservation_and_general_queries"
          ? base.scope
          : "reservation_and_general_queries",
      unavailable: true
    } satisfies ClosureRuleMetadata;
  }

  if (category === "offer") {
    return {
      offer_summary:
        typeof base.offer_summary === "string" && base.offer_summary.trim()
          ? ensureSentence(base.offer_summary)
          : ensureSentence(textFallback),
      active_from:
        typeof base.active_from === "string" && normalizeIsoDate(base.active_from)
          ? normalizeIsoDate(base.active_from)
          : (deterministic as OfferRuleMetadata).active_from ?? null,
      active_until:
        typeof base.active_until === "string" && normalizeIsoDate(base.active_until)
          ? normalizeIsoDate(base.active_until)
          : (deterministic as OfferRuleMetadata).active_until ?? null,
      eligibility: typeof base.eligibility === "string" && base.eligibility.trim() ? base.eligibility.trim() : null,
      customer_intents: dedupeStrings([
        ...(Array.isArray(base.customer_intents) ? base.customer_intents.map(String) : []),
        ...((deterministic as OfferRuleMetadata).customer_intents ?? [])
      ]),
      upsell_contexts: dedupeStrings([
        ...(Array.isArray(base.upsell_contexts) ? base.upsell_contexts.map(String) : []),
        ...((deterministic as OfferRuleMetadata).upsell_contexts ?? [])
      ])
    } satisfies OfferRuleMetadata;
  }

  if (category === "recommendation") {
    return {
      item_name:
        typeof base.item_name === "string" && base.item_name.trim()
          ? base.item_name.trim()
          : (deterministic as RecommendationRuleMetadata).item_name ?? null,
      when_to_suggest: dedupeStrings([
        ...(Array.isArray(base.when_to_suggest) ? base.when_to_suggest.map(String) : []),
        ...((deterministic as RecommendationRuleMetadata).when_to_suggest ?? [])
      ]),
      reason:
        typeof base.reason === "string" && base.reason.trim()
          ? ensureSentence(base.reason)
          : ensureSentence(textFallback),
      aliases: dedupeStrings([
        ...(Array.isArray(base.aliases) ? base.aliases.map(String) : []),
        ...((deterministic as RecommendationRuleMetadata).aliases ?? [])
      ])
    } satisfies RecommendationRuleMetadata;
  }

  if (category === "reservation_constraint") {
    return {
      blocked_dates: dedupeStrings([
        ...(Array.isArray(base.blocked_dates) ? base.blocked_dates.map(String) : []),
        ...((deterministic as ReservationConstraintRuleMetadata).blocked_dates ?? [])
      ]),
      blocked_weekdays: dedupeNumbers([
        ...(Array.isArray(base.blocked_weekdays) ? base.blocked_weekdays.map((item) => Number(item)) : []),
        ...((deterministic as ReservationConstraintRuleMetadata).blocked_weekdays ?? [])
      ]),
      min_party_size:
        typeof base.min_party_size === "number"
          ? base.min_party_size
          : (deterministic as ReservationConstraintRuleMetadata).min_party_size ?? null,
      max_party_size:
        typeof base.max_party_size === "number"
          ? base.max_party_size
          : (deterministic as ReservationConstraintRuleMetadata).max_party_size ?? null,
      time_windows: dedupeStrings([
        ...(Array.isArray(base.time_windows) ? base.time_windows.map(String) : []),
        ...((deterministic as ReservationConstraintRuleMetadata).time_windows ?? [])
      ])
    } satisfies ReservationConstraintRuleMetadata;
  }

  if (category === "faq") {
    return {
      question_intents: dedupeStrings([
        ...(Array.isArray(base.question_intents) ? base.question_intents.map(String) : []),
        ...((deterministic as FaqRuleMetadata).question_intents ?? [])
      ]),
      answer_scope:
        typeof base.answer_scope === "string" && base.answer_scope.trim()
          ? base.answer_scope.trim()
          : "general"
    } satisfies FaqRuleMetadata;
  }

  return {
    intent_labels: dedupeStrings([
      ...(Array.isArray(base.intent_labels) ? base.intent_labels.map(String) : []),
      ...((deterministic as NoticeRuleMetadata).intent_labels ?? [])
    ]),
    applies_when:
      typeof base.applies_when === "string" && base.applies_when.trim()
        ? base.applies_when.trim()
        : (deterministic as NoticeRuleMetadata).applies_when ?? null
  } satisfies NoticeRuleMetadata;
};

const buildLegacyKeywordsFromMetadata = (category: UpdateRuleCategory, metadata: UpdateRuleMetadata, title: string) => {
  if (category === "closure") {
    const closure = metadata as ClosureRuleMetadata;
    return filterMeaningfulPhrases([...(closure.occasion_aliases ?? []), closure.occasion_label ?? null]).slice(0, 6);
  }

  if (category === "recommendation") {
    const recommendation = metadata as RecommendationRuleMetadata;
    return filterMeaningfulPhrases([recommendation.item_name ?? null, ...(recommendation.aliases ?? [])]).slice(0, 6);
  }

  if (category === "offer") {
    const offer = metadata as OfferRuleMetadata;
    return filterMeaningfulPhrases([...(offer.customer_intents ?? []), title]).slice(0, 6);
  }

  if (category === "faq") {
    const faq = metadata as FaqRuleMetadata;
    return filterMeaningfulPhrases(faq.question_intents ?? []).slice(0, 6);
  }

  const notice = metadata as NoticeRuleMetadata;
  return filterMeaningfulPhrases(notice.intent_labels ?? []).slice(0, 6);
};

const normalizeExtractedRule = (rule: Partial<ExtractedUpdateRule>, fallbackText: string): ExtractedUpdateRule => {
  const category = UPDATE_RULE_CATEGORIES.includes(rule.category as UpdateRuleCategory)
    ? (rule.category as UpdateRuleCategory)
    : inferCategory(fallbackText);
  const body = ensureSentence(typeof rule.body === "string" && rule.body.trim() ? rule.body : fallbackText);
  const metadata = normalizeMetadata(category, rule.metadata, body);
  const occasionLabel = category === "closure" ? (metadata as ClosureRuleMetadata).occasion_label : null;
  const title =
    typeof rule.title === "string" && rule.title.trim()
      ? rule.title.trim()
      : category === "closure" && occasionLabel
        ? `Closed for ${occasionLabel}`
        : compactTitle(body, defaultTitleForCategory(category));

  return {
    category,
    title,
    body,
    keywords: buildLegacyKeywordsFromMetadata(category, metadata, title),
    metadata
  };
};

const buildTriggerSummaryFromRule = (rule: Pick<ChatbotUpdateRuleRow, "category" | "metadata" | "title" | "body">) => {
  const metadata = normalizeMetadata(rule.category, rule.metadata, `${rule.title}. ${rule.body}`);

  if (rule.category === "closure") {
    const closure = metadata as ClosureRuleMetadata;
    const dates = closure.blocked_dates?.length ? closure.blocked_dates.join(", ") : "specific blocked dates";
    const label = closure.occasion_label ? ` for ${closure.occasion_label}` : "";
    return `Triggers when a customer asks about reservations or availability${label}; blocks ${dates}.`;
  }

  if (rule.category === "offer") {
    const offer = metadata as OfferRuleMetadata;
    return `Triggers when customers ask about offers, deals, or promotions${offer.active_until ? ` until ${offer.active_until}` : ""}.`;
  }

  if (rule.category === "recommendation") {
    const recommendation = metadata as RecommendationRuleMetadata;
    return `Triggers when customers ask what to order or what you recommend${recommendation.item_name ? `; suggests ${recommendation.item_name}` : ""}.`;
  }

  if (rule.category === "reservation_constraint") {
    const constraint = metadata as ReservationConstraintRuleMetadata;
    const parts = [
      constraint.blocked_dates?.length ? `dates: ${constraint.blocked_dates.join(", ")}` : null,
      constraint.min_party_size ? `minimum party: ${constraint.min_party_size}` : null,
      constraint.max_party_size ? `maximum party: ${constraint.max_party_size}` : null
    ].filter(Boolean);
    return `Triggers during reservation checks${parts.length ? `; ${parts.join("; ")}` : ""}.`;
  }

  if (rule.category === "faq") {
    return "Triggers when customers ask a matching question about the business.";
  }

  return "Triggers when the customer asks about matching business info or availability.";
};

const tryAiExtraction = async (input: string, drafts: ExtractedUpdateRule[]): Promise<ExtractedUpdateRule[] | null> => {
  const openai = getOpenAIClient();
  if (!openai) return null;

  try {
    const completion = await openai.chat.completions.create({
      model: UPDATE_INFO_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You convert business updates into structured chatbot rules. Return JSON only. Do not invent facts. Never output low-value keywords like are, because, or years. Use metadata, not keywords, as the trigger source."
        },
        {
          role: "user",
          content: JSON.stringify({
            task: "Refine deterministic business-update rule drafts into structured candidate rules.",
            input,
            allowed_categories: UPDATE_RULE_CATEGORIES,
            requirements: {
              closure: ["blocked_dates", "blocked_weekdays", "occasion_label", "occasion_aliases", "scope"],
              offer: ["offer_summary", "active_from", "active_until", "eligibility", "customer_intents", "upsell_contexts"],
              recommendation: ["item_name", "when_to_suggest", "reason", "aliases"],
              reservation_constraint: ["blocked_dates", "blocked_weekdays", "min_party_size", "max_party_size", "time_windows"],
              faq: ["question_intents", "answer_scope"],
              general_notice: ["intent_labels", "applies_when"],
              service_notice: ["intent_labels", "applies_when"]
            },
            drafts,
            response_shape: {
              rules: [
                {
                  category: "closure",
                  title: "Closed for Eid",
                  body: "We are closed on 2026-03-22 because of Eid.",
                  metadata: {
                    blocked_dates: ["2026-03-22"],
                    occasion_label: "Eid",
                    occasion_aliases: ["eid", "bajram"],
                    scope: "reservation_and_general_queries"
                  }
                }
              ]
            }
          })
        }
      ]
    });

    const raw = completion.choices?.[0]?.message?.content ?? "";
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { rules?: Array<Partial<ExtractedUpdateRule>> };
    if (!Array.isArray(parsed.rules) || !parsed.rules.length) return null;
    return parsed.rules.map((rule, index) => normalizeExtractedRule(rule, drafts[index]?.body ?? input));
  } catch (error) {
    log("warn", "Update info AI extraction fallback", { error });
    return null;
  }
};

export async function extractUpdateRules(input: string): Promise<ExtractedUpdateRule[]> {
  const pieces = splitEntryText(input);
  const sourcePieces = pieces.length ? pieces : [input.trim()].filter(Boolean);
  const deterministic = sourcePieces.map((piece) => buildDeterministicRule(piece));
  const refined = await tryAiExtraction(input, deterministic);
  return refined?.length ? refined : deterministic;
}

const normalizeStoredRule = (rule: ChatbotUpdateRuleRow): ChatbotUpdateRuleRow => {
  const normalized = normalizeExtractedRule(
    {
      ...rule,
      metadata: rule.metadata ?? undefined
    },
    `${rule.title}. ${rule.body}`
  );
  return {
    ...rule,
    title: normalized.title,
    body: normalized.body,
    keywords: Array.isArray(rule.keywords) && rule.keywords.length ? filterMeaningfulPhrases(rule.keywords) : normalized.keywords,
    metadata: normalized.metadata,
    triggerSummary: buildTriggerSummaryFromRule({
      category: normalized.category,
      metadata: normalized.metadata,
      title: normalized.title,
      body: normalized.body
    })
  };
};

const inferIntentBuckets = (message: string, context?: UpdateRuleSelectionContext) => {
  const normalized = normalizeText(message);
  const tokens = new Set(normalized.split(" ").filter(Boolean));
  const reservationIntent =
    context?.reservationFlowActive ||
    RESERVATION_INTENT_PHRASES.some((phrase) => normalized.includes(phrase)) ||
    RESERVATION_INTENT_WORDS.some((word) => tokens.has(word));
  const offerIntent = OFFER_INTENT_WORDS.some((word) => tokens.has(word));
  const recommendationIntent =
    RECOMMENDATION_INTENT_PHRASES.some((phrase) => normalized.includes(phrase)) ||
    RECOMMENDATION_INTENT_WORDS.some((word) => normalized.includes(word));
  const operationalIntent = OPERATIONAL_QUERY_WORDS.some((word) => tokens.has(word));
  return { normalized, reservationIntent, offerIntent, recommendationIntent, operationalIntent };
};

const matchesAliasList = (message: string, aliases: Array<string | null | undefined>) =>
  hasMeaningfulPhraseMatch(message, aliases);

const ruleHasReservationConstraintSignals = (rule: ChatbotUpdateRuleRow) => {
  const metadata = rule.metadata as ReservationConstraintRuleMetadata;
  return Boolean(
    metadata?.blocked_dates?.length ||
      metadata?.blocked_weekdays?.length ||
      typeof metadata?.min_party_size === "number" ||
      typeof metadata?.max_party_size === "number" ||
      metadata?.time_windows?.length
  );
};

const getStrongRulePhrases = (rule: ChatbotUpdateRuleRow) => {
  if (rule.category === "closure") {
    const closure = rule.metadata as ClosureRuleMetadata;
    return filterMeaningfulPhrases([closure.occasion_label ?? null, ...(closure.occasion_aliases ?? []), rule.title]);
  }

  if (rule.category === "recommendation") {
    const recommendation = rule.metadata as RecommendationRuleMetadata;
    return filterMeaningfulPhrases([recommendation.item_name ?? null, ...(recommendation.aliases ?? []), rule.title]);
  }

  if (rule.category === "offer") {
    const offer = rule.metadata as OfferRuleMetadata;
    return filterMeaningfulPhrases([...(offer.customer_intents ?? []), rule.title]);
  }

  if (rule.category === "faq") {
    const faq = rule.metadata as FaqRuleMetadata;
    return filterMeaningfulPhrases([...(faq.question_intents ?? []), rule.title]);
  }

  const notice = rule.metadata as NoticeRuleMetadata;
  return filterMeaningfulPhrases([...(notice.intent_labels ?? []), rule.title]);
};

const isStrongRuleMatch = (rule: ChatbotUpdateRuleRow, message: string, context?: UpdateRuleSelectionContext) => {
  const normalized = normalizeText(message);
  if (!normalized) return false;

  if (context?.reservationDate && findBlockingRulesForDate([rule], context.reservationDate, context.partySize ?? null).length) {
    return true;
  }

  return hasMeaningfulPhraseMatch(normalized, getStrongRulePhrases(rule));
};

export function findMatchingUpdateRules(
  rules: ChatbotUpdateRuleRow[],
  message: string,
  context?: UpdateRuleSelectionContext
) {
  const normalizedRules = rules.map(normalizeStoredRule).filter((rule) => rule.enabled && rule.approval_status === "approved");
  const { normalized, reservationIntent, offerIntent, recommendationIntent, operationalIntent } = inferIntentBuckets(message, context);

  return normalizedRules.filter((rule) => {
    if (context?.reservationDate && findBlockingRulesForDate([rule], context.reservationDate, context.partySize ?? null).length) {
      return true;
    }

    if (rule.category === "closure") {
      const closure = rule.metadata as ClosureRuleMetadata;
      return matchesAliasList(normalized, [closure.occasion_label ?? null, ...(closure.occasion_aliases ?? [])]);
    }

    if (rule.category === "reservation_constraint") {
      if (context?.reservationDate && findBlockingRulesForDate([rule], context.reservationDate, context.partySize ?? null).length) {
        return true;
      }
      return reservationIntent && ruleHasReservationConstraintSignals(rule);
    }

    if (rule.category === "offer") {
      const offer = rule.metadata as OfferRuleMetadata;
      return offerIntent || hasMeaningfulPhraseMatch(normalized, [...(offer.customer_intents ?? []), rule.title]);
    }

    if (rule.category === "recommendation") {
      const recommendation = rule.metadata as RecommendationRuleMetadata;
      return recommendationIntent || hasMeaningfulPhraseMatch(normalized, [recommendation.item_name ?? null, ...(recommendation.aliases ?? []), rule.title]);
    }

    if (rule.category === "faq") {
      const faq = rule.metadata as FaqRuleMetadata;
      return operationalIntent || hasMeaningfulPhraseMatch(normalized, [...(faq.question_intents ?? []), rule.title]);
    }

    const notice = rule.metadata as NoticeRuleMetadata;
    if (operationalIntent) return true;
    return hasMeaningfulPhraseMatch(normalized, [...(notice.intent_labels ?? []), rule.title]);
  });
}

const selectRelevantRuleIdsWithAI = async (
  message: string,
  rules: ChatbotUpdateRuleRow[],
  context?: UpdateRuleSelectionContext
): Promise<string[] | null> => {
  const openai = getOpenAIClient();
  if (!openai || !rules.length) return null;

  try {
    const completion = await openai.chat.completions.create({
      model: UPDATE_INFO_MODEL,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You select which business rules are relevant to a customer message. Return JSON only. Choose only rules that should actively influence the reply right now. Never select a rule based on generic words, stopwords, or years alone."
        },
        {
          role: "user",
          content: JSON.stringify({
            message,
            context: context ?? {},
            rules: rules.map((rule) => ({
              id: rule.id,
              category: rule.category,
              title: rule.title,
              body: rule.body,
              triggerSummary: rule.triggerSummary ?? buildTriggerSummaryFromRule(rule),
              metadata: rule.metadata
            })),
            response_shape: {
              relevantRuleIds: ["rule-id"],
              reason: "brief reason"
            }
          })
        }
      ]
    });

    const raw = completion.choices?.[0]?.message?.content ?? "";
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { relevantRuleIds?: string[] };
    if (!Array.isArray(parsed.relevantRuleIds)) return null;
    return parsed.relevantRuleIds.filter((id) => typeof id === "string");
  } catch (error) {
    log("warn", "Update info AI selection fallback", { error });
    return null;
  }
};

export async function selectRelevantUpdateRules(
  rules: ChatbotUpdateRuleRow[],
  message: string,
  context?: UpdateRuleSelectionContext
) {
  const candidates = findMatchingUpdateRules(rules, message, context);
  if (!candidates.length) return [];

  const exactMatches = candidates.filter((rule) => isStrongRuleMatch(rule, message, context));
  if (exactMatches.length === 1) return exactMatches;
  if (exactMatches.length > 1) return exactMatches;

  const narrowed = candidates.slice(0, 10);
  const selectedIds = await selectRelevantRuleIdsWithAI(message, narrowed, context);
  if (selectedIds?.length) {
    const selected = narrowed.filter((rule) => selectedIds.includes(rule.id));
    if (selected.length) return selected;
  }

  return narrowed;
}

export function findOccasionClosureRules(rules: ChatbotUpdateRuleRow[], message: string) {
  const normalized = normalizeText(message);
  return rules
    .map(normalizeStoredRule)
    .filter((rule) => rule.category === "closure")
    .filter((rule) =>
      hasMeaningfulPhraseMatch(
        normalized,
        [
          (rule.metadata as ClosureRuleMetadata).occasion_label ?? null,
          ...((rule.metadata as ClosureRuleMetadata).occasion_aliases ?? [])
        ]
      )
    );
}

export function hydrateUpdateRuleRows(rows: ChatbotUpdateRuleRow[]) {
  return rows.map(normalizeStoredRule);
}

export function buildTriggerSummary(rule: Pick<ChatbotUpdateRuleRow, "category" | "metadata" | "title" | "body">) {
  return buildTriggerSummaryFromRule(rule);
}

export function findBlockingRulesForDate(rules: ChatbotUpdateRuleRow[], isoDate: string, partySize?: number | null) {
  const weekday = new Date(`${isoDate}T12:00:00Z`).getUTCDay();
  return rules.map(normalizeStoredRule).filter((rule) => {
    if (!rule.enabled || rule.approval_status !== "approved") return false;
    if (rule.category !== "closure" && rule.category !== "reservation_constraint") return false;
    const metadata = rule.metadata as ClosureRuleMetadata & ReservationConstraintRuleMetadata;
    const blockedDates = Array.isArray(metadata.blocked_dates) ? metadata.blocked_dates : [];
    const blockedWeekdays = Array.isArray(metadata.blocked_weekdays) ? metadata.blocked_weekdays : [];
    const minPartySize = typeof metadata.min_party_size === "number" ? metadata.min_party_size : null;
    const maxPartySize = typeof metadata.max_party_size === "number" ? metadata.max_party_size : null;

    const matchesDate = blockedDates.includes(isoDate) || blockedWeekdays.includes(weekday);
    const partyBlocked =
      (minPartySize !== null && typeof partySize === "number" && partySize < minPartySize) ||
      (maxPartySize !== null && typeof partySize === "number" && partySize > maxPartySize);

    return matchesDate || partyBlocked;
  });
}

export async function listApprovedUpdateRules(admin: any, businessId: string): Promise<ChatbotUpdateRuleRow[]> {
  const { data, error } = await admin
    .from("chatbot_update_rules")
    .select("id,business_id,entry_id,category,title,body,keywords,metadata,enabled,approval_status,created_at,updated_at")
    .eq("business_id", businessId)
    .eq("approval_status", "approved")
    .eq("enabled", true)
    .order("created_at", { ascending: false })
    .limit(120);

  if (error) {
    if (isMissingUpdateInfoSchemaError(error)) {
      return [];
    }
    throw error;
  }

  return ((data ?? []) as ChatbotUpdateRuleRow[]).map(normalizeStoredRule);
}

export async function syncEntryStatus(supabase: any, entryId: string) {
  const { data: rules, error } = await supabase.from("chatbot_update_rules").select("approval_status").eq("entry_id", entryId);

  if (error) {
    if (isMissingUpdateInfoSchemaError(error)) return;
    throw error;
  }

  const statuses = (rules ?? []).map((row: any) => String(row.approval_status));
  const nextStatus = statuses.some((status: string) => status === "approved")
    ? "applied"
    : statuses.every((status: string) => status === "discarded")
      ? "discarded"
      : "pending_review";

  const { error: updateError } = await supabase.from("chatbot_update_entries").update({ status: nextStatus }).eq("id", entryId);

  if (updateError) {
    if (isMissingUpdateInfoSchemaError(updateError)) return;
    throw updateError;
  }
}

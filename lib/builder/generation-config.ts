export const CONTENT_LANGUAGES = [
  { value: "en", label: "English", locale: "en-GB" },
  { value: "sq", label: "Shqip", locale: "sq-AL" }
] as const;

export const QUALITY_MODES = ["fast", "balanced", "best"] as const;

export const CTA_GOALS = [
  "book_appointment",
  "book_call",
  "get_quote",
  "visit_us",
  "buy_now",
  "request_demo",
  "reserve_table",
  "contact"
] as const;

export type ContentLanguage = (typeof CONTENT_LANGUAGES)[number]["value"];
export type QualityMode = (typeof QUALITY_MODES)[number];
export type GenerationPrimaryCtaGoal = (typeof CTA_GOALS)[number];

export type GenerationBriefData = {
  audience: string;
  coreOffer: string;
  primaryCtaGoal: GenerationPrimaryCtaGoal;
  topServices: string[];
  proofPoints: string[];
  tone: string;
};

const trimValue = (value: unknown) => {
  if (typeof value !== "string") return "";
  return value.trim();
};

const normalizeList = (value: unknown, minLength = 0) => {
  const source = Array.isArray(value) ? value : [];
  const items = source
    .map((item) => trimValue(item))
    .filter(Boolean);

  while (items.length < minLength) {
    items.push("");
  }

  return items;
};

export const createEmptyGenerationBrief = (tone = "professional"): GenerationBriefData => ({
  audience: "",
  coreOffer: "",
  primaryCtaGoal: "contact",
  topServices: ["", "", ""],
  proofPoints: ["", "", ""],
  tone
});

export const normalizeGenerationBriefForForm = (
  value: unknown,
  fallbackTone = "professional"
): GenerationBriefData => {
  const source = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

  return {
    audience: trimValue(source.audience),
    coreOffer: trimValue(source.coreOffer),
    primaryCtaGoal: CTA_GOALS.includes(source.primaryCtaGoal as GenerationPrimaryCtaGoal)
      ? (source.primaryCtaGoal as GenerationPrimaryCtaGoal)
      : "contact",
    topServices: normalizeList(source.topServices, 3).slice(0, 3),
    proofPoints: normalizeList(source.proofPoints, 3).slice(0, 3),
    tone: trimValue(source.tone) || fallbackTone
  };
};

export const sanitizeGenerationBrief = (
  value: unknown,
  fallbackTone = "professional"
): GenerationBriefData => {
  const normalized = normalizeGenerationBriefForForm(value, fallbackTone);

  return {
    audience: normalized.audience,
    coreOffer: normalized.coreOffer,
    primaryCtaGoal: normalized.primaryCtaGoal,
    topServices: normalized.topServices.map((item) => item.trim()).filter(Boolean),
    proofPoints: normalized.proofPoints.map((item) => item.trim()).filter(Boolean),
    tone: normalized.tone || fallbackTone
  };
};

export const isGenerationBriefComplete = (value: GenerationBriefData | null | undefined) => {
  if (!value) return false;
  return Boolean(
    value.audience.trim() &&
      value.coreOffer.trim() &&
      value.tone.trim() &&
      value.topServices.map((item) => item.trim()).filter(Boolean).length >= 3
  );
};

export const normalizeContentLanguage = (value: unknown): ContentLanguage => {
  const normalized = trimValue(value).toLowerCase();
  return CONTENT_LANGUAGES.some((item) => item.value === normalized)
    ? (normalized as ContentLanguage)
    : "en";
};

export const normalizeQualityMode = (value: unknown): QualityMode => {
  const normalized = trimValue(value).toLowerCase();
  return QUALITY_MODES.includes(normalized as QualityMode)
    ? (normalized as QualityMode)
    : "balanced";
};

export const resolveLocaleFromLanguage = (value: unknown) => {
  const language = normalizeContentLanguage(value);
  return CONTENT_LANGUAGES.find((item) => item.value === language)?.locale ?? "en-GB";
};

export const primaryGoalLabel = (goal: GenerationPrimaryCtaGoal) => {
  switch (goal) {
    case "book_appointment":
      return "Book Appointment";
    case "book_call":
      return "Book a Call";
    case "get_quote":
      return "Get a Quote";
    case "visit_us":
      return "Visit Us";
    case "buy_now":
      return "Buy Now";
    case "request_demo":
      return "Request Demo";
    case "reserve_table":
      return "Reserve a Table";
    case "contact":
    default:
      return "Contact Us";
  }
};

export const primaryGoalHref = (goal: GenerationPrimaryCtaGoal) => {
  switch (goal) {
    case "buy_now":
      return "/shop";
    case "visit_us":
      return "/#contact";
    case "reserve_table":
      return "/#reservations";
    case "book_appointment":
    case "book_call":
    case "get_quote":
    case "request_demo":
    case "contact":
    default:
      return "/#contact";
  }
};

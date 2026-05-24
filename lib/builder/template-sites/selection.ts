import type { IntegratedTemplateId, TemplateSelectionResult } from "@/lib/builder/template-sites/schema";
import type { ThemeStyleId } from "@/lib/builder/template-sites/themes";

type RestaurantIntentInput = {
  prompt?: string | null;
  rawPrompt?: string | null;
  enhancedPrompt?: string | null;
  industry?: string | null;
  businessName?: string | null;
  services?: Array<string | null | undefined> | null;
  templateId?: string | null;
  templateKey?: string | null;
  generationBrief?: {
    primaryCtaGoal?: string | null;
    coreOffer?: string | null;
    topServices?: Array<string | null | undefined> | null;
  } | null;
  features?: {
    includeReservation?: boolean | null;
    includeGallery?: boolean | null;
  } | null;
};

export type RestaurantIntentDecision = {
  isRestaurant: boolean;
  score: number;
  matchedSignals: string[];
  reason: string;
};

const TEMPLATE_KEYWORDS: Record<IntegratedTemplateId, Array<{ term: string; score: number }>> = {
  evasion: [
    { term: "steakhouse", score: 6 },
    { term: "rooftop", score: 4 },
    { term: "dramatic", score: 4 },
    { term: "cinematic", score: 4 },
    { term: "bold", score: 3 },
    { term: "dark", score: 3 },
    { term: "premium", score: 3 },
    { term: "grill", score: 2 }
  ],
  essence: [
    { term: "fine dining", score: 5 },
    { term: "tasting menu", score: 5 },
    { term: "chef-driven", score: 4 },
    { term: "editorial", score: 4 },
    { term: "luxury", score: 4 },
    { term: "elegant", score: 3 },
    { term: "sommelier", score: 2 },
    { term: "michelin", score: 3 }
  ],
  hously: [
    { term: "sushi", score: 5 },
    { term: "brunch", score: 4 },
    { term: "cafe", score: 4 },
    { term: "minimal", score: 4 },
    { term: "modern", score: 3 },
    { term: "clean", score: 3 },
    { term: "contemporary", score: 3 },
    { term: "casual dining", score: 2 }
  ],
  "food-truck": [
    { term: "burger", score: 5 },
    { term: "comfort food", score: 4 },
    { term: "street food", score: 4 },
    { term: "fast casual", score: 4 },
    { term: "fried chicken", score: 4 },
    { term: "casual", score: 3 },
    { term: "practical", score: 3 },
    { term: "food truck", score: 2 }
  ]
};

const RESTAURANT_SIGNAL_RULES = [
  { term: "restaurant", score: 4 },
  { term: "dining", score: 3 },
  { term: "hospitality", score: 4 },
  { term: "food & beverage", score: 4 },
  { term: "food and beverage", score: 4 },
  { term: "menu", score: 3 },
  { term: "reservation", score: 4 },
  { term: "reserve a table", score: 4 },
  { term: "table booking", score: 4 },
  { term: "private dining", score: 4 },
  { term: "chef's table", score: 4 },
  { term: "chef", score: 2 },
  { term: "steakhouse", score: 5 },
  { term: "sushi", score: 5 },
  { term: "omakase", score: 5 },
  { term: "italian restaurant", score: 5 },
  { term: "pizzeria", score: 5 },
  { term: "pizza", score: 3 },
  { term: "pasta", score: 2 },
  { term: "burger", score: 4 },
  { term: "grill", score: 3 },
  { term: "brunch", score: 4 },
  { term: "cafe", score: 4 },
  { term: "coffee shop", score: 4 },
  { term: "bakery", score: 4 },
  { term: "bistro", score: 4 },
  { term: "tasting menu", score: 4 },
  { term: "food truck", score: 4 },
  { term: "wine bar", score: 3 },
  { term: "trattoria", score: 4 }
] as const;

const RESTAURANT_TEMPLATE_VALUES = new Set([
  "evasion",
  "essence",
  "hously",
  "food-truck",
  "restaurant-editorial",
  "restaurant_v1"
]);

const RESTAURANT_CTA_GOALS = new Set(["reserve_table"]);

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const countTokenMatches = (text: string, term: string) => {
  const normalizedTerm = term.trim().toLowerCase();
  if (!normalizedTerm) return 0;
  const pattern = new RegExp(
    `(^|[^a-z0-9])${escapeRegExp(normalizedTerm).replace(/\s+/g, "[^a-z0-9]+")}([^a-z0-9]|$)`,
    "i"
  );
  return pattern.test(text) ? 1 : 0;
};

const uniqueNormalizedStrings = (
  values: Array<string | null | undefined>
) =>
  Array.from(
    new Set(
      values
        .map((value) => value?.trim().toLowerCase())
        .filter((value): value is string => Boolean(value))
    )
  );

export const resolveRestaurantIntent = ({
  prompt,
  rawPrompt,
  enhancedPrompt,
  industry,
  businessName,
  services,
  templateId,
  templateKey,
  generationBrief,
  features
}: RestaurantIntentInput): RestaurantIntentDecision => {
  const searchableText = uniqueNormalizedStrings([
    prompt,
    rawPrompt,
    enhancedPrompt,
    industry,
    businessName,
    generationBrief?.coreOffer,
    ...(services ?? []),
    ...(generationBrief?.topServices ?? [])
  ]).join("\n");
  const matchedSignals = new Set<string>();
  let score = 0;

  for (const rule of RESTAURANT_SIGNAL_RULES) {
    if (!countTokenMatches(searchableText, rule.term)) continue;
    matchedSignals.add(rule.term);
    score += rule.score;
  }

  if (templateId && RESTAURANT_TEMPLATE_VALUES.has(templateId)) {
    matchedSignals.add(`template:${templateId}`);
    score += 5;
  }

  if (templateKey && RESTAURANT_TEMPLATE_VALUES.has(templateKey)) {
    matchedSignals.add(`templateKey:${templateKey}`);
    score += 5;
  }

  if (
    generationBrief?.primaryCtaGoal &&
    RESTAURANT_CTA_GOALS.has(generationBrief.primaryCtaGoal)
  ) {
    matchedSignals.add(`cta:${generationBrief.primaryCtaGoal}`);
    score += 5;
  }

  if (features?.includeReservation) {
    matchedSignals.add("feature:reservation");
    score += 4;
  }

  const isRestaurant = score >= 4;

  return {
    isRestaurant,
    score,
    matchedSignals: Array.from(matchedSignals),
    reason: isRestaurant
      ? `Restaurant intent detected from: ${Array.from(matchedSignals).join(", ")}`
      : "No restaurant-specific template, content, CTA, or industry signals were strong enough."
  };
};

export const isRestaurantStylePrompt = (prompt: string, industry?: string | null) => {
  return resolveRestaurantIntent({ prompt, industry }).isRestaurant;
};

export const selectRestaurantTemplate = (
  prompt: string,
  industry?: string | null,
  _themeStyle?: ThemeStyleId | null,
  _palette?: {
    primaryColor?: string | null;
    secondaryColor?: string | null;
  }
): TemplateSelectionResult => {
  const normalized = `${prompt} ${industry ?? ""}`.toLowerCase();
  const scores: Record<IntegratedTemplateId, number> = {
    evasion: 0,
    essence: 0,
    hously: 0,
    "food-truck": 0
  };
  const matchedKeywords = new Set<string>();

  (Object.keys(TEMPLATE_KEYWORDS) as IntegratedTemplateId[]).forEach((template) => {
    for (const rule of TEMPLATE_KEYWORDS[template]) {
      if (!countTokenMatches(normalized, rule.term)) continue;
      scores[template] += rule.score;
      matchedKeywords.add(rule.term);
    }
  });

  if (countTokenMatches(normalized, "restaurant") || countTokenMatches(normalized, "dining")) {
    scores.hously += 1;
    scores.essence += 1;
  }

  const ordered = (Object.entries(scores) as Array<[IntegratedTemplateId, number]>).sort(
    (left, right) => {
      if (right[1] !== left[1]) return right[1] - left[1];
      const templatePriority: Record<IntegratedTemplateId, number> = {
        hously: 0,
        essence: 1,
        evasion: 2,
        "food-truck": 3
      };
      return templatePriority[left[0]] - templatePriority[right[0]];
    }
  );
  const [bestTemplate, bestScore] = ordered[0];
  const template = bestScore > 0 ? bestTemplate : "hously";
  const reason =
    bestScore > 0
      ? matchedKeywords.size
        ? `Selected ${template} from prompt and business keywords: ${Array.from(matchedKeywords).join(", ")}`
        : `Selected ${template} from broad restaurant intent and the safest matching layout cues.`
      : "Selected hously as the safest modern restaurant default for an ambiguous prompt.";

  return {
    template,
    reason,
    matchedKeywords: Array.from(matchedKeywords),
    scores
  };
};

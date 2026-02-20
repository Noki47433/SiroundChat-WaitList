import { normalizeText } from "@/lib/notifications/detectors";

export type CatalogItem = {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  tags: unknown;
};

export type Recommendation = {
  id: string;
  name: string;
  description: string | null;
  price: number | null;
  reason: string;
  score: number;
};

type Preferences = {
  spicy: boolean;
  vegan: boolean;
  light: boolean;
  sweet: boolean;
  budget: boolean;
  group: boolean;
};

const emptyPreferences = (): Preferences => ({
  spicy: false,
  vegan: false,
  light: false,
  sweet: false,
  budget: false,
  group: false
});

const parseTags = (input: unknown) => {
  if (Array.isArray(input)) {
    return input.map((value) => normalizeText(String(value))).filter(Boolean);
  }

  if (input && typeof input === "object") {
    const asRecord = input as Record<string, unknown>;
    if (Array.isArray(asRecord.items)) {
      return asRecord.items.map((value) => normalizeText(String(value))).filter(Boolean);
    }
  }

  return [] as string[];
};

export function extractPreferences(message: string): Preferences {
  const normalized = normalizeText(message);
  const prefs = emptyPreferences();

  if (!normalized) return prefs;

  prefs.spicy = normalized.includes("spicy") || normalized.includes("hot");
  prefs.vegan = normalized.includes("vegan") || normalized.includes("vegetarian") || normalized.includes("veg");
  prefs.light = normalized.includes("light") || normalized.includes("healthy") || normalized.includes("low calorie");
  prefs.sweet = normalized.includes("sweet") || normalized.includes("dessert");
  prefs.budget = normalized.includes("budget") || normalized.includes("cheap") || normalized.includes("affordable");
  prefs.group =
    normalized.includes("group") || normalized.includes("family") || normalized.includes("for 4") || normalized.includes("for 5");

  return prefs;
}

const scoreItem = (item: CatalogItem, prefs: Preferences) => {
  const tags = parseTags(item.tags);
  let score = 0;
  const reasons: string[] = [];

  const hasTag = (tag: string) => tags.includes(normalizeText(tag));

  if (prefs.spicy && (hasTag("spicy") || hasTag("hot"))) {
    score += 25;
    reasons.push("matches spicy preference");
  }

  if (prefs.vegan && (hasTag("vegan") || hasTag("vegetarian") || hasTag("veg"))) {
    score += 25;
    reasons.push("fits vegan preference");
  }

  if (prefs.light && (hasTag("light") || hasTag("healthy"))) {
    score += 20;
    reasons.push("lighter option");
  }

  if (prefs.sweet && (hasTag("sweet") || hasTag("dessert"))) {
    score += 20;
    reasons.push("sweet profile");
  }

  if (prefs.budget && (hasTag("budget") || hasTag("value") || ((item.price ?? 0) > 0 && (item.price ?? 0) <= 15))) {
    score += 15;
    reasons.push("budget-friendly");
  }

  if (prefs.group && (hasTag("group") || hasTag("sharing") || hasTag("platter"))) {
    score += 15;
    reasons.push("good for groups");
  }

  if (score === 0 && tags.length) {
    score += 5;
    reasons.push("popular match");
  }

  return {
    score,
    reason: reasons.length ? reasons[0] : "recommended for this request"
  };
};

export function recommendCatalogItems(message: string, items: CatalogItem[]): Recommendation[] {
  const prefs = extractPreferences(message);

  return items
    .map((item) => {
      const result = scoreItem(item, prefs);
      return {
        id: item.id,
        name: item.name,
        description: item.description,
        price: item.price,
        reason: result.reason,
        score: result.score
      } satisfies Recommendation;
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 3);
}

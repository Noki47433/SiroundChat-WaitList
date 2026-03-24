import { z } from "zod";
import { runStrictJsonWithRetry } from "@/lib/builder/generation/llm";
import {
  createEmptyGenerationBrief,
  normalizeContentLanguage,
  sanitizeGenerationBrief
} from "@/lib/builder/generation-config";
import {
  PRIMARY_GOALS,
  SECTION_TYPES,
  SITE_TYPES,
  THEME_ACCENTS,
  THEME_FONTS,
  THEME_MODES,
  TONES,
  VERTICALS,
  type GenerationInputMetadata,
  type IntakeBrief,
  type ThemeAccent,
  type ThemeFont,
  type Vertical
} from "@/src/generation/v0_like/types";

export const PROMPT_STAGE_0_INTAKE = [
  "Stage 0 Intake: Convert the raw website prompt into a strict JSON intake brief.",
  "Return JSON only.",
  "Never invent facts not present in prompt or metadata.",
  "Use conservative defaults when unknown.",
  "Fields: siteType, vertical, primaryGoal, brandName, logoUrl, audience, offer, tone, density, theme, mustHaveSections, mustAvoid, allowPricingForRestaurant.",
  `siteType enum: ${SITE_TYPES.join(", ")}`,
  `vertical enum: ${VERTICALS.join(", ")}`,
  `primaryGoal enum: ${PRIMARY_GOALS.join(", ")}`,
  `tone enum: ${TONES.join(", ")}`,
  `theme.mode enum: ${THEME_MODES.join(", ")}`,
  `theme.accent enum: ${THEME_ACCENTS.join(", ")}`,
  `theme.font enum: ${THEME_FONTS.join(", ")}`,
  "density enum: airy, normal, dense",
  `mustHaveSections values: ${SECTION_TYPES.join(", ")}`
].join("\n");

const IntakeLLMSchema = z
  .object({
    siteType: z.enum(SITE_TYPES),
    vertical: z.enum(VERTICALS),
    primaryGoal: z.enum(PRIMARY_GOALS),
    brandName: z.string().min(1).max(48),
    logoUrl: z.string().url().optional(),
    audience: z.string().min(1).max(120),
    offer: z.string().min(1).max(120),
    tone: z.enum(TONES),
    density: z.enum(["airy", "normal", "dense"]),
    theme: z
      .object({
        mode: z.enum(THEME_MODES),
        accent: z.enum(THEME_ACCENTS),
        font: z.enum(THEME_FONTS)
      })
      .strict(),
    allowPricingForRestaurant: z.boolean().default(false),
    mustHaveSections: z.array(z.enum(SECTION_TYPES)).max(12),
    mustAvoid: z.array(z.string().min(1).max(80)).max(12)
  })
  .strict();

const toWords = (value: string) =>
  value
    .toLowerCase()
    .split(/[^a-z0-9_]+/)
    .filter(Boolean);

const firstNonEmpty = (...values: Array<string | null | undefined>) => {
  for (const value of values) {
    if (typeof value === "string" && value.trim()) {
      return value.trim();
    }
  }
  return "";
};

const clamp = (value: string, max: number) => {
  const trimmed = value.trim();
  if (trimmed.length <= max) return trimmed;
  return trimmed.slice(0, max).trim();
};

const siteTypeFromVertical = (vertical: Vertical): IntakeBrief["siteType"] => {
  switch (vertical) {
    case "restaurant":
      return "local_business";
    case "clinic":
      return "local_business";
    case "barbershop":
      return "local_business";
    case "saas":
      return "saas";
    case "portfolio":
      return "portfolio";
    case "ecommerce":
      return "ecommerce";
    case "local_business":
      return "local_business";
    case "event":
      return "event";
    case "blog":
      return "blog";
    default:
      return "other";
  }
};

const inferVertical = (rawPrompt: string, metadata?: GenerationInputMetadata): Vertical => {
  const haystack = `${rawPrompt} ${metadata?.category ?? ""} ${metadata?.industry ?? ""} ${metadata?.subtype ?? ""} ${metadata?.description ?? ""}`.toLowerCase();

  if (/\b(restaurant|cafe|bistro|dining|brunch|pizzeria|steakhouse|menu|reservations?)\b/.test(haystack)) {
    return "restaurant";
  }
  if (/\b(clinic|dental|dentist|orthodont|teeth|tooth|hygienist|patient care|smile)\b/.test(haystack)) {
    return "clinic";
  }
  if (/\b(barber|barbers|barbershop|fade|beard trim|hot towel|line up)\b/.test(haystack)) {
    return "barbershop";
  }
  if (/\b(saas|software|app|b2b|platform|startup|api)\b/.test(haystack)) return "saas";
  if (/\b(portfolio|photography|designer|creative|studio|showcase)\b/.test(haystack)) return "portfolio";
  if (/\b(ecommerce|shop|store|product|checkout|cart)\b/.test(haystack)) return "ecommerce";
  if (/\b(event|conference|summit|meetup|festival|webinar)\b/.test(haystack)) return "event";
  if (/\b(blog|article|news|editorial|journal)\b/.test(haystack)) return "blog";
  if (/\b(local|clinic|salon|dental|plumbing|hvac|law|agency|service)\b/.test(haystack)) return "local_business";
  return "other";
};

const inferPrimaryGoal = (rawPrompt: string, vertical: Vertical): IntakeBrief["primaryGoal"] => {
  const lowered = rawPrompt.toLowerCase();
  if (vertical === "restaurant") {
    if (/\b(order online|delivery|pickup|takeout)\b/.test(lowered)) return "buy_now";
    return "reservations";
  }
  if (vertical === "clinic") {
    if (/\b(call|phone|book|appointment|visit)\b/.test(lowered)) return "book_call";
    return "book_call";
  }
  if (vertical === "barbershop") {
    return "book_call";
  }

  if (/\b(sign ?up|join|register|create account)\b/.test(lowered)) return "sign_up";
  if (/\b(demo|book demo|request demo)\b/.test(lowered)) return "request_demo";
  if (/\b(book call|schedule call|consultation)\b/.test(lowered)) return "book_call";
  if (/\b(buy|purchase|checkout|order now)\b/.test(lowered)) return "buy_now";
  if (/\b(email|newsletter|waitlist|subscribe)\b/.test(lowered)) return "email_capture";
  if (/\b(visit|location|directions|map|hours)\b/.test(lowered)) return "visit_location";
  if (/\b(download|guide|ebook|pdf|whitepaper)\b/.test(lowered)) return "download";
  if (vertical === "saas") return "request_demo";
  if (vertical === "ecommerce") return "buy_now";
  if (vertical === "portfolio") return "book_call";
  if (vertical === "event") return "sign_up";
  if (vertical === "blog") return "email_capture";
  if (vertical === "local_business") return "book_call";
  return "book_call";
};

const inferTone = (rawPrompt: string, metadata?: GenerationInputMetadata): IntakeBrief["tone"] => {
  const lowered = `${rawPrompt} ${metadata?.tone ?? ""}`.toLowerCase();
  if (/\b(playful|fun|friendly|casual)\b/.test(lowered)) return "playful";
  if (/\b(premium|luxury|elegant|upscale)\b/.test(lowered)) return "premium";
  if (/\b(minimal|minimalist|clean|simple)\b/.test(lowered)) return "minimal";
  if (/\b(bold|strong|high contrast)\b/.test(lowered)) return "bold";
  if (/\b(technical|developer|engineering|api)\b/.test(lowered)) return "technical";
  return "neutral";
};

const inferDensity = (rawPrompt: string): IntakeBrief["density"] => {
  const lowered = rawPrompt.toLowerCase();
  if (/\b(airy|spacious|breathing room|minimal whitespace)\b/.test(lowered)) return "airy";
  if (/\b(dense|compact|content heavy|lots of info)\b/.test(lowered)) return "dense";
  return "normal";
};

const inferMustHaveSections = (rawPrompt: string, vertical: Vertical): IntakeBrief["mustHaveSections"] => {
  const lowered = rawPrompt.toLowerCase();

  if (vertical === "restaurant") {
    return ["header", "hero", "features", "feature_spotlight", "contact", "testimonials", "cta_banner", "footer"];
  }
  if (vertical === "clinic") {
    return ["header", "hero", "features", "feature_spotlight", "testimonials", "contact", "cta_banner", "footer"];
  }
  if (vertical === "barbershop") {
    return ["header", "hero", "features", "feature_spotlight", "testimonials", "faq", "contact", "cta_banner", "footer"];
  }

  const sections: IntakeBrief["mustHaveSections"] = [];
  const maybeAdd = (condition: boolean, value: IntakeBrief["mustHaveSections"][number]) => {
    if (condition && !sections.includes(value)) sections.push(value);
  };

  maybeAdd(/\b(header|navigation|nav)\b/.test(lowered), "header");
  maybeAdd(/\b(hero|headline above fold|above the fold)\b/.test(lowered), "hero");
  maybeAdd(/\b(logos|trusted by|partners)\b/.test(lowered), "logos");
  maybeAdd(/\b(features|benefits|capabilities)\b/.test(lowered), "features");
  maybeAdd(/\b(spotlight|how it works|use cases)\b/.test(lowered), "feature_spotlight");
  maybeAdd(/\b(metrics|stats|numbers|kpi)\b/.test(lowered), "metrics");
  maybeAdd(/\b(testimonials|reviews|social proof)\b/.test(lowered), "testimonials");
  maybeAdd(/\b(pricing|plans|tiers)\b/.test(lowered), "pricing");
  maybeAdd(/\b(faq|questions)\b/.test(lowered), "faq");
  maybeAdd(/\b(final cta|cta banner|call to action)\b/.test(lowered), "cta_banner");
  maybeAdd(/\b(contact|form|get in touch|book)\b/.test(lowered), "contact");
  maybeAdd(/\b(footer)\b/.test(lowered), "footer");

  return sections;
};

const inferMustAvoid = (rawPrompt: string, vertical: Vertical): string[] => {
  const lowered = rawPrompt.toLowerCase();
  const avoid: string[] = [];
  if (lowered.includes("no carousel") || lowered.includes("avoid carousel")) avoid.push("no carousel");
  if (lowered.includes("no video") || lowered.includes("avoid video")) avoid.push("no video");
  if (lowered.includes("no pricing")) avoid.push("pricing");
  if (lowered.includes("no faq")) avoid.push("faq");
  if (lowered.includes("no testimonials")) avoid.push("testimonials");
  if (vertical === "restaurant") {
    avoid.push("saas copy");
  }
  if (vertical === "clinic") {
    avoid.push("pricing");
    avoid.push("saas copy");
  }
  if (vertical === "barbershop") {
    avoid.push("saas copy");
  }
  return avoid;
};

const primaryGoalFromBrief = (brief: ReturnType<typeof sanitizeGenerationBrief>): IntakeBrief["primaryGoal"] => {
  switch (brief.primaryCtaGoal) {
    case "buy_now":
      return "buy_now";
    case "request_demo":
      return "request_demo";
    case "reserve_table":
      return "reservations";
    case "visit_us":
      return "visit_location";
    case "book_appointment":
    case "book_call":
      return "book_call";
    case "contact":
    case "get_quote":
    default:
      return "other";
  }
};

const inferBusinessNiche = (vertical: Vertical, metadata?: GenerationInputMetadata) => {
  if (vertical === "barbershop") return "barbershop";
  return firstNonEmpty(metadata?.subtype, metadata?.industry, vertical);
};

const parseHex = (value: string) => {
  const cleaned = value.trim().replace(/^#/, "").toLowerCase();
  if (!/^[0-9a-f]{6}$/.test(cleaned)) return null;

  return {
    r: Number.parseInt(cleaned.slice(0, 2), 16),
    g: Number.parseInt(cleaned.slice(2, 4), 16),
    b: Number.parseInt(cleaned.slice(4, 6), 16)
  };
};

const ACCENT_HEX: Record<ThemeAccent, string> = {
  slate: "#334155",
  blue: "#2563eb",
  indigo: "#4f46e5",
  violet: "#7c3aed",
  cyan: "#0891b2",
  teal: "#0d9488",
  green: "#16a34a",
  orange: "#ea580c",
  red: "#dc2626",
  yellow: "#eab308"
};

const nearestAccentFromHex = (hex: string): ThemeAccent => {
  const rgb = parseHex(hex);
  if (!rgb) return "slate";

  let best: ThemeAccent = "slate";
  let bestDistance = Number.POSITIVE_INFINITY;
  (Object.keys(ACCENT_HEX) as ThemeAccent[]).forEach((accent) => {
    const swatch = parseHex(ACCENT_HEX[accent]);
    if (!swatch) return;
    const distance =
      (rgb.r - swatch.r) * (rgb.r - swatch.r) +
      (rgb.g - swatch.g) * (rgb.g - swatch.g) +
      (rgb.b - swatch.b) * (rgb.b - swatch.b);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = accent;
    }
  });

  return best;
};

const inferAccentFromOnboarding = (metadata?: GenerationInputMetadata): ThemeAccent | null => {
  const source = firstNonEmpty(metadata?.primaryColor, metadata?.secondaryColor);
  if (!source) return null;

  const lowered = source.toLowerCase();
  if (lowered.includes("yellow") || lowered.includes("amber")) return "yellow";
  if (lowered.includes("red")) return "red";
  if (lowered.includes("orange")) return "orange";
  if (lowered.includes("green")) return "green";
  if (lowered.includes("teal")) return "teal";
  if (lowered.includes("cyan")) return "cyan";
  if (lowered.includes("blue")) return "blue";
  if (lowered.includes("indigo")) return "indigo";
  if (lowered.includes("violet") || lowered.includes("purple")) return "violet";
  if (lowered.includes("slate") || lowered.includes("gray") || lowered.includes("grey")) return "slate";

  if (source.startsWith("#")) {
    return nearestAccentFromHex(source);
  }

  return null;
};

const inferThemeModeFromOnboarding = (metadata?: GenerationInputMetadata): IntakeBrief["theme"]["mode"] => {
  const mode = metadata?.themeMode;
  if (mode && THEME_MODES.includes(mode)) return mode;

  const tone = `${metadata?.tone ?? ""}`.toLowerCase();
  if (tone.includes("dark")) return "dark";
  return "light";
};

const parseOnboardingFont = (metadata?: GenerationInputMetadata): ThemeFont | null => {
  const fontFamily = (metadata?.fontFamily ?? "").trim().toLowerCase();
  if (!fontFamily) return null;

  if (/\b(mono|code|plex mono|menlo|consolas)\b/.test(fontFamily)) return "mono";
  if (/\b(serif|merriweather|playfair|lora|garamond)\b/.test(fontFamily)) return "serif";
  return "sans";
};

const deriveThemeFont = (vertical: Vertical, metadata?: GenerationInputMetadata): ThemeFont => {
  const onboardingFont = parseOnboardingFont(metadata);
  if (vertical === "restaurant") {
    if (onboardingFont === "sans") return "sans";
    return "serif";
  }
  if (vertical === "clinic") {
    return onboardingFont === "serif" ? "serif" : "sans";
  }
  if (vertical === "saas") {
    return "sans";
  }
  if (vertical === "portfolio") {
    return onboardingFont ?? "serif";
  }
  if (vertical === "event" || vertical === "blog") {
    return onboardingFont ?? "serif";
  }
  if (vertical === "ecommerce" || vertical === "local_business") {
    return onboardingFont ?? "sans";
  }
  return onboardingFont ?? "sans";
};

const inferAllowPricingForRestaurant = (rawPrompt: string, metadata?: GenerationInputMetadata) => {
  if (metadata?.includePricing === true) return true;
  const lowered = `${rawPrompt} ${metadata?.description ?? ""} ${metadata?.industry ?? ""} ${metadata?.subtype ?? ""}`.toLowerCase();
  return /\b(online store|plans|subscription|subscriptions|membership|memberships)\b/.test(lowered);
};

const buildDeterministicIntake = (rawPrompt: string, metadata?: GenerationInputMetadata): IntakeBrief => {
  const vertical = inferVertical(rawPrompt, metadata);
  const siteType = siteTypeFromVertical(vertical);
  const tone = inferTone(rawPrompt, metadata);
  const language = normalizeContentLanguage(metadata?.language);
  const brief = sanitizeGenerationBrief(metadata?.brief, metadata?.tone ?? tone);
  const businessNiche = inferBusinessNiche(vertical, metadata);
  const accentFromOnboarding = inferAccentFromOnboarding(metadata);
  const fontFromPairing = deriveThemeFont(vertical, metadata);

  const hasExplicitAccent = Boolean(firstNonEmpty(metadata?.primaryColor, metadata?.secondaryColor));
  const hasExplicitFont = Boolean((metadata?.fontFamily ?? "").trim());

  const fallbackGoal = inferPrimaryGoal(rawPrompt, vertical);
  const briefGoal = primaryGoalFromBrief(brief);
  const primaryGoal =
    briefGoal !== "other"
      ? briefGoal
      : vertical === "restaurant" && fallbackGoal === "other"
        ? "reservations"
        : fallbackGoal;

  const brand = firstNonEmpty(metadata?.businessName, "Business");
  const offer =
    vertical === "restaurant"
      ? firstNonEmpty(brief.coreOffer, metadata?.services?.[0], "Seasonal menu and dining experiences")
      : vertical === "barbershop"
        ? firstNonEmpty(
            brief.coreOffer,
            metadata?.services?.[0],
            "Modern cuts, beard trims, and appointment-ready grooming"
          )
        : firstNonEmpty(brief.coreOffer, metadata?.services?.[0], metadata?.industry, metadata?.description, "Services");
  const audience =
    vertical === "restaurant"
      ? firstNonEmpty(brief.audience, metadata?.targetCustomer, "Local diners")
      : vertical === "barbershop"
        ? firstNonEmpty(brief.audience, metadata?.targetCustomer, "Local clients who book recurring cuts")
        : firstNonEmpty(brief.audience, metadata?.targetCustomer, "Prospective customers");

  return {
    siteType,
    vertical,
    businessNiche,
    language,
    brief,
    primaryGoal,
    brandName: clamp(brand, 48),
    logoUrl: metadata?.logoUrl ?? null,
    audience: clamp(audience, 120),
    offer: clamp(offer, 120),
    tone,
    density: inferDensity(rawPrompt),
    theme: {
      mode: inferThemeModeFromOnboarding(metadata),
      tone,
      accent:
        accentFromOnboarding ??
        (vertical === "restaurant" ? "yellow" : vertical === "barbershop" ? "orange" : "blue"),
      font: fontFromPairing
    },
    locks: {
      accent: hasExplicitAccent,
      font:
        hasExplicitFont ||
        vertical === "restaurant" ||
        vertical === "clinic" ||
        vertical === "barbershop" ||
        vertical === "saas",
      goal: vertical === "restaurant" || vertical === "clinic" || vertical === "barbershop" || primaryGoal !== "other",
      vertical: true
    },
    allowPricingForRestaurant: inferAllowPricingForRestaurant(rawPrompt, metadata),
    mustHaveSections: inferMustHaveSections(rawPrompt, vertical),
    mustAvoid: inferMustAvoid(rawPrompt, vertical)
  };
};

const normalizeIntake = (intake: z.infer<typeof IntakeLLMSchema>): IntakeBrief => {
  const uniqueMustHave = Array.from(new Set(intake.mustHaveSections)).filter((section) => SECTION_TYPES.includes(section));
  const uniqueAvoid = Array.from(new Set(intake.mustAvoid.map((item) => item.trim()).filter(Boolean)));

  return {
    siteType: intake.siteType,
    vertical: intake.vertical,
    businessNiche: intake.vertical,
    language: "en",
    brief: createEmptyGenerationBrief(intake.tone),
    primaryGoal: intake.primaryGoal,
    brandName: clamp(intake.brandName, 48) || "Business",
    logoUrl: intake.logoUrl ?? null,
    audience: clamp(intake.audience, 120) || "Prospective customers",
    offer: clamp(intake.offer, 120) || "Services",
    tone: intake.tone,
    density: intake.density,
    theme: {
      mode: intake.theme.mode,
      tone: intake.tone,
      accent: intake.theme.accent,
      font: intake.theme.font
    },
    locks: {
      accent: false,
      font: false,
      goal: false,
      vertical: false
    },
    allowPricingForRestaurant: intake.allowPricingForRestaurant,
    mustHaveSections: uniqueMustHave,
    mustAvoid: uniqueAvoid
  };
};

const enforceIntakeLocks = (candidate: IntakeBrief, deterministic: IntakeBrief): IntakeBrief => {
  const vertical = deterministic.locks.vertical ? deterministic.vertical : candidate.vertical;
  const siteType = siteTypeFromVertical(vertical);

  const goalFromCandidate = candidate.primaryGoal;
  let primaryGoal = deterministic.locks.goal ? deterministic.primaryGoal : goalFromCandidate;
  if (vertical === "restaurant" && (primaryGoal === "other" || !primaryGoal)) {
    primaryGoal = "reservations";
  }
  if (vertical === "clinic" && (primaryGoal === "other" || !primaryGoal)) {
    primaryGoal = "book_call";
  }

  let font = deterministic.locks.font ? deterministic.theme.font : candidate.theme.font;
  if (vertical === "restaurant" && font === "mono") {
    font = "serif";
  }
  if (vertical === "clinic" && font === "mono") {
    font = "sans";
  }

  return {
    ...candidate,
    siteType,
    vertical,
    businessNiche: deterministic.businessNiche,
    language: deterministic.language,
    brief: deterministic.brief,
    primaryGoal,
    logoUrl: deterministic.logoUrl ?? candidate.logoUrl ?? null,
    tone: deterministic.tone,
    density: deterministic.density,
    theme: {
      mode: candidate.theme.mode,
      tone: deterministic.tone,
      accent: deterministic.locks.accent ? deterministic.theme.accent : candidate.theme.accent,
      font
    },
    locks: deterministic.locks,
    allowPricingForRestaurant:
      deterministic.allowPricingForRestaurant || candidate.allowPricingForRestaurant,
    mustHaveSections: Array.from(new Set([...candidate.mustHaveSections, ...deterministic.mustHaveSections])),
    mustAvoid: Array.from(new Set([...candidate.mustAvoid, ...deterministic.mustAvoid]))
  };
};

export async function buildIntakeBrief(
  rawPrompt: string,
  metadata?: GenerationInputMetadata,
  openai?: any
): Promise<IntakeBrief> {
  const deterministic = buildDeterministicIntake(rawPrompt, metadata);

  if (!openai) {
    return deterministic;
  }

  const modelInput = [
    PROMPT_STAGE_0_INTAKE,
    `Raw prompt:\n${rawPrompt.trim()}`,
    `Metadata:\n${JSON.stringify(metadata ?? {}, null, 2)}`
  ].join("\n\n");

  const generated = await runStrictJsonWithRetry(openai, {
    schema: IntakeLLMSchema,
    userPrompt: modelInput,
    systemPrompt: "You are a strict intake parser for deterministic website generation.",
    temperature: 0.1,
    label: "v0-like-intake"
  });

  if (!generated) {
    return deterministic;
  }

  const normalized = normalizeIntake(generated);
  const merged = enforceIntakeLocks(
    {
      ...normalized,
      brandName: normalized.brandName || deterministic.brandName,
      audience: normalized.audience || deterministic.audience,
      offer: normalized.offer || deterministic.offer
    },
    deterministic
  );

  return {
    ...deterministic,
    ...merged,
    businessNiche: deterministic.businessNiche,
    language: deterministic.language,
    brief: deterministic.brief,
    brandName: merged.brandName || deterministic.brandName,
    audience: merged.audience || deterministic.audience,
    offer: merged.offer || deterministic.offer
  };
}

export const intakeFromRawPromptOnly = (rawPrompt: string) => {
  const words = toWords(rawPrompt);
  return {
    rawWordCount: words.length,
    isVague: words.length < 8
  };
};

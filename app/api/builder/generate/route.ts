import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getOpenAIClient } from "@/lib/ai/client";
import { SiteDocumentSchema } from "@/lib/website-builder/schema";
import {
  TEMPLATE_ALLOWED_VARIANTS,
  TEMPLATE_DEFAULT_SECTIONS
} from "@/lib/website-builder/templates/registry";
import { searchPexels, type NormalizedImage } from "@/lib/website-builder/images/pexels";
import type { SiteDocument, SiteImage, SiteSection } from "@/lib/website-builder/types";
import { getNicheRules, type NicheRules } from "@/lib/builder/niche";
import {
  computeSectionPolicyFromFeatureFlags,
  type BuilderFeatureFlags
} from "@/lib/builder/features";
import { enforceFeatureGating } from "@/lib/builder/normalize/enforceFeatureGating";
import { applyNicheLint } from "@/lib/builder/normalize/nicheLint";
import { normalizeAnchors } from "@/lib/builder/normalize/normalizeAnchors";
import { resolveTemplatePreset } from "@/lib/builder/templates/presets";
import { selectTemplateKey } from "@/lib/builder/utils";

export const runtime = "nodejs";

const DEFAULT_CHAT_PROMPT_TEXT = "Have questions or want to make a reservation? Use our chatbot →";
const DEFAULT_CHAT_PROMPT_CTA = "Open chat";

const SECTION_FALLBACK_IMAGES: Partial<
  Record<SiteSection["type"], Array<{ slot: string; src: string; alt: string }>>
> = {
  hero: [
    {
      slot: "hero",
      src: "https://images.pexels.com/photos/262978/pexels-photo-262978.jpeg",
      alt: "Hero image"
    }
  ],
  about: [
    {
      slot: "about",
      src: "https://images.pexels.com/photos/3184431/pexels-photo-3184431.jpeg",
      alt: "About image"
    }
  ],
  cta: [
    {
      slot: "cta",
      src: "https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg",
      alt: "CTA image"
    }
  ],
  gallery: [
    {
      slot: "gallery-1",
      src: "https://images.pexels.com/photos/67468/pexels-photo-67468.jpeg",
      alt: "Gallery image"
    },
    {
      slot: "gallery-2",
      src: "https://images.pexels.com/photos/1267320/pexels-photo-1267320.jpeg",
      alt: "Gallery image"
    },
    {
      slot: "gallery-3",
      src: "https://images.pexels.com/photos/958545/pexels-photo-958545.jpeg",
      alt: "Gallery image"
    },
    {
      slot: "gallery-4",
      src: "https://images.pexels.com/photos/3184338/pexels-photo-3184338.jpeg",
      alt: "Gallery image"
    },
    {
      slot: "gallery-5",
      src: "https://images.pexels.com/photos/5710176/pexels-photo-5710176.jpeg",
      alt: "Gallery image"
    },
    {
      slot: "gallery-6",
      src: "https://images.pexels.com/photos/3184398/pexels-photo-3184398.jpeg",
      alt: "Gallery image"
    }
  ]
};

const RESTAURANT_SAFE_LINES = [
  "Wood-fired specials daily.",
  "Fresh ingredients, seasonal menu.",
  "Reservations recommended on weekends."
];

const DEFAULT_RESTAURANT_DISHES = [
  "Wood-fired ribeye",
  "Lemon herb salmon",
  "House-made pasta"
];

const ColorSchema = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/)
  .optional()
  .nullable();

const SocialsSchema = z
  .object({
    instagram: z.string().optional().nullable(),
    facebook: z.string().optional().nullable(),
    tiktok: z.string().optional().nullable(),
    linkedin: z.string().optional().nullable(),
    website: z.string().optional().nullable()
  })
  .optional()
  .nullable();

const PayloadSchema = z.object({
  siteId: z.string().uuid(),
  businessId: z.string().uuid(),
  businessName: z.string().min(1),
  industry: z.string().min(1),
  description: z.string().min(1),
  tone: z.string().min(1),
  pagesMode: z.enum(["one", "multi"]),
  templateId: z.string().min(1),
  primaryColor: ColorSchema,
  secondaryColor: ColorSchema,
  fontFamily: z.string().min(2).optional().nullable(),
  logoUrl: z.string().url().optional().nullable(),
  contact: z
    .object({
      email: z.string().email().optional().nullable(),
      phone: z.string().min(2).optional().nullable(),
      address: z.string().min(2).optional().nullable()
    })
    .optional()
    .nullable(),
  openingHours: z.string().optional().nullable(),
  socials: SocialsSchema,
  features: z
    .object({
      includeServices: z.boolean().optional(),
      includeTestimonials: z.boolean().optional(),
      includePricing: z.boolean().optional(),
      includeFaq: z.boolean().optional(),
      includeContact: z.boolean().optional(),
      includeReservation: z.boolean().optional(),
      includeGallery: z.boolean().optional()
    })
    .optional()
    .nullable(),
  hasOwnPhotos: z.boolean().optional()
});

type FeatureFlags = BuilderFeatureFlags;
type SectionPolicy = ReturnType<typeof computeSectionPolicyFromFeatureFlags>;

const PRICING_INDUSTRY_BLOCKLIST = [
  "restaurant",
  "cafe",
  "bistro",
  "diner",
  "bar",
  "hospitality",
  "hotel",
  "resort",
  "salon",
  "spa"
];

const isPricingAllowedForIndustry = (industry: string) => {
  const normalized = industry.toLowerCase();
  return !PRICING_INDUSTRY_BLOCKLIST.some((term) => normalized.includes(term));
};

const resolveFeatureFlags = (input: z.infer<typeof PayloadSchema>): FeatureFlags => {
  const normalizedIndustry = input.industry.toLowerCase();
  const isRestaurantLike =
    normalizedIndustry.includes("restaurant") ||
    normalizedIndustry.includes("cafe") ||
    normalizedIndustry.includes("bistro");
  const hasFeaturePayload = Boolean(input.features);

  const resolved: FeatureFlags = {
    includeServices: hasFeaturePayload ? Boolean(input.features?.includeServices) : true,
    includeTestimonials: hasFeaturePayload ? Boolean(input.features?.includeTestimonials) : false,
    includePricing: hasFeaturePayload ? Boolean(input.features?.includePricing) : false,
    includeFaq: hasFeaturePayload ? Boolean(input.features?.includeFaq) : false,
    includeContact: hasFeaturePayload ? Boolean(input.features?.includeContact) : true,
    includeReservation: hasFeaturePayload
      ? Boolean(input.features?.includeReservation)
      : isRestaurantLike,
    includeGallery: hasFeaturePayload ? Boolean(input.features?.includeGallery) : false
  };

  if (!isPricingAllowedForIndustry(input.industry)) {
    resolved.includePricing = false;
  }

  return resolved;
};

const isSectionEnabled = (
  type: SiteSection["type"],
  featureFlags: FeatureFlags,
  fallback = true
) => {
  switch (type) {
    case "services":
      return featureFlags.includeServices;
    case "gallery":
      return featureFlags.includeGallery;
    case "testimonials":
      return featureFlags.includeTestimonials;
    case "pricing":
      return featureFlags.includePricing;
    case "faq":
      return featureFlags.includeFaq;
    case "contact":
      return featureFlags.includeContact;
    case "reservation":
      return featureFlags.includeReservation;
    default:
      return fallback;
  }
};

const normalizeHex = (value?: string | null) => {
  const raw = (value ?? "").trim().replace("#", "");
  if (raw.length === 3) {
    return `#${raw
      .split("")
      .map((char) => `${char}${char}`)
      .join("")}`;
  }
  if (raw.length === 6) return `#${raw}`;
  return null;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const seedFraction = (value: number) => {
  const fractional = value - Math.floor(value);
  return fractional < 0 ? fractional + 1 : fractional;
};

const seedFromString = (value: string) => {
  let hash = 0;
  for (let i = 0; i < value.length; i += 1) {
    hash = (hash * 31 + value.charCodeAt(i)) >>> 0;
  }
  return (hash % 4294967295) / 4294967295;
};

const seededPick = <T,>(items: T[], seed: number) => {
  if (!items.length) return items[0];
  const idx = Math.floor(seedFraction(seed) * items.length) % items.length;
  return items[idx] ?? items[0];
};

const resolveTemplateId = (templateId: string, industry: string) => {
  const trimmed = templateId.trim();
  if (TEMPLATE_DEFAULT_SECTIONS[trimmed]) return trimmed;
  const normalized = industry.toLowerCase();
  if (normalized.includes("restaurant")) return "restaurant-editorial";
  if (normalized.includes("clinic") || normalized.includes("medical")) return "clinic-clean";
  if (normalized.includes("beauty") || normalized.includes("salon") || normalized.includes("spa")) {
    return "beauty-lux";
  }
  if (normalized.includes("portfolio") || normalized.includes("creative")) {
    return "portfolio-minimal";
  }
  if (normalized.includes("ecommerce") || normalized.includes("shop") || normalized.includes("store")) {
    return "ecommerce-simple";
  }
  if (normalized.includes("hospitality") || normalized.includes("hotel") || normalized.includes("resort")) {
    return "hospitality-resort";
  }
  if (normalized.includes("consulting") || normalized.includes("corporate") || normalized.includes("agency")) {
    return "corporate-sleek";
  }
  if (normalized.includes("service")) return "auto-modern";
  return "auto-modern";
};

const TEMPLATE_VARIANT_BIAS: Record<string, Partial<Record<SiteSection["type"], string>>> = {
  "restaurant-editorial": {
    hero: "B",
    services: "B",
    about: "A",
    testimonials: "B",
    gallery: "A",
    cta: "B"
  },
  "beauty-lux": {
    hero: "A",
    services: "B",
    gallery: "B",
    testimonials: "B",
    cta: "B"
  },
  "clinic-clean": {
    hero: "C",
    services: "C",
    testimonials: "A",
    faq: "B"
  },
  "corporate-sleek": {
    hero: "C",
    services: "C",
    testimonials: "B",
    cta: "A"
  },
  "portfolio-minimal": {
    hero: "B",
    gallery: "B",
    about: "B"
  },
  "ecommerce-simple": {
    hero: "B",
    gallery: "B"
  },
  "hospitality-resort": {
    hero: "B",
    about: "B",
    gallery: "B",
    testimonials: "B"
  }
};

const TEMPLATE_PROMPT_HINTS: Record<string, string> = {
  "restaurant-editorial":
    "Editorial, image-forward layout. Prefer hero variant B with full-bleed imagery and rich gallery/testimonial sections.",
  "beauty-lux":
    "Luxurious, soft visuals. Use elegant spacing, gallery/testimonials variant B, and refined copy.",
  "clinic-clean":
    "Clean, trusted feel. Use clear structure and variant C hero/services when possible.",
  "corporate-sleek":
    "Sharp, professional layout with structured sections and concise copy.",
  "portfolio-minimal":
    "Minimal, gallery-forward with strong visual hierarchy and lots of white space.",
  "ecommerce-simple":
    "Product-first layout with clear CTAs and practical feature lists.",
  "hospitality-resort":
    "Immersive, experience-driven layout with bold hero and gallery emphasis."
};

const FONT_OPTIONS = [
  "Sora, Inter, system-ui, sans-serif",
  "Manrope, Inter, system-ui, sans-serif",
  "\"Space Grotesk\", Inter, system-ui, sans-serif",
  "\"Playfair Display\", Inter, system-ui, sans-serif"
];

type BannedPhraseHit = {
  sectionId: string;
  sectionType: SiteSection["type"];
  phrase: string;
  value: string;
};

const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const inferRestaurantDishSet = (input: z.infer<typeof PayloadSchema>) => {
  const source = `${input.industry} ${input.description}`.toLowerCase();
  if (source.includes("seafood")) {
    return ["Seared salmon", "Garlic shrimp pasta", "Grilled branzino"];
  }
  if (source.includes("italian") || source.includes("pasta") || source.includes("pizza")) {
    return ["Truffle mushroom pasta", "Margherita pizza", "Classic tiramisu"];
  }
  if (source.includes("mexican") || source.includes("taco")) {
    return ["Carne asada tacos", "Chicken enchiladas", "Citrus shrimp ceviche"];
  }
  if (source.includes("japanese") || source.includes("sushi") || source.includes("ramen")) {
    return ["Spicy tuna roll", "Shoyu ramen", "Salmon nigiri"];
  }
  return DEFAULT_RESTAURANT_DISHES;
};

const buildNicheRulesPromptBlock = (rules: NicheRules, input: z.infer<typeof PayloadSchema>) => {
  const lines = [
    "Niche Rules (MUST FOLLOW):",
    `nicheKey: ${rules.key}`,
    `bannedPhrases: ${JSON.stringify(rules.bannedPhrases)}`,
    `forbiddenTopics: ${JSON.stringify(rules.forbiddenTopics)}`,
    `requiredTopics: ${JSON.stringify(rules.requiredTerms)}`,
    `preferredPrimaryCta: ${rules.preferredPrimaryCta}`,
    `defaultBulletPool: ${JSON.stringify(rules.defaultBulletPool.slice(0, 3))}`,
    "DO NOT use any banned phrases. If you cannot comply, rewrite.",
    "Do not mention forbidden topics. Rewrite if you do.",
    "If section copy sounds generic, rewrite it to be concrete and niche-specific."
  ];

  if (rules.key === "restaurant") {
    lines.push(
      `restaurantDishExamples: ${JSON.stringify(inferRestaurantDishSet(input))}`,
      "Restaurant copy must mention dish names, atmosphere, and booking details.",
      "Restaurant bullets must be restaurant-specific: dishes, atmosphere, booking; not service-provider claims."
    );
  }

  return lines.join("\n");
};

const getSectionContentStrings = (value: unknown, output: string[] = []): string[] => {
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (trimmed) output.push(trimmed);
    return output;
  }

  if (Array.isArray(value)) {
    value.forEach((item) => getSectionContentStrings(item, output));
    return output;
  }

  if (value && typeof value === "object") {
    Object.values(value as Record<string, unknown>).forEach((item) => getSectionContentStrings(item, output));
  }

  return output;
};

const findBannedPhraseHits = (document: SiteDocument, rules: NicheRules): BannedPhraseHit[] => {
  if (!rules.bannedPhrases.length) return [];
  const hits: BannedPhraseHit[] = [];

  document.pages.forEach((page) => {
    page.sections.forEach((section) => {
      const strings = getSectionContentStrings(section.content);
      strings.forEach((value) => {
        const lower = value.toLowerCase();
        rules.bannedPhrases.forEach((phrase) => {
          if (lower.includes(phrase.toLowerCase())) {
            hits.push({
              sectionId: section.id,
              sectionType: section.type,
              phrase,
              value
            });
          }
        });
      });
    });
  });

  return hits;
};

const replaceBannedPhrasesInString = (value: string, rules: NicheRules, lineSeed: number) => {
  let next = value;
  rules.bannedPhrases.forEach((phrase) => {
    const pattern = new RegExp(escapeRegExp(phrase), "ig");
    if (!pattern.test(next)) return;
    const replacement =
      rules.key === "restaurant"
        ? RESTAURANT_SAFE_LINES[lineSeed % RESTAURANT_SAFE_LINES.length]
        : "locally focused, practical service";
    next = next.replace(pattern, replacement);
  });
  return next;
};

const sanitizeBannedCopyDeterministically = (document: SiteDocument, rules: NicheRules): SiteDocument => {
  let stringIndex = 0;
  const pages = document.pages.map((page) => ({
    ...page,
    sections: page.sections.map((section) => {
      const sanitizeNode = (value: unknown): unknown => {
        if (typeof value === "string") {
          const replaced = replaceBannedPhrasesInString(value, rules, stringIndex);
          stringIndex += 1;
          return replaced;
        }
        if (Array.isArray(value)) {
          return value.map((item) => sanitizeNode(item));
        }
        if (value && typeof value === "object") {
          return Object.fromEntries(
            Object.entries(value as Record<string, unknown>).map(([key, entry]) => [key, sanitizeNode(entry)])
          );
        }
        return value;
      };

      return {
        ...section,
        content: sanitizeNode(section.content) as Record<string, any>
      };
    })
  }));

  return {
    ...document,
    pages
  };
};

const enforceRestaurantCopyRequirements = (
  document: SiteDocument,
  input: z.infer<typeof PayloadSchema>
): SiteDocument => {
  const dishSet = inferRestaurantDishSet(input);
  const lowerContent = getSectionContentStrings(document.pages.flatMap((page) => page.sections.map((s) => s.content)))
    .join(" ")
    .toLowerCase();

  const cuisineKeywords = [
    "cuisine",
    "grill",
    "seafood",
    "pasta",
    "taco",
    "ramen",
    "pizza",
    "chef"
  ];
  const hasCuisineMention = cuisineKeywords.some((keyword) => lowerContent.includes(keyword));
  const dishMentions = dishSet.filter((dish) => lowerContent.includes(dish.toLowerCase())).length;

  if (hasCuisineMention && dishMentions >= 3) {
    return document;
  }

  const pages = document.pages.map((page) => ({
    ...page,
    sections: page.sections.map((section) => {
      if (section.type === "hero") {
        const content = { ...(section.content as Record<string, any>) };
        content.ctaLabel = "Make a Reservation";
        content.ctaHref = "#reservation";
        if (!hasCuisineMention) {
          content.subheadline = `${input.businessName} serves seasonal cuisine in a warm, welcoming dining room.`;
        }
        content.features = [
          `${dishSet[0]} prepared fresh nightly.`,
          `${dishSet[1]} paired with house favorites.`,
          `${dishSet[2]} and seasonal chef specials.`
        ];
        return { ...section, content };
      }

      if (section.type === "services") {
        const content = { ...(section.content as Record<string, any>) };
        content.title = "Menu Highlights";
        content.items = [
          { title: dishSet[0], body: "A guest favorite prepared with seasonal ingredients." },
          { title: dishSet[1], body: "Balanced flavors, cooked to order every service." },
          { title: dishSet[2], body: "House-made components and thoughtful presentation." }
        ];
        return { ...section, content };
      }

      if (section.type === "about") {
        const content = { ...(section.content as Record<string, any>) };
        if (!hasCuisineMention) {
          content.body = `${input.businessName} is known for a cozy atmosphere, attentive hospitality, and a cuisine-forward menu built around seasonal dishes.`;
        }
        return { ...section, content };
      }

      return section;
    })
  }));

  return { ...document, pages };
};

const enforceNicheCopyRequirements = (
  document: SiteDocument,
  input: z.infer<typeof PayloadSchema>,
  rules: NicheRules
) => {
  if (rules.key === "restaurant") {
    return enforceRestaurantCopyRequirements(document, input);
  }
  return document;
};

const DesignDnaSchema = z.object({
  variationSeed: z.string().optional(),
  layoutStyle: z.string().min(1),
  palette: z.object({
    primary: z.string().min(1),
    secondary: z.string().min(1),
    background: z.string().min(1),
    accent: z.string().optional()
  }),
  fontPair: z.object({
    heading: z.string().min(1),
    body: z.string().min(1)
  }),
  variantBias: z.record(z.string(), z.string()).optional(),
  sectionOrder: z.array(z.string()).optional(),
  imageryStyle: z.string().optional()
});

type DesignDna = z.infer<typeof DesignDnaSchema>;

const LayoutPlanSchema = z.object({
  templateId: z.string().optional(),
  variantBias: z.record(z.string(), z.string()).optional(),
  sectionOrder: z.array(z.string()).min(1),
  variants: z.record(z.string(), z.string()).optional(),
  spacing: z.record(z.string(), z.enum(["compact", "normal", "airy"])).optional(),
  alignment: z.record(z.string(), z.enum(["left", "center"])).optional(),
  typographyScale: z.enum(["editorial", "bold", "classic", "compact"]).optional(),
  emphasis: z.array(z.string()).optional()
});

type LayoutPlan = z.infer<typeof LayoutPlanSchema>;

const resolveVariant = (
  templateId: string,
  type: SiteSection["type"],
  fallback: string,
  seed: number,
  override?: string
) => {
  const allowed = TEMPLATE_ALLOWED_VARIANTS[templateId]?.[type] ?? [fallback];
  if (override && allowed.includes(override)) {
    return override;
  }
  const bias = TEMPLATE_VARIANT_BIAS[templateId]?.[type];
  const biasChance = type === "hero" ? 0.85 : 0.7;
  if (bias && allowed.includes(bias) && seedFraction(seed) < biasChance) return bias;
  const nonA = allowed.filter((variant) => variant !== "A");
  if (nonA.length && seedFraction(seed + 0.13) > 0.35) {
    return seededPick(nonA, seed + 0.91);
  }
  return seededPick(allowed, seed);
};

const buildSectionStyle = (
  type: SiteSection["type"],
  seed: number,
  options?: {
    layoutStyle?: string | null;
    spacingOverride?: SiteSection["style"]["spacing"];
    alignmentOverride?: SiteSection["style"]["alignment"];
    layoutMode?: SiteSection["style"]["layoutMode"];
  }
): SiteSection["style"] => {
  const layoutStyle = (options?.layoutStyle ?? "").toLowerCase();
  const prefersAiry =
    layoutStyle.includes("editorial") ||
    layoutStyle.includes("lux") ||
    layoutStyle.includes("immersive") ||
    layoutStyle.includes("resort");
  const prefersCompact =
    layoutStyle.includes("compact") || layoutStyle.includes("minimal") || layoutStyle.includes("tight");

  const alignment =
    options?.alignmentOverride ??
    (["hero", "cta", "testimonials", "gallery", "faq", "reservation"].includes(type)
      ? seedFraction(seed) > 0.45
        ? "center"
        : "left"
      : "left");

  const spacingSeed = seedFraction(seed + 0.31);
  let spacing: SiteSection["style"]["spacing"] =
    type === "hero"
      ? "airy"
      : spacingSeed > 0.66
        ? "airy"
        : spacingSeed > 0.33
          ? "normal"
          : "compact";

  if (prefersAiry) {
    spacing = spacingSeed > 0.2 ? "airy" : "normal";
  }
  if (prefersCompact) {
    spacing = spacingSeed > 0.65 ? "normal" : "compact";
  }
  if (options?.spacingOverride) {
    spacing = options.spacingOverride;
  }

  const buttonStyle = seedFraction(seed + 0.61) > 0.5 ? "solid" : "outline";

  return {
    alignment,
    spacing,
    layoutMode: options?.layoutMode ?? "flow",
    background: { type: "plain" },
    buttonStyle,
    colorOverride: null
  };
};

const resolveToneProfile = (tone: string) => {
  const normalized = tone.toLowerCase();
  if (normalized.includes("friendly")) {
    return {
      vibe: "warm, welcoming",
      kicker: ["Welcome", "Hello there", "Gather with us"],
      cta: ["Book a table", "Get started", "Contact us"],
      adjectives: ["welcoming", "family-run", "approachable"],
      verbs: ["gather", "enjoy", "share"]
    };
  }
  if (normalized.includes("premium")) {
    return {
      vibe: "refined, elevated",
      kicker: ["Signature", "Elevated dining", "Handcrafted"],
      cta: ["Reserve your seat", "Book a private table", "Request a tasting"],
      adjectives: ["elevated", "curated", "bespoke"],
      verbs: ["savor", "discover", "experience"]
    };
  }
  if (normalized.includes("corporate")) {
    return {
      vibe: "professional, reliable",
      kicker: ["Trusted", "Results-first", "Operational excellence"],
      cta: ["Schedule a consult", "Start a project", "Talk to our team"],
      adjectives: ["reliable", "consistent", "strategic"],
      verbs: ["deliver", "optimize", "support"]
    };
  }
  if (normalized.includes("bold")) {
    return {
      vibe: "energetic, modern",
      kicker: ["Bold flavor", "Big energy", "Fresh take"],
      cta: ["Book now", "Join the list", "See the menu"],
      adjectives: ["vibrant", "fresh", "dynamic"],
      verbs: ["ignite", "explore", "celebrate"]
    };
  }
  return {
    vibe: "clean, minimal",
    kicker: ["Simple", "Thoughtful", "Essential"],
    cta: ["Learn more", "Get started", "Contact us"],
    adjectives: ["thoughtful", "clean", "focused"],
    verbs: ["simplify", "refine", "craft"]
  };
};

const hexToRgb = (value: string) => {
  const normalized = normalizeHex(value);
  if (!normalized) return null;
  const hex = normalized.replace("#", "");
  return {
    r: parseInt(hex.slice(0, 2), 16),
    g: parseInt(hex.slice(2, 4), 16),
    b: parseInt(hex.slice(4, 6), 16)
  };
};

const rgbToHex = (r: number, g: number, b: number) =>
  `#${[r, g, b]
    .map((channel) =>
      clamp(Math.round(channel), 0, 255).toString(16).padStart(2, "0")
    )
    .join("")}`;

const mixColors = (base: string, overlay: string, amount: number) => {
  const baseRgb = hexToRgb(base);
  const overlayRgb = hexToRgb(overlay);
  if (!baseRgb || !overlayRgb) return base;
  const weight = clamp(amount, 0, 1);
  return rgbToHex(
    baseRgb.r + (overlayRgb.r - baseRgb.r) * weight,
    baseRgb.g + (overlayRgb.g - baseRgb.g) * weight,
    baseRgb.b + (overlayRgb.b - baseRgb.b) * weight
  );
};

const getContrastText = (background: string) => {
  const rgb = hexToRgb(background);
  if (!rgb) return "#111827";
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((channel) => {
    const value = channel / 255;
    return value <= 0.03928
      ? value / 12.92
      : Math.pow((value + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.55 ? "#111827" : "#FFFFFF";
};

const isNearWhite = (value: string) => {
  const rgb = hexToRgb(value);
  if (!rgb) return false;
  const [r, g, b] = [rgb.r, rgb.g, rgb.b].map((channel) => channel / 255);
  return r > 0.92 && g > 0.92 && b > 0.92;
};

const resolveFonts = (
  fontFamily?: string | null,
  designFonts?: { heading?: string; body?: string }
) => {
  const pairs = [
    {
      value: "Sora, Inter, system-ui, sans-serif",
      heading: "Sora, Inter, system-ui, sans-serif",
      body: "Inter, system-ui, sans-serif"
    },
    {
      value: "Manrope, Inter, system-ui, sans-serif",
      heading: "Manrope, Inter, system-ui, sans-serif",
      body: "Inter, system-ui, sans-serif"
    },
    {
      value: '"Space Grotesk", Inter, system-ui, sans-serif',
      heading: '"Space Grotesk", Inter, system-ui, sans-serif',
      body: "Inter, system-ui, sans-serif"
    },
    {
      value: '"Playfair Display", Inter, system-ui, sans-serif',
      heading: '"Playfair Display", Inter, system-ui, sans-serif',
      body: "Inter, system-ui, sans-serif"
    }
  ];

  const match = pairs.find((pair) => pair.value === fontFamily);
  if (match) return match;

  if (!fontFamily && (designFonts?.heading || designFonts?.body)) {
    const heading = designFonts.heading ?? designFonts.body ?? "Inter, system-ui, sans-serif";
    const body = designFonts.body ?? designFonts.heading ?? "Inter, system-ui, sans-serif";
    return {
      value: body,
      heading,
      body
    };
  }

  return {
    value: fontFamily ?? "Inter, system-ui, sans-serif",
    heading: fontFamily ?? "Inter, system-ui, sans-serif",
    body: fontFamily ?? "Inter, system-ui, sans-serif"
  };
};

const buildTextStyles = (seed: number, profile?: string | null) => {
  const profileKey = (profile ?? "").toLowerCase();
  const baseScale =
    profileKey.includes("editorial") || profileKey.includes("lux")
      ? 1.32
      : profileKey.includes("bold")
        ? 1.18
        : profileKey.includes("compact") || profileKey.includes("minimal")
          ? 0.86
          : 1.0;
  const jitter = (seedFraction(seed + 0.41) - 0.5) * 0.22;
  const scale = Math.max(0.8, Math.min(1.45, baseScale + jitter));
  const weightShift =
    profileKey.includes("editorial") ? -60 : profileKey.includes("bold") ? 80 : -10;

  const toRem = (value: number) => `${value.toFixed(2)}rem`;
  const weight = (value: number) => Math.min(800, Math.max(300, value + weightShift));

  return {
    h1: { size: toRem(2.7 * scale), weight: weight(600), lineHeight: "1.05", letterSpacing: "-0.02em" },
    h2: { size: toRem(2.15 * scale), weight: weight(600), lineHeight: "1.15", letterSpacing: "-0.01em" },
    h3: { size: toRem(1.65 * scale), weight: weight(600), lineHeight: "1.25", letterSpacing: "-0.005em" },
    body: { size: toRem(1.0 * Math.min(1.08, scale)), weight: weight(400), lineHeight: "1.7" },
    caption: { size: toRem(0.85 * Math.min(1.05, scale)), weight: weight(400), lineHeight: "1.55" }
  };
};

const buildTheme = (
  palette: {
    primary?: string | null;
    secondary?: string | null;
    background?: string | null;
    accent?: string | null;
  },
  fontFamily?: string | null,
  designFonts?: { heading?: string; body?: string },
  options?: { typographyScale?: string | null; layoutStyle?: string | null; seed?: number }
) => {
  const primary = normalizeHex(palette.primary) ?? "#111827";
  const secondary = normalizeHex(palette.secondary) ?? "#F3F4F6";
  const bgCandidate = normalizeHex(palette.background);
  const bgBase = bgCandidate ?? secondary;
  const bg = isNearWhite(bgBase) ? mixColors(primary, "#FFFFFF", 0.85) : bgBase;
  const text = getContrastText(bg);
  const muted = mixColors(text, bg, 0.65);
  const surface =
    text === "#FFFFFF"
      ? mixColors(bg, "#111827", 0.35)
      : mixColors(bg, "#FFFFFF", 0.7);
  const border =
    text === "#FFFFFF" ? "rgba(255,255,255,0.14)" : "rgba(17,24,39,0.12)";
  const buttonText = getContrastText(primary);
  const fonts = resolveFonts(fontFamily, designFonts);

  const typographyProfile = options?.typographyScale ?? options?.layoutStyle ?? null;
  const textStyles = buildTextStyles(options?.seed ?? 0.52, typographyProfile);

  const styleKey = `${options?.layoutStyle ?? ""} ${options?.typographyScale ?? ""}`.toLowerCase();
  const radius =
    styleKey.includes("compact") || styleKey.includes("minimal") || styleKey.includes("classic")
      ? ("lg" as const)
      : ("xl" as const);

  return {
    primary,
    secondary,
    bg,
    text,
    muted,
    surface,
    border,
    buttonText,
    accent: normalizeHex(palette.accent) ?? primary,
    radius,
    fontHeading: fonts.heading,
    fontBody: fonts.body,
    textStyles,
    pageTransitions: seedFraction((options?.seed ?? 0.52) + 0.77) > 0.5 ? ("slide" as const) : ("fade" as const)
  };
};

const resolvePalette = (
  input: z.infer<typeof PayloadSchema>,
  designDna?: DesignDna | null
) => {
  const primary = normalizeHex(input.primaryColor) ?? normalizeHex(designDna?.palette.primary) ?? "#111827";
  const secondary = normalizeHex(input.secondaryColor) ?? normalizeHex(designDna?.palette.secondary) ?? "#F3F4F6";
  const background = normalizeHex(designDna?.palette.background) ?? secondary;
  const accent = normalizeHex(designDna?.palette.accent) ?? primary;
  return { primary, secondary, background, accent };
};

const createId = () => {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `section-${Date.now()}-${Math.random().toString(16).slice(2)}`;
};

const cloneSection = (section: SiteSection) => ({
  ...section,
  id: createId(),
  content: JSON.parse(JSON.stringify(section.content ?? {})),
  images: section.images ? JSON.parse(JSON.stringify(section.images)) : undefined,
  elements: section.elements ? JSON.parse(JSON.stringify(section.elements)) : undefined
});

const baseStyle = (): SiteSection["style"] => ({
  alignment: "left",
  spacing: "normal",
  background: { type: "plain" },
  buttonStyle: "solid",
  colorOverride: null
});

const fallbackContentForType = (
  type: SiteSection["type"],
  input: z.infer<typeof PayloadSchema>,
  seed: number
) => {
  const profile = resolveToneProfile(input.tone);
  const nicheRules = getNicheRules(input.industry, input.templateId);
  const randomPick = <T,>(items: T[]) => seededPick(items, seed);
  const industry = input.industry.toLowerCase();
  const isRestaurant =
    industry.includes("restaurant") || industry.includes("cafe") || industry.includes("bistro");
  const isClinic = nicheRules.key === "clinic";
  const isBeauty =
    industry.includes("beauty") || industry.includes("spa") || industry.includes("salon");
  const isHospitality =
    industry.includes("hotel") || industry.includes("resort") || industry.includes("hospitality");
  const isCorporate =
    industry.includes("consulting") || industry.includes("agency") || industry.includes("corporate");
  const baseDescription = input.description || `Trusted ${input.industry} services.`;
  const heroCtas = profile.cta;
  const heroKickoffs = [
    `Welcome to ${input.businessName}`,
    `${input.businessName} — ${input.industry}`,
    `${input.businessName}, ${randomPick(profile.adjectives)} ${input.industry}`
  ];
  const heroFeatures = isRestaurant
    ? [
        `Locally ${randomPick(profile.adjectives)} with a ${profile.vibe} experience.`,
        `Seasonal menus and ${randomPick(profile.adjectives)} service.`,
        `Designed to help guests ${randomPick(profile.verbs)} every visit.`
      ]
    : isCorporate
      ? [
          `A ${profile.vibe} partner for strategic growth.`,
          `Clear communication and ${randomPick(profile.adjectives)} delivery.`,
          `Built to help teams ${randomPick(profile.verbs)} with confidence.`
        ]
      : isClinic
        ? [
            "Gentle check-ups and preventive cleanings.",
            "Comfort-first appointments with modern tools.",
            "Whitening, fillings, and restorative care."
          ]
      : [
          ...nicheRules.defaultBulletPool.slice(0, 3)
        ];
  const aboutBullets = isRestaurant
    ? [
        `A ${profile.vibe} team that obsesses over detail.`,
        `Menus crafted around ${randomPick(profile.adjectives)} ingredients.`,
        `Guided by ${randomPick(profile.adjectives)} hospitality and care.`
      ]
    : isCorporate
      ? [
          `A ${profile.vibe} team that obsesses over detail.`,
          `Guided by ${randomPick(profile.adjectives)} strategy and clear communication.`,
          `Focused on measurable results and long-term partnerships.`
        ]
      : isBeauty
        ? [
            `A ${profile.vibe} team focused on personalized care.`,
            `Treatments crafted around ${randomPick(profile.adjectives)} techniques.`,
            `Guided by consistency and thoughtful follow-up.`
          ]
        : [
            `A ${profile.vibe} team that obsesses over detail.`,
            `Services crafted around ${randomPick(profile.adjectives)} expertise.`,
            `Guided by ${randomPick(profile.adjectives)} care and support.`
          ];
  const aboutStats = [
    { label: "Years of experience", value: `${Math.floor(seed * 10) + 8}+` },
    { label: isClinic ? "Patients served" : "Projects completed", value: `${Math.floor(seed * 40) + 20}+` },
    { label: isClinic ? "Patient satisfaction" : "Client satisfaction", value: `${Math.floor(seed * 8) + 92}%` }
  ];
  switch (type) {
    case "hero":
      return {
        kicker: randomPick(profile.kicker),
        headline: randomPick(heroKickoffs),
        subheadline: baseDescription,
        ctaLabel: isRestaurant ? "Make a Reservation" : isClinic ? "Book Appointment" : randomPick(heroCtas),
        ctaHref: isRestaurant ? "#reservation" : "#contact",
        features: heroFeatures,
        imageQueries: isRestaurant
          ? nicheRules.imageQueryPresets.hero
          : nicheRules.imageQueryPresets.hero.length
            ? nicheRules.imageQueryPresets.hero
            : [`${input.businessName} ${input.industry} hero`]
      };
    case "services":
      if (isRestaurant) {
        const sets = [
          [
            { title: "Dine-in experience", body: "Seasonal menus served in a warm, welcoming space." },
            { title: "Takeout & delivery", body: "Order your favorites to enjoy at home." },
            { title: "Private events", body: "Celebrate with curated menus and service." }
          ],
          [
            { title: "Chef’s tasting", body: "Multi-course tasting menus crafted weekly." },
            { title: "Catering", body: "Full-service catering for gatherings and events." },
            { title: "Wine pairing", body: "Sommelier-selected pairings for every course." }
          ]
        ];
        return {
          title: "Menu Highlights",
          subtitle: "From weeknight dinners to milestone celebrations.",
          items: seededPick(sets, seed),
          imageQueries: [
            "restaurant signature dish closeup",
            "chef plating entree",
            "restaurant menu highlights"
          ]
        };
      }
      if (isBeauty) {
        return {
          title: "Signature Services",
          subtitle: "Personalized treatments designed for your glow.",
          items: [
            { title: "Signature treatment", body: "Tailored sessions focused on your goals." },
            { title: "Memberships", body: "Consistent care with member perks." },
            { title: "At-home care", body: "Product recommendations to extend results." }
          ]
        };
      }
      if (isHospitality) {
        return {
          title: "Guest Services",
          subtitle: "Everything you need for a relaxing stay.",
          items: [
            { title: "Concierge", body: "Personalized itineraries and local recommendations." },
            { title: "In-room dining", body: "Seasonal menus delivered to your suite." },
            { title: "Experiences", body: "Curated activities and excursions." }
          ]
        };
      }
      if (isCorporate) {
        return {
          title: "Services",
          subtitle: "Strategy, execution, and ongoing support.",
          items: [
            { title: "Discovery & strategy", body: "Clarify goals and align stakeholders." },
            { title: "Implementation", body: "Hands-on delivery with measurable outcomes." },
            { title: "Optimization", body: "Continuous improvements based on data." }
          ]
        };
      }
      return {
        title: "Services",
        subtitle: `A ${profile.vibe} approach tailored to ${input.industry.toLowerCase()} experiences.`,
        items: [
          isClinic
            ? { title: "Preventive care", body: "Routine check-ups and cleanings for long-term oral health." }
            : { title: "Signature service", body: "High-quality service tailored to your goals." },
          isClinic
            ? { title: "Restorative treatments", body: "Fillings and restorative options with clear explanations." }
            : { title: "Ongoing support", body: "Responsive support and transparent communication." },
          isClinic
            ? { title: "Cosmetic options", body: "Whitening and smile-focused treatments for confident results." }
            : { title: "Results focused", body: "Practical plans designed for measurable outcomes." }
        ]
      };
    case "about":
      return {
        title: `About ${input.businessName}`,
        body: isRestaurant
          ? `${input.businessName} delivers a ${profile.vibe} experience rooted in ${randomPick(profile.adjectives)} hospitality and memorable flavors.`
          : isCorporate
            ? `${input.businessName} delivers ${profile.vibe} service rooted in ${randomPick(profile.adjectives)} strategy and clear execution.`
            : isBeauty
              ? `${input.businessName} delivers a ${profile.vibe} experience rooted in personalized care and thoughtful detail.`
              : `${input.businessName} delivers a ${profile.vibe} experience rooted in ${randomPick(profile.adjectives)} service.`,
        bullets: aboutBullets,
        stats: aboutStats
      };
    case "gallery":
      return {
        title: "Gallery",
        subtitle: isHospitality
          ? "Explore the spaces and experiences awaiting you."
          : isClinic
            ? "A look at our clinic, team, and patient-first environment."
            : "Recent moments from our work and spaces.",
        imageQueries: isRestaurant
          ? nicheRules.imageQueryPresets.gallery
          : nicheRules.imageQueryPresets.gallery.length
            ? nicheRules.imageQueryPresets.gallery
            : [`${input.businessName} ${input.industry} gallery`]
      };
    case "testimonials":
      return {
        title: "Testimonials",
        subtitle: isCorporate ? "Teams we’ve helped deliver results." : "What guests are saying about their visit.",
        items: [
          {
            quote: isCorporate
              ? "Clear communication and measurable impact throughout."
              : "The flavors were unreal — we’ll be back soon.",
            name: "Alex Reed",
            role: isCorporate ? "Operations Lead" : "Guest"
          },
          {
            quote: isCorporate
              ? "Professional, responsive, and aligned with our goals."
              : "Service was thoughtful and the menu was exciting.",
            name: "Morgan Wells",
            role: isCorporate ? "Founder" : "Guest"
          }
        ]
      };
    case "pricing":
      return {
        title: "Pricing",
        subtitle: "Flexible packages for intimate dinners or large events.",
        plans: [
          { name: "Starter", price: "$99", description: "Essentials to begin.", features: ["Setup", "Support"] },
          { name: "Growth", price: "$199", description: "Best for growing teams.", features: ["Strategy", "Reporting"] }
        ]
      };
    case "cta":
      return {
        title: "Ready to get started?",
        body: isRestaurant
          ? "Tell us what you're craving and we will reserve your spot."
          : isCorporate
            ? "Share your goals and we’ll map the next steps."
            : isHospitality
              ? "Plan your stay and we’ll handle the details."
              : "Tell us what you need and we’ll take it from there.",
        ctaLabel: randomPick(heroCtas),
        ctaHref: "#contact"
      };
    case "faq":
      return {
        title: "FAQ",
        subtitle: isClinic ? "Common questions before your appointment." : "Common questions before getting started.",
        items: isClinic
          ? [
              { question: "Do you accept new patients?", answer: "Yes, we welcome new patients and can book quickly." },
              { question: "Which treatments do you offer?", answer: "We provide check-ups, cleanings, and restorative care." }
            ]
          : [
              { question: "How do we get started?", answer: "Use the primary CTA and we will guide you through the next step." },
              { question: "How fast is response time?", answer: "Most inquiries receive a response within one business day." }
            ]
      };
    case "contact":
      return {
        title: "Contact",
        body: "Reach out with questions, and we will respond quickly.",
        email: input.contact?.email ?? undefined,
        phone: input.contact?.phone ?? undefined,
        address: input.contact?.address ?? undefined
      };
    case "reservation":
      return {
        title: isClinic ? "Book an Appointment" : "Reservations",
        body: isClinic ? "Choose a date and time and we will confirm your appointment." : "Book your table and we’ll confirm shortly."
      };
    case "footer":
      return { text: `© ${new Date().getFullYear()} ${input.businessName}. All rights reserved.` };
    default:
      return {};
  }
};

const enforceFeatureToggles = (sections: SiteSection[], featureFlags: FeatureFlags) => {
  return sections.map((section) => {
    const enabled = isSectionEnabled(section.type, featureFlags, section.enabled ?? true);
    return { ...section, enabled };
  });
};

const buildSectionPlan = (
  templateId: string,
  input: z.infer<typeof PayloadSchema>,
  seed: number,
  options?: {
    useFallbackContent?: boolean;
    sectionOrder?: string[];
    variantBias?: Record<string, string>;
    spacingOverrides?: Record<string, SiteSection["style"]["spacing"]>;
    alignmentOverrides?: Record<string, SiteSection["style"]["alignment"]>;
    layoutStyle?: string | null;
    allowedSectionTypes?: SiteSection["type"][];
    requiredSectionTypes?: SiteSection["type"][];
  }
) => {
  const defaultsRaw =
    TEMPLATE_DEFAULT_SECTIONS[templateId] ?? [
      { type: "hero", variant: "A", enabled: true },
      { type: "services", variant: "A", enabled: true },
      { type: "about", variant: "A", enabled: true },
      { type: "gallery", variant: "A", enabled: false },
      { type: "testimonials", variant: "A", enabled: false },
      { type: "pricing", variant: "A", enabled: false },
      { type: "cta", variant: "A", enabled: true },
      { type: "faq", variant: "A", enabled: false },
      { type: "contact", variant: "A", enabled: true },
      { type: "reservation", variant: "A", enabled: false },
      { type: "footer", variant: "A", enabled: true }
    ];

  const allowedSet = new Set<SiteSection["type"]>(options?.allowedSectionTypes ?? defaultsRaw.map((item) => item.type));
  const requiredSet = new Set<SiteSection["type"]>(options?.requiredSectionTypes ?? []);
  const defaults = defaultsRaw.filter((item) => allowedSet.has(item.type));
  const defaultByType = new Map(defaultsRaw.map((item) => [item.type, item]));

  requiredSet.forEach((type) => {
    if (!allowedSet.has(type)) return;
    if (defaults.some((section) => section.type === type)) return;
    const fallback = defaultByType.get(type);
    defaults.push({
      type,
      variant: fallback?.variant ?? "A",
      enabled: true
    });
  });

  const orderFromAi = options?.sectionOrder ?? [];
  const byType = new Map(defaults.map((preset) => [preset.type, preset]));
  const ordered: typeof defaults = [];
  orderFromAi.forEach((type) => {
    const match = byType.get(type as SiteSection["type"]);
    if (match) {
      ordered.push(match);
      byType.delete(type as SiteSection["type"]);
    }
  });
  ordered.push(...Array.from(byType.values()));

  const useFallbackContent = options?.useFallbackContent === true;

  return ordered.map((preset, index) => {
    const nextSeed = seed + index * 0.17;
    return {
      type: preset.type,
      variant: resolveVariant(
        templateId,
        preset.type,
        preset.variant,
        nextSeed,
        options?.variantBias?.[preset.type]
      ),
      enabled: true,
      style: buildSectionStyle(preset.type, nextSeed, {
        layoutStyle: options?.layoutStyle,
        spacingOverride: options?.spacingOverrides?.[preset.type],
        alignmentOverride: options?.alignmentOverrides?.[preset.type]
      }),
      content: useFallbackContent ? fallbackContentForType(preset.type, input, nextSeed) : {}
    };
  });
};

const ensureRequiredSections = (
  sections: SiteSection[],
  input: z.infer<typeof PayloadSchema>,
  templateId: string,
  seed: number,
  requiredSectionTypes: SiteSection["type"][]
) => {
  let next = [...sections];
  const existingTypes = new Set(next.map((section) => section.type));

  const appendBeforeFooter = (section: SiteSection) => {
    const footerIndex = next.findIndex((item) => item.type === "footer");
    if (footerIndex === -1) {
      next.push(section);
      return;
    }
    next.splice(footerIndex, 0, section);
  };

  requiredSectionTypes.forEach((type, index) => {
    if (existingTypes.has(type)) {
      next = next.map((section) => (section.type === type ? { ...section, enabled: true } : section));
      return;
    }

    const sectionSeed = seed + index * 0.33;
    const variant = resolveVariant(templateId, type, "A", sectionSeed);
    const newSection: SiteSection = {
      id: createId(),
      type,
      variant,
      enabled: true,
      style: buildSectionStyle(type, sectionSeed),
      content: fallbackContentForType(type, input, sectionSeed)
    };
    appendBeforeFooter(newSection);
    existingTypes.add(type);
  });

  next.forEach((section) => ensureImageQueries(section, input));
  return next;
};

const createDeterministicSection = (
  type: SiteSection["type"],
  input: z.infer<typeof PayloadSchema>,
  templateId: string,
  seed: number
): SiteSection => ({
  id: createId(),
  type,
  variant: resolveVariant(templateId, type, "A", seed),
  enabled: true,
  style: buildSectionStyle(type, seed),
  content: fallbackContentForType(type, input, seed)
});

const applySectionPolicyToDocument = (
  document: SiteDocument,
  input: z.infer<typeof PayloadSchema>,
  templateId: string,
  seed: number,
  policy: SectionPolicy
): SiteDocument => {
  return enforceFeatureGating(
    document,
    policy.allowedSectionTypes,
    policy.requiredSectionTypes,
    {
      createRequiredSection: (type, pageIndex) =>
        createDeterministicSection(type, input, templateId, seed + pageIndex * 0.19 + type.length * 0.07)
    }
  );
};

const applyGenerationRules = (
  document: SiteDocument,
  input: z.infer<typeof PayloadSchema>,
  rules: NicheRules,
  sectionPolicy: SectionPolicy,
  templateId: string,
  seed: number
) => {
  const withPolicy = applySectionPolicyToDocument(document, input, templateId, seed, sectionPolicy);
  const withNiche = enforceNicheCopyRequirements(withPolicy, input, rules);
  const withNicheLint = applyNicheLint(withNiche, rules);
  return normalizeAnchors(withNicheLint, {
    bookingSelected: sectionPolicy.allowedSectionTypes.includes("reservation"),
    contactSelected: sectionPolicy.allowedSectionTypes.includes("contact")
  });
};

const countImageStats = (document: SiteDocument) => {
  let totalImages = 0;
  let totalImageQueries = 0;
  document.pages.forEach((page) => {
    page.sections.forEach((section) => {
      totalImages += section.images?.length ?? 0;
      const queries = (section.content as Record<string, any>)?.imageQueries;
      if (Array.isArray(queries)) {
        totalImageQueries += queries.length;
      }
    });
  });
  return { totalImages, totalImageQueries };
};

const buildFallbackDocument = (
  input: z.infer<typeof PayloadSchema>,
  seed: number,
  rules: NicheRules,
  sectionPolicy: SectionPolicy,
  preset: ReturnType<typeof resolveTemplatePreset>
) => {
  const planSections = buildSectionPlan(preset.templateId, input, seed, {
    useFallbackContent: true,
    sectionOrder: preset.sectionOrder,
    variantBias: preset.variantBias as Record<string, string>,
    allowedSectionTypes: sectionPolicy.allowedSectionTypes,
    requiredSectionTypes: sectionPolicy.requiredSectionTypes
  }).map((preset) => ({
    ...preset,
    id: createId()
  })) as SiteSection[];

  const baseSections = enforceFeatureToggles(planSections, {
    includeServices: sectionPolicy.allowedSectionTypes.includes("services"),
    includeTestimonials: sectionPolicy.allowedSectionTypes.includes("testimonials"),
    includePricing: sectionPolicy.allowedSectionTypes.includes("pricing"),
    includeFaq: sectionPolicy.allowedSectionTypes.includes("faq"),
    includeContact: sectionPolicy.allowedSectionTypes.includes("contact"),
    includeReservation: sectionPolicy.allowedSectionTypes.includes("reservation"),
    includeGallery: sectionPolicy.allowedSectionTypes.includes("gallery")
  });
  const requiredSections = ensureRequiredSections(
    baseSections,
    input,
    preset.templateId,
    seed,
    sectionPolicy.requiredSectionTypes
  );
  const nextPages =
    input.pagesMode === "multi"
      ? buildMultiPageStructure(requiredSections)
      : [
          {
            id: createId(),
            name: "Home",
            slug: "home",
            showInMenu: true,
            menuTitle: "Home",
            parentId: null,
            order: 0,
            sections: requiredSections
          }
        ];

  const baseDocument: SiteDocument = {
    templateId: preset.templateId,
    tone: input.tone,
    theme: buildTheme(resolvePalette(input, null), input.fontFamily ?? undefined, undefined, {
      seed,
      typographyScale: null,
      layoutStyle: null
    }),
    seo: {
      title: `${input.businessName} | ${input.industry}`,
      description: input.description,
      ogImage: null
    },
    pages: nextPages,
    apps: [],
    siteBrief: {
      businessName: input.businessName,
      industry: input.industry,
      description: input.description,
      tone: input.tone,
      pages: nextPages.map((page) => page.name),
      theme: {
        primary: input.primaryColor ?? undefined,
        background: input.secondaryColor ?? undefined,
        fontFamily: input.fontFamily ?? undefined
      }
    },
    savedSections: [],
    mediaLibrary: [],
    chat_prompt_topbar_enabled: false,
    chat_prompt_topbar_text: DEFAULT_CHAT_PROMPT_TEXT,
    chat_prompt_topbar_cta: DEFAULT_CHAT_PROMPT_CTA,
    chat_launcher_glow_enabled: false,
    customCode: {
      head: null,
      body: null
    }
  };

  const withPolicy = applySectionPolicyToDocument(baseDocument, input, preset.templateId, seed, sectionPolicy);
  const withNicheCopy = enforceNicheCopyRequirements(withPolicy, input, rules);
  const withLint = applyNicheLint(withNicheCopy, rules);
  const withNormalizedAnchors = normalizeAnchors(withLint, {
    bookingSelected: sectionPolicy.allowedSectionTypes.includes("reservation"),
    contactSelected: sectionPolicy.allowedSectionTypes.includes("contact")
  });
  const validated = SiteDocumentSchema.safeParse(withNormalizedAnchors);
  if (!validated.success) return null;
  return validated.data;
};

const buildAnyValidFallbackDocument = (
  input: z.infer<typeof PayloadSchema>,
  seed: number,
  rules: NicheRules,
  sectionPolicy: SectionPolicy,
  preset: ReturnType<typeof resolveTemplatePreset>
) => {
  const primary = buildFallbackDocument(input, seed, rules, sectionPolicy, preset);
  if (primary) return primary;

  const relaxedRules = getNicheRules("generic", preset.templateId);
  const relaxed = buildFallbackDocument(input, seed + 0.17, relaxedRules, sectionPolicy, preset);
  if (relaxed) return relaxed;

  return null;
};

const mergeAiSection = (
  preset: SiteSection,
  aiSection: Partial<SiteSection> | undefined,
  templateId: string,
  aiHasVariantDiversity: boolean
) => {
  const allowedVariants = TEMPLATE_ALLOWED_VARIANTS[templateId]?.[preset.type] ?? ["A"];
  const aiVariant = typeof aiSection?.variant === "string" ? aiSection.variant : null;
  const allowAiVariant =
    aiVariant &&
    allowedVariants.includes(aiVariant) &&
    (aiHasVariantDiversity || aiVariant !== "A");
  const variant = allowAiVariant ? aiVariant : preset.variant;

  return {
    id: aiSection?.id ?? preset.id,
    type: preset.type,
    variant,
    enabled: aiSection?.enabled ?? preset.enabled,
    style: { ...preset.style, ...(aiSection?.style ?? {}) },
    content: { ...preset.content, ...(aiSection?.content ?? {}) },
    contentStyles: aiSection?.contentStyles ?? preset.contentStyles,
    elements: aiSection?.elements ?? preset.elements,
    images: Array.isArray(aiSection?.images) ? aiSection.images : preset.images
  } as SiteSection;
};

const ensureImageQueries = (section: SiteSection, input: z.infer<typeof PayloadSchema>) => {
  if (input.hasOwnPhotos) return;
  const needsImages = ["hero", "about", "gallery", "cta"].includes(section.type);
  if (!needsImages) return;
  const content = section.content as Record<string, any>;
  if (!Array.isArray(content.imageQueries) || content.imageQueries.length === 0) {
    content.imageQueries = [`${input.businessName} ${input.industry} ${section.type}`];
  }
};

const buildAccentGradient = (
  palette: { primary: string; secondary: string; background: string; accent: string },
  seed: number
) => {
  const start = mixColors(palette.background, palette.primary, 0.18 + seedFraction(seed) * 0.14);
  const end = mixColors(palette.background, palette.accent, 0.05 + seedFraction(seed + 0.37) * 0.1);
  return {
    angle: 135,
    stops: [
      { color: start, position: 0 },
      { color: end, position: 100 }
    ]
  };
};

const enforceVariantDiversity = (
  sections: SiteSection[],
  templateId: string,
  seed: number
) => {
  const allowed = TEMPLATE_ALLOWED_VARIANTS[templateId] ?? {};
  const candidates = sections.filter((section) => (allowed[section.type] ?? ["A"]).length > 1);
  if (!candidates.length) return sections;
  const nonA = candidates.filter((section) => section.variant !== "A");
  const minNonA = Math.min(4, Math.max(3, Math.ceil(candidates.length * 0.6)));
  if (nonA.length >= minNonA) return sections;

  let count = nonA.length;
  return sections.map((section, index) => {
    if (count >= minNonA) return section;
    const variants = (allowed[section.type] ?? ["A"]).filter((variant) => variant !== "A");
    if (!variants.length || section.variant !== "A") return section;
    const picked = seededPick(variants, seed + index * 0.27);
    count += 1;
    return { ...section, variant: picked };
  });
};

const applyVisualDepth = (
  sections: SiteSection[],
  palette: { primary: string; secondary: string; background: string; accent: string },
  seed: number,
  layoutStyle?: string | null,
  emphasis?: string[] | null
) =>
  sections.map((section, index): SiteSection => {
    if (section.style.background.type !== "plain") return section;
    const styleKey = (layoutStyle ?? "").toLowerCase();
    const isEmphasis = Boolean(emphasis?.includes(section.type));
    const accentBias =
      styleKey.includes("editorial") || styleKey.includes("lux") || styleKey.includes("immersive")
        ? 0.75
        : styleKey.includes("compact")
          ? 0.35
          : 0.55;
    const shouldAccent =
      isEmphasis ||
      section.type === "hero" ||
      section.type === "cta" ||
      section.type === "testimonials" ||
      section.type === "gallery" ||
      section.type === "services" ||
      section.type === "about" ||
      seedFraction(seed + index * 0.19) > 1 - accentBias;
    if (!shouldAccent) return section;
    const imageEligible = ["hero", "gallery", "cta", "testimonials", "about"].includes(section.type);
    const imageBias =
      styleKey.includes("immersive") || styleKey.includes("editorial") || styleKey.includes("lux")
        ? 0.65
        : 0.45;
    const shouldUseImage =
      imageEligible && seedFraction(seed + index * 0.29) > 1 - imageBias;
    if (shouldUseImage) {
      return {
        ...section,
        style: {
          ...section.style,
          background: {
            type: "image",
            overlay: styleKey.includes("minimal") ? 0.25 : 0.45,
            size: "cover",
            position: "center",
            repeat: "no-repeat"
          }
        }
      };
    }
    const gradient = buildAccentGradient(palette, seed + index * 0.17);
    const background: SiteSection["style"]["background"] = {
      type: "gradient",
      angle: gradient.angle,
      stops: gradient.stops
    };
    return {
      ...section,
      style: {
        ...section.style,
        background
      }
    };
  });

const buildMultiPageStructure = (sections: SiteSection[]) => {
  const pool = sections.filter((section) => section.enabled);
  const footer = pool.find((section) => section.type === "footer");
  const take = (type: SiteSection["type"]) => {
    const index = pool.findIndex((section) => section.type === type);
    if (index === -1) return null;
    return pool.splice(index, 1)[0];
  };

  const pageDefs: Array<{ name: string; slug: string; types: SiteSection["type"][] }> = [
    { name: "Home", slug: "home", types: ["hero", "services", "cta", "gallery"] },
    { name: "About", slug: "about", types: ["about", "testimonials"] },
    { name: "Services", slug: "services", types: ["services", "pricing"] },
    { name: "FAQ", slug: "faq", types: ["faq"] },
    { name: "Contact", slug: "contact", types: ["contact", "reservation"] }
  ];

  const pages = pageDefs
    .map((def, index) => {
      const picked = def.types.map((type) => take(type)).filter(Boolean) as SiteSection[];
      if (!picked.length) return null;
      const pageSections = footer ? [...picked, cloneSection(footer)] : picked;
      return {
        id: createId(),
        name: def.name,
        slug: def.slug,
        showInMenu: true,
        menuTitle: def.name,
        order: index,
        sections: pageSections
      };
    })
    .filter(Boolean) as any[];

  if (!pages.length) {
    const fallback = sections.length ? sections : [];
    return [
      {
        id: createId(),
        name: "Home",
        slug: "home",
        showInMenu: true,
        menuTitle: "Home",
        order: 0,
        sections: footer ? [...fallback, cloneSection(footer)] : fallback
      }
    ];
  }

  if (pool.length) {
    const home = pages.find((page) => page.slug === "home");
    if (home) {
      home.sections = [...home.sections, ...pool];
    }
  }

  return pages;
};

const extractJsonObject = (raw: string) => {
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return raw;
  return raw.slice(start, end + 1);
};

const safeJsonParse = (raw: string) => {
  try {
    return JSON.parse(raw);
  } catch {
    try {
      return JSON.parse(extractJsonObject(raw));
    } catch {
      return null;
    }
  }
};

const parseAiPages = (raw: string) => {
  const parsed = safeJsonParse(raw);
  if (!parsed) return null;
  if (Array.isArray(parsed?.pages)) return parsed.pages;
  if (parsed?.pages && Array.isArray(parsed.pages.sections)) {
    const pageMeta = parsed.pages;
    return [
      {
        id: pageMeta.id ?? createId(),
        name: pageMeta.name ?? "Home",
        slug: pageMeta.slug ?? "home",
        showInMenu: true,
        menuTitle: pageMeta.menuTitle ?? pageMeta.name ?? "Home",
        parentId: null,
        order: 0,
        sections: pageMeta.sections
      }
    ];
  }
  if (Array.isArray(parsed?.site?.pages)) return parsed.site.pages;
  if (Array.isArray(parsed?.siteDocument?.pages)) return parsed.siteDocument.pages;
  const sections =
    (Array.isArray(parsed?.sections) && parsed.sections) ||
    (Array.isArray(parsed?.page?.sections) && parsed.page.sections) ||
    (Array.isArray(parsed?.home?.sections) && parsed.home.sections) ||
    (Array.isArray(parsed?.site?.sections) && parsed.site.sections) ||
    (Array.isArray(parsed?.siteDocument?.sections) && parsed.siteDocument.sections);
  if (Array.isArray(sections)) {
    const pageMeta = parsed?.page ?? parsed?.home ?? {};
    return [
      {
        id: pageMeta.id ?? createId(),
        name: pageMeta.name ?? "Home",
        slug: pageMeta.slug ?? "home",
        showInMenu: true,
        menuTitle: pageMeta.menuTitle ?? pageMeta.name ?? "Home",
        parentId: null,
        order: 0,
        sections
      }
    ];
  }
  return null;
};

const buildPrompt = (
  input: z.infer<typeof PayloadSchema>,
  variationSeed?: string,
  designDna?: DesignDna | null,
  layoutPlan?: LayoutPlan | null,
  featureFlags?: FeatureFlags,
  nicheRules?: NicheRules,
  sectionPolicy?: SectionPolicy,
  templatePreset?: ReturnType<typeof resolveTemplatePreset>
) => {
  const preset = templatePreset ?? resolveTemplatePreset({
    nicheKey: (nicheRules ?? getNicheRules(input.industry, input.templateId)).key,
    requestedTemplateId: input.templateId,
    allowedSectionTypes:
      sectionPolicy?.allowedSectionTypes ??
      computeSectionPolicyFromFeatureFlags(featureFlags ?? resolveFeatureFlags(input)).allowedSectionTypes,
    requiredSectionTypes:
      sectionPolicy?.requiredSectionTypes ??
      computeSectionPolicyFromFeatureFlags(featureFlags ?? resolveFeatureFlags(input)).requiredSectionTypes
  });
  const rules = nicheRules ?? getNicheRules(input.industry, preset.templateId);
  const allowedVariants = TEMPLATE_ALLOWED_VARIANTS[preset.templateId] ?? {};
  const featureSet = featureFlags ?? resolveFeatureFlags(input);
  const policy = sectionPolicy ?? computeSectionPolicyFromFeatureFlags(featureSet);
  const plan = (TEMPLATE_DEFAULT_SECTIONS[preset.templateId] ?? []).filter((item) =>
    policy.allowedSectionTypes.includes(item.type)
  );
  const planOrder =
    preset.sectionOrder.length > 0
      ? preset.sectionOrder
      : layoutPlan?.sectionOrder?.length
        ? layoutPlan.sectionOrder.filter((type) => policy.allowedSectionTypes.includes(type as SiteSection["type"]))
        : plan.map((item) => item.type);

  return [
    "You are generating a SiteDocument JSON for a website builder.",
    "Return JSON only. No markdown.",
    "Use the sections list and order provided.",
    "Do not add sections. Do not remove sections. Fill content keys only for the provided skeleton.",
    "For each section choose a variant from the allowed variants list.",
    "Use at least three non-'A' variants when allowed to avoid repetitive layouts.",
    "Follow the layout plan provided (sectionOrder, variants, spacing, alignment).",
    "Match enabled flags to the provided feature toggles.",
    "Include style: { alignment, spacing, background, buttonStyle }.",
    "Include required content keys per section type.",
    "Add imageQueries: string[] for hero, about, gallery, cta sections.",
    "DO NOT use forbidden topics. Rewrite immediately if a forbidden topic appears.",
    "Use the theme colors and font in the layout descriptions and copy tone.",
    buildNicheRulesPromptBlock(rules, input),
    TEMPLATE_PROMPT_HINTS[input.templateId] ?? "",
    designDna ? `designLayoutStyle: ${designDna.layoutStyle}` : "",
    designDna ? `designPalette: ${JSON.stringify(designDna.palette)}` : "",
    designDna ? `designFonts: ${JSON.stringify(designDna.fontPair)}` : "",
    designDna ? `variantBias: ${JSON.stringify(designDna.variantBias ?? {})}` : "",
    designDna ? `sectionOrder: ${JSON.stringify(designDna.sectionOrder ?? [])}` : "",
    designDna ? `imageryStyle: ${designDna.imageryStyle ?? ""}` : "",
    layoutPlan ? `layoutPlan.sectionOrder: ${JSON.stringify(layoutPlan.sectionOrder ?? [])}` : "",
    layoutPlan ? `layoutPlan.variants: ${JSON.stringify(layoutPlan.variants ?? {})}` : "",
    layoutPlan ? `layoutPlan.spacing: ${JSON.stringify(layoutPlan.spacing ?? {})}` : "",
    layoutPlan ? `layoutPlan.alignment: ${JSON.stringify(layoutPlan.alignment ?? {})}` : "",
    layoutPlan ? `layoutPlan.typographyScale: ${layoutPlan.typographyScale ?? ""}` : "",
    variationSeed ? `variationSeed: ${variationSeed}` : "variationSeed: none",
    "STYLE ENUMS (MUST FOLLOW EXACTLY):",
    'alignment: "left" | "center"',
    'spacing: "compact" | "normal" | "airy"',
    'background: {"type":"plain"} OR {"type":"gradient","angle":0-360,"stops":[{"color":"#hex","position":0-100}]} OR {"type":"image","value":"<url?>","overlay":0.0-1.0,"size":"cover|contain","position":"center|top|bottom|left|right","repeat":"no-repeat|repeat"}',
    'buttonStyle: "solid" | "outline"',
    "FORBIDDEN:",
    '- spacing values like "large"',
    '- background as a string like "image"',
    '- buttonStyle like "rounded"',
    "Write copy in the requested tone.",
    `templateId: ${input.templateId}`,
    `tone: ${input.tone}`,
    `primaryColor: ${input.primaryColor ?? ""}`,
    `secondaryColor: ${input.secondaryColor ?? ""}`,
    `fontFamily: ${input.fontFamily ?? ""}`,
    `businessName: ${input.businessName}`,
    `industry: ${input.industry}`,
    `description: ${input.description}`,
    `contactEmail: ${input.contact?.email ?? ""}`,
    `contactPhone: ${input.contact?.phone ?? ""}`,
    `contactAddress: ${input.contact?.address ?? ""}`,
    `openingHours: ${input.openingHours ?? ""}`,
    `socials: ${JSON.stringify(input.socials ?? {})}`,
    `features: ${JSON.stringify(featureSet)}`,
    `requiredSectionTypes: ${JSON.stringify(policy.requiredSectionTypes)}`,
    `enabledSections: ${JSON.stringify(planOrder)}`,
    `sectionsOrder: ${JSON.stringify(planOrder)}`,
    `allowedVariants: ${JSON.stringify(allowedVariants)}`,
    "Required content keys:",
    "hero: headline, subheadline, ctaLabel, ctaHref",
    "services: title, items[{title, body}]",
    "about: title, body",
    "gallery: title",
    "testimonials: title, items[{quote, name, role}]",
    "pricing: title, plans[{name, price, description, features}]",
    "cta: title, body, ctaLabel, ctaHref",
    "faq: title, items[{question, answer}]",
    "contact: title, body, email?, phone?, address?",
    "reservation: title, body",
    "footer: text",
    "Minimal JSON example:",
    "{",
    '  "pages":[',
    "    {",
    '      "id":"...",',
    '      "name":"Home",',
    '      "slug":"home",',
    '      "sections":[',
    "        {",
    '          "id":"...",',
    '          "type":"hero",',
    '          "variant":"A",',
    '          "enabled":true,',
    '          "style":{',
    '            "alignment":"left",',
    '            "spacing":"normal",',
    '            "background":{"type":"plain"},',
    '            "buttonStyle":"solid",',
    '            "colorOverride":null',
    "          },",
    '          "content":{',
    '            "headline":"...",',
    '            "subheadline":"...",',
    '            "ctaLabel":"...",',
    '            "ctaHref":"#contact",',
    '            "imageQueries":["..."]',
    "          }",
    "        }",
    "      ]",
    "    }",
    "  ]",
    "}",
    "Output shape:",
    "{ pages: [{ id, name, slug, sections: [{ id, type, variant, enabled, style, content }] }] }"
  ].join("\n");
};

const buildDesignDnaPrompt = (
  input: z.infer<typeof PayloadSchema>,
  rules: NicheRules,
  preset: ReturnType<typeof resolveTemplatePreset>,
  variationSeed?: string
) => {
  return [
    "You are creating a unique design DNA for a website.",
    "Return JSON only. No markdown.",
    "The design DNA must be different on every run, even if the business data is similar.",
    "Pick a distinct layout archetype each run: editorial, split-hero, image-first, typography-forward, grid-based, immersive, asymmetrical, minimal-classic.",
    "Include layoutStyle, palette, fontPair, variantBias, sectionOrder, imageryStyle.",
    `variationSeed: ${variationSeed ?? "none"}`,
    `businessName: ${input.businessName}`,
    `industry: ${input.industry}`,
    `nicheKey: ${rules.key}`,
    `forbiddenTopics: ${JSON.stringify(rules.forbiddenTopics)}`,
    `requiredTopics: ${JSON.stringify(rules.requiredTerms)}`,
    `nicheExampleBullets: ${JSON.stringify(rules.defaultBulletPool.slice(0, 3))}`,
    `description: ${input.description}`,
    `tone: ${input.tone}`,
    `templateId: ${preset.templateId}`,
    `allowedTemplateIds: ${JSON.stringify(preset.allowedTemplateIds)}`,
    `currentPrimary: ${input.primaryColor ?? ""}`,
    `currentSecondary: ${input.secondaryColor ?? ""}`,
    `currentFont: ${input.fontFamily ?? ""}`,
    `allowedFonts: ${FONT_OPTIONS.join(" | ")}`,
    `allowedVariants: ${JSON.stringify(TEMPLATE_ALLOWED_VARIANTS[preset.templateId] ?? {})}`,
    "Palette guidance: use hex colors, avoid pure white backgrounds, include a bold accent.",
    "If currentPrimary/currentSecondary are provided, keep them as palette.primary/secondary.",
    "If currentFont is provided, use it for fontPair.heading and fontPair.body.",
    "Section order should include at least 6 sections and vary order from defaults by at least 2 swaps.",
    "Example output:",
    "{",
    '  "layoutStyle":"editorial split hero with immersive imagery",',
    '  "palette":{"primary":"#0F766E","secondary":"#F4F1EA","background":"#FCFAF7","accent":"#F59E0B"},',
    '  "fontPair":{"heading":"Playfair Display, Inter, system-ui, sans-serif","body":"Inter, system-ui, sans-serif"},',
    '  "variantBias":{"hero":"B","services":"B","gallery":"A"},',
    '  "sectionOrder":["hero","about","services","gallery","testimonials","cta","contact","footer"],',
    '  "imageryStyle":"warm editorial food photography, natural light"',
    "}"
  ].join("\n");
};

const buildLayoutPlanPrompt = (
  input: z.infer<typeof PayloadSchema>,
  rules: NicheRules,
  preset: ReturnType<typeof resolveTemplatePreset>,
  sectionPolicy: SectionPolicy,
  designDna: DesignDna | null,
  variationSeed?: string
) => {
  const plan = preset.sectionOrder;
  const allowedVariants = TEMPLATE_ALLOWED_VARIANTS[preset.templateId] ?? {};
  return [
    "You are planning the layout of a SiteDocument for a website builder.",
    "Return JSON only. No markdown.",
    "Return only plan fields for the provided skeleton. Do not invent sections.",
    "Pick templateId from allowedTemplateIds only.",
    "Section order is locked. Use exactly the provided sectionOrder.",
    "Provide variantBias and variants map using allowed variants per section.",
    "Use at least 3 non-'A' variants when possible.",
    "Provide spacing and alignment choices per section type.",
    "Choose a typographyScale: editorial | bold | classic | compact.",
    "Do not mention forbidden topics. Rewrite if you do.",
    `nicheKey: ${rules.key}`,
    `forbiddenTopics: ${JSON.stringify(rules.forbiddenTopics)}`,
    `requiredTopics: ${JSON.stringify(rules.requiredTerms)}`,
    `nicheExampleBullets: ${JSON.stringify(rules.defaultBulletPool.slice(0, 3))}`,
    `allowedTemplateIds: ${JSON.stringify(preset.allowedTemplateIds)}`,
    `templateId: ${preset.templateId}`,
    "Section order must only include these types:",
    JSON.stringify(plan),
    `requiredSectionTypes: ${JSON.stringify(sectionPolicy.requiredSectionTypes)}`,
    "Allowed variants:",
    JSON.stringify(allowedVariants),
    designDna ? `designLayoutStyle: ${designDna.layoutStyle}` : "",
    designDna ? `designPalette: ${JSON.stringify(designDna.palette)}` : "",
    designDna ? `designFonts: ${JSON.stringify(designDna.fontPair)}` : "",
    variationSeed ? `variationSeed: ${variationSeed}` : "",
    "Example:",
    "{",
    `  "templateId":"${preset.templateId}",`,
    '  "sectionOrder":["hero","about","services","gallery","testimonials","cta","contact","footer"],',
    '  "variants":{"hero":"B","services":"C","gallery":"B"},',
    '  "variantBias":{"hero":"B","services":"C"},',
    '  "spacing":{"hero":"airy","services":"normal","cta":"compact"},',
    '  "alignment":{"hero":"left","cta":"center"},',
    '  "typographyScale":"editorial",',
    '  "emphasis":["hero","gallery"]',
    "}"
  ]
    .filter(Boolean)
    .join("\n");
};

const buildFallbackDesignDna = (
  input: z.infer<typeof PayloadSchema>,
  templateId: string,
  variationSeed: string
): DesignDna => {
  const palette = resolvePalette(input, null);
  const baseFont = input.fontFamily ?? FONT_OPTIONS[0];
  const sectionOrder = (TEMPLATE_DEFAULT_SECTIONS[templateId] ?? []).map((item) => item.type);
  return {
    variationSeed,
    layoutStyle: "clean structured layout",
    palette: {
      primary: palette.primary,
      secondary: palette.secondary,
      background: palette.background,
      accent: palette.accent
    },
    fontPair: {
      heading: baseFont,
      body: baseFont
    },
    variantBias: {
      hero: "A",
      services: "A",
      cta: "A"
    },
    sectionOrder,
    imageryStyle: `${input.industry} professional photography`
  };
};

const buildFallbackLayoutPlan = (
  preset: ReturnType<typeof resolveTemplatePreset>,
  sectionPolicy: SectionPolicy
): LayoutPlan => {
  const sectionOrder = preset.sectionOrder.filter((type) => sectionPolicy.allowedSectionTypes.includes(type));

  const variants = Object.fromEntries(
    sectionOrder.map((type) => [type, TEMPLATE_ALLOWED_VARIANTS[preset.templateId]?.[type]?.[0] ?? "A"])
  );
  const spacing = Object.fromEntries(
    sectionOrder.map((type) => [type, type === "hero" ? "airy" : type === "cta" ? "compact" : "normal"])
  ) as LayoutPlan["spacing"];
  const alignment = Object.fromEntries(
    sectionOrder.map((type) => [type, type === "hero" || type === "cta" ? "center" : "left"])
  ) as LayoutPlan["alignment"];

  return {
    templateId: preset.templateId,
    variantBias: preset.variantBias,
    sectionOrder,
    variants,
    spacing,
    alignment,
    typographyScale: "classic",
    emphasis: ["hero", "cta"]
  };
};

const clamp01 = (value: number) => Math.min(1, Math.max(0, value));

const REQUIRED_CONTENT_KEYS: Record<SiteSection["type"], string[]> = {
  hero: ["headline", "subheadline", "ctaLabel", "ctaHref"],
  services: ["title", "items"],
  about: ["title", "body"],
  gallery: ["title"],
  testimonials: ["title", "items"],
  pricing: ["title", "plans"],
  cta: ["title", "body", "ctaLabel", "ctaHref"],
  faq: ["title", "items"],
  contact: ["title", "body"],
  reservation: ["title", "body"],
  footer: ["text"],
  newsletter: ["title", "body", "ctaLabel"],
  "blog-index": ["title"],
  "blog-post": ["title", "body"],
  "store-listing": ["title"],
  "store-product": ["title", "body"],
  "store-cart": ["title"],
  custom: ["title", "body"],
  "app-embed": ["title", "body"]
};

const findMissingContent = (document: SiteDocument) => {
  const missing: Array<{ sectionId: string; type: SiteSection["type"]; key: string }> = [];
  document.pages.forEach((page) => {
    page.sections.forEach((section) => {
      if (section.elements?.length) return;
      const required = REQUIRED_CONTENT_KEYS[section.type] ?? [];
      required.forEach((key) => {
        const value = (section.content ?? {})[key];
        if (value === undefined || value === null) {
          missing.push({ sectionId: section.id, type: section.type, key });
        }
      });
    });
  });
  return missing;
};

const applyContentPatches = (
  document: SiteDocument,
  patches: Array<{ sectionId: string; content: Record<string, any> }>
) => {
  if (!patches.length) return document;
  const patchMap = new Map(patches.map((patch) => [patch.sectionId, patch.content]));
  return {
    ...document,
    pages: document.pages.map((page) => ({
      ...page,
      sections: page.sections.map((section) => {
        const patch = patchMap.get(section.id);
        if (!patch) return section;
        return {
          ...section,
          content: { ...(section.content ?? {}), ...patch }
        };
      })
    }))
  };
};

const fallbackValueForKey = (
  key: string,
  type: SiteSection["type"],
  input: z.infer<typeof PayloadSchema>
) => {
  if (key === "ctaHref") return type === "hero" && input.industry.toLowerCase().includes("restaurant") ? "#reservation" : "#contact";
  if (key === "ctaLabel") return type === "hero" ? "Get started" : "Learn more";
  if (key === "headline") return `${input.businessName} ${input.industry}`;
  if (key === "subheadline") return input.description;
  if (key === "title") return input.businessName;
  if (key === "body") return input.description;
  if (key === "text") return `© ${new Date().getFullYear()} ${input.businessName}`;
  if (key === "items") return [];
  if (key === "plans") return [];
  return "";
};

const fillMissingContentDeterministically = (
  document: SiteDocument,
  input: z.infer<typeof PayloadSchema>,
  seed: number
) => {
  const pages = document.pages.map((page) => ({
    ...page,
    sections: page.sections.map((section, index) => {
      if (section.elements?.length) return section;
      const required = REQUIRED_CONTENT_KEYS[section.type] ?? [];
      if (!required.length) return section;
      const content = { ...(section.content ?? {}) } as Record<string, any>;
      const fallback = fallbackContentForType(section.type, input, seed + index * 0.11) as Record<string, any>;
      required.forEach((key) => {
        if (content[key] !== undefined && content[key] !== null) return;
        if (fallback[key] !== undefined && fallback[key] !== null) {
          content[key] = fallback[key];
          return;
        }
        content[key] = fallbackValueForKey(key, section.type, input);
      });
      return { ...section, content };
    })
  }));

  return { ...document, pages };
};

const buildEmergencyDocument = (
  input: z.infer<typeof PayloadSchema>,
  seed: number,
  rules: NicheRules,
  sectionPolicy: SectionPolicy,
  preset: ReturnType<typeof resolveTemplatePreset>
): SiteDocument => {
  const allowedByTemplate = TEMPLATE_ALLOWED_VARIANTS[preset.templateId] ?? {};
  const supportedTypes = Object.keys(allowedByTemplate).filter(
    (key) =>
      Array.isArray((allowedByTemplate as Record<string, string[] | undefined>)[key]) &&
      ((allowedByTemplate as Record<string, string[] | undefined>)[key]?.length ?? 0) > 0
  ) as SiteSection["type"][];

  const preferredOrder: SiteSection["type"][] = [
    "hero",
    "services",
    "about",
    "gallery",
    "testimonials",
    "cta",
    "faq",
    "reservation",
    "contact",
    "footer"
  ];

  const allowedTypeSet = new Set(sectionPolicy.allowedSectionTypes);
  let sectionTypes = preferredOrder.filter(
    (type) => supportedTypes.includes(type) && allowedTypeSet.has(type)
  );
  if (!sectionTypes.length) {
    sectionTypes = sectionPolicy.allowedSectionTypes.filter((type) => supportedTypes.includes(type)).slice(0, 4);
  }
  if (!sectionTypes.length) {
    sectionTypes = ["hero", "contact", "footer"];
  }

  const sections = sectionTypes.map((type, index) => {
    const sectionSeed = seed + index * 0.13;
    const baseContent = {
      ...(fallbackContentForType(type, input, sectionSeed) as Record<string, any>)
    };
    const required = REQUIRED_CONTENT_KEYS[type] ?? [];
    required.forEach((key) => {
      if (baseContent[key] === undefined || baseContent[key] === null) {
        baseContent[key] = fallbackValueForKey(key, type, input);
      }
    });

    const variant = (allowedByTemplate[type]?.[0] ?? "A") as SiteSection["variant"];
    return {
      id: createId(),
      type,
      variant,
      enabled: true,
      style: buildSectionStyle(type, sectionSeed),
      content: baseContent
    } as SiteSection;
  });

  const normalizedSections = ensureRequiredSections(
    sections,
    input,
    preset.templateId,
    seed,
    sectionPolicy.requiredSectionTypes
  );
  normalizedSections.forEach((section) => ensureImageQueries(section, input));

  const pages = [
    {
      id: createId(),
      name: "Home",
      slug: "home",
      showInMenu: true,
      menuTitle: "Home",
      parentId: null,
      order: 0,
      sections: normalizedSections
    }
  ];

  const doc: SiteDocument = {
    templateId: preset.templateId,
    tone: input.tone,
    theme: buildTheme(resolvePalette(input, null), input.fontFamily ?? undefined, undefined, {
      seed,
      typographyScale: null,
      layoutStyle: null
    }),
    seo: {
      title: `${input.businessName} | ${input.industry}`,
      description: input.description,
      ogImage: null
    },
    pages,
    apps: [],
    siteBrief: {
      businessName: input.businessName,
      industry: input.industry,
      description: input.description,
      tone: input.tone,
      pages: ["Home"],
      theme: {
        primary: input.primaryColor ?? undefined,
        background: input.secondaryColor ?? undefined,
        fontFamily: input.fontFamily ?? undefined
      }
    },
    savedSections: [],
    mediaLibrary: [],
    chat_prompt_topbar_enabled: false,
    chat_prompt_topbar_text: DEFAULT_CHAT_PROMPT_TEXT,
    chat_prompt_topbar_cta: DEFAULT_CHAT_PROMPT_CTA,
    chat_launcher_glow_enabled: false,
    customCode: {
      head: null,
      body: null
    }
  };

  const withPolicy = applySectionPolicyToDocument(doc, input, preset.templateId, seed, sectionPolicy);
  const withNiche = enforceNicheCopyRequirements(withPolicy, input, rules);
  const withLint = applyNicheLint(withNiche, rules);
  return normalizeAnchors(withLint, {
    bookingSelected: sectionPolicy.allowedSectionTypes.includes("reservation"),
    contactSelected: sectionPolicy.allowedSectionTypes.includes("contact")
  });
};

const normalizeSpacing = (value: any): "compact" | "normal" | "airy" => {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "compact") return "compact";
  if (normalized === "normal") return "normal";
  if (normalized === "airy") return "airy";
  if (["large", "spacious", "wide"].includes(normalized)) return "airy";
  if (["tight", "small"].includes(normalized)) return "compact";
  return "normal";
};

const normalizeButtonStyle = (value: any): "solid" | "outline" => {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "solid") return "solid";
  if (normalized === "outline") return "outline";
  if (normalized === "rounded") return "solid";
  if (normalized === "ghost" || normalized === "link") return "outline";
  return "solid";
};

const normalizeAlignment = (value: any): "left" | "center" => {
  const normalized = String(value ?? "").toLowerCase();
  if (normalized === "left") return "left";
  if (normalized === "center") return "center";
  return "left";
};

const normalizeBackground = (
  value: any
):
  | { type: "plain" }
  | { type: "gradient"; value?: string; angle?: number; stops?: { color: string; position: number }[] }
  | { type: "image"; value?: string; overlay?: number; size?: "cover" | "contain"; position?: string; repeat?: "no-repeat" | "repeat" } => {
  if (typeof value === "string") {
    const normalized = value.toLowerCase();
    if (normalized === "plain") return { type: "plain" };
    if (normalized === "gradient") {
      return {
        type: "gradient",
        value: "linear-gradient(135deg, rgba(0,0,0,0.06), rgba(0,0,0,0))"
      };
    }
    if (normalized === "image") return { type: "image", overlay: 0.35 };
    return { type: "plain" };
  }

  if (value && typeof value === "object") {
    const type = String((value as any).type ?? "").toLowerCase();
    if (type === "plain") return { type: "plain" };
    if (type === "gradient") {
      const gradientValue = typeof (value as any).value === "string"
        ? (value as any).value
        : "linear-gradient(135deg, rgba(0,0,0,0.06), rgba(0,0,0,0))";
      const angle = typeof (value as any).angle === "number" ? (value as any).angle : undefined;
      const stopsRaw = Array.isArray((value as any).stops) ? (value as any).stops : undefined;
      const stops = stopsRaw
        ? stopsRaw
            .filter((stop: any) => stop && typeof stop.color === "string")
            .map((stop: any) => ({
              color: String(stop.color),
              position: typeof stop.position === "number" ? stop.position : 0
            }))
        : undefined;
      return { type: "gradient", value: gradientValue, angle, stops };
    }
    if (type === "image") {
      const overlayRaw = (value as any).overlay;
      const overlay =
        typeof overlayRaw === "number"
          ? clamp01(overlayRaw)
          : 0.35;
      const imageValue = typeof (value as any).value === "string" ? (value as any).value : undefined;
      const size = (value as any).size;
      const position = (value as any).position;
      const repeat = (value as any).repeat;
      return {
        type: "image",
        value: imageValue,
        overlay,
        size: size === "cover" || size === "contain" ? size : undefined,
        position: typeof position === "string" ? position : undefined,
        repeat: repeat === "no-repeat" || repeat === "repeat" ? repeat : undefined
      };
    }
  }

  return { type: "plain" };
};

const normalizeAiSectionShape = (section: any): Partial<SiteSection> => {
  const enabled = typeof section?.enabled === "boolean" ? section.enabled : undefined;
  const variant = typeof section?.variant === "string" ? section.variant : undefined;
  const content = section?.content && typeof section.content === "object" ? section.content : {};
  const contentStyles =
    section?.contentStyles && typeof section.contentStyles === "object" ? section.contentStyles : undefined;
  const images = Array.isArray(section?.images)
    ? section.images
        .filter((image: any) => image && typeof image.src === "string" && image.src.length > 0)
        .map((image: any) => ({
          slot: typeof image.slot === "string" ? image.slot : "hero",
          src: image.src,
          alt: typeof image.alt === "string" ? image.alt : undefined,
          credit: image.credit,
          query: typeof image.query === "string" ? image.query : undefined
        }))
    : undefined;
  const style = {
    alignment: normalizeAlignment(section?.style?.alignment),
    spacing: normalizeSpacing(section?.style?.spacing),
    layoutMode: section?.style?.layoutMode,
    background: normalizeBackground(section?.style?.background),
    buttonStyle: normalizeButtonStyle(section?.style?.buttonStyle),
    colorOverride: section?.style?.colorOverride ?? null
  };

  return {
    enabled,
    variant,
    content,
    style,
    contentStyles,
    images
  };
};

const IMAGE_SLOT_CONFIG: Partial<Record<SiteSection["type"], { slots: string[] }>> = {
  hero: { slots: ["hero"] },
  about: { slots: ["about"] },
  cta: { slots: ["cta"] },
  gallery: { slots: ["gallery-1", "gallery-2", "gallery-3", "gallery-4", "gallery-5", "gallery-6"] }
};

const buildPexelsQuery = (
  section: SiteSection,
  input: z.infer<typeof PayloadSchema>,
  designDna: DesignDna | null,
  slotIndex: number
) => {
  const content = section.content as Record<string, any>;
  const queries = Array.isArray(content.imageQueries)
    ? content.imageQueries.filter((item: unknown) => typeof item === "string" && item.trim().length > 0)
    : [];
  const sectionHint =
    section.type === "hero"
      ? "hero business interior exterior"
      : section.type === "about"
        ? "team workplace people"
        : section.type === "cta"
          ? "detail close-up brand atmosphere"
          : "gallery lifestyle professional photo";
  const styleHint = designDna?.imageryStyle
    ? String(designDna.imageryStyle).split(",")[0]?.trim()
    : "";

  const base = queries[slotIndex] ?? queries[0] ?? `${input.businessName} ${input.industry} ${section.type}`;
  return [base, sectionHint, styleHint].filter(Boolean).join(" ").replace(/\s+/g, " ").trim();
};

const searchPexelsCached = async (
  cache: Map<string, Promise<NormalizedImage[]>>,
  rawQuery: string
) => {
  const query = rawQuery.trim();
  if (!query) return [] as NormalizedImage[];
  if (!cache.has(query)) {
    cache.set(
      query,
      searchPexels(query, 12).catch((error) => {
        console.warn("[GEN] pexels search failed", query, error);
        return [] as NormalizedImage[];
      })
    );
  }
  return (await cache.get(query)) ?? [];
};

const pickUniquePexelsImage = (images: NormalizedImage[], usedImageUrls: Set<string>) => {
  if (!images.length) return null;
  const unique = images.find((image) => !usedImageUrls.has(image.url));
  return unique ?? images[0];
};

const runWithConcurrency = async <T, R>(
  items: T[],
  limit: number,
  worker: (item: T) => Promise<R>
) => {
  const results: R[] = [];
  let index = 0;

  const runners = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (index < items.length) {
      const currentIndex = index;
      index += 1;
      const result = await worker(items[currentIndex]);
      results[currentIndex] = result;
    }
  });

  await Promise.all(runners);
  return results;
};

const applyAiImages = async (
  document: SiteDocument,
  input: z.infer<typeof PayloadSchema>,
  designDna: DesignDna | null,
  _variationSeed: string,
  _openai: any,
  sectionPolicy: SectionPolicy
) => {
  if (input.hasOwnPhotos) return document;
  const pexelsEnabled = Boolean(process.env.PEXELS_API_KEY);
  if (!pexelsEnabled) {
    console.warn("[GEN] PEXELS_API_KEY missing; skipping stock image auto-fill");
  }

  const mediaLibrary = [...(document.mediaLibrary ?? [])];
  const queryCache = new Map<string, Promise<NormalizedImage[]>>();
  const usedImageUrls = new Set<string>();
  const jobs: Array<{
    sectionId: string;
    sectionType: SiteSection["type"];
    slot: string;
    query: string;
    fallbackQuery: string;
  }> = [];

  for (const page of document.pages) {
    for (const section of page.sections) {
      if (!section.enabled) continue;
      const config = IMAGE_SLOT_CONFIG[section.type];
      if (!config) continue;
      if (Array.isArray(section.images) && section.images.length > 0) continue;
      for (let index = 0; index < config.slots.length; index += 1) {
        const slot = config.slots[index];
        const query = buildPexelsQuery(section, input, designDna, index);
        const fallbackQuery = `${input.industry} ${section.type} professional photography`;
        jobs.push({
          sectionId: section.id,
          sectionType: section.type,
          slot,
          query,
          fallbackQuery
        });
      }
    }
  }

  const results = pexelsEnabled
    ? await runWithConcurrency(jobs, 4, async (job) => {
        for (const query of [job.query, job.fallbackQuery]) {
          const images = await searchPexelsCached(queryCache, query);
          const picked = pickUniquePexelsImage(images, usedImageUrls);
          if (!picked) continue;
          usedImageUrls.add(picked.url);
          return { ...job, image: picked, queryUsed: query };
        }
        return { ...job, image: null as NormalizedImage | null, queryUsed: job.query };
      })
    : jobs.map((job) => ({ ...job, image: null as NormalizedImage | null, queryUsed: job.query }));

  const imagesBySection = new Map<string, SiteImage[]>();
  results.forEach((result) => {
    if (!result?.image) return;
    const image: SiteImage = {
      slot: result.slot,
      src: result.image.url,
      alt: result.image.alt || `${input.businessName} ${result.sectionType} image`,
      credit: {
        provider: "pexels",
        photographer: result.image.photographer,
        sourceUrl: result.image.sourceUrl
      },
      query: result.queryUsed
    };
    const list = imagesBySection.get(result.sectionId) ?? [];
    list.push(image);
    imagesBySection.set(result.sectionId, list);
    if (!mediaLibrary.some((item) => item.src === image.src)) {
      mediaLibrary.push(image);
    }
  });

  const fallbackGradient = {
    type: "gradient" as const,
    angle: 135,
    stops: [
      { color: document.theme.surface, position: 0 },
      { color: document.theme.bg, position: 100 }
    ]
  };

  const pages = document.pages.map((page) => ({
    ...page,
    sections: page.sections.map((section) => {
      const generatedImages = imagesBySection.get(section.id);
      const generatedSlots = new Set((generatedImages ?? []).map((image) => image.slot));
      let mergedImages = generatedImages?.length
        ? [
            ...(section.images ?? []).filter((image) => !generatedSlots.has(image.slot)),
            ...generatedImages
          ]
        : section.images;

      const content = section.content as Record<string, any>;
      const imageQueries = Array.isArray(content?.imageQueries)
        ? content.imageQueries.filter((value: unknown) => typeof value === "string" && value.trim().length > 0)
        : [];
      if (imageQueries.length > 0 && (!mergedImages || mergedImages.length === 0)) {
        const fallbacks = SECTION_FALLBACK_IMAGES[section.type];
        if (fallbacks?.length) {
          mergedImages = fallbacks.map((fallback, index) => ({
            slot: fallback.slot,
            src: fallback.src,
            alt: fallback.alt,
            credit: { provider: "pexels" as const },
            query: imageQueries[index] ?? imageQueries[0]
          }));
          mergedImages.forEach((image) => {
            if (!mediaLibrary.some((item) => item.src === image.src)) {
              mediaLibrary.push(image);
            }
          });
        }
      }

      const gallerySelected = sectionPolicy.allowedSectionTypes.includes("gallery");
      const targetMinImages =
        section.type === "hero" && imageQueries.length > 0
          ? 1
          : section.type === "gallery" && gallerySelected
            ? 6
            : 0;

      if (targetMinImages > 0 && (mergedImages?.length ?? 0) < targetMinImages) {
        const fallbackSet = SECTION_FALLBACK_IMAGES[section.type] ?? [];
        if (fallbackSet.length) {
          const seededImages = [...(mergedImages ?? [])];
          let cursor = 0;
          while (seededImages.length < targetMinImages) {
            const fallback = fallbackSet[cursor % fallbackSet.length];
            seededImages.push({
              slot: fallback.slot,
              src: fallback.src,
              alt: fallback.alt,
              credit: { provider: "pexels" },
              query: imageQueries[cursor] ?? imageQueries[0]
            });
            cursor += 1;
          }
          mergedImages = seededImages;
        }
      }

      if (mergedImages?.length) {
        return { ...section, images: mergedImages };
      }

      if (section.type === "hero" && section.variant === "B") {
        return {
          ...section,
          variant: "A",
          style: {
            ...section.style,
            background: fallbackGradient
          }
        };
      }

      if (section.style.background.type === "image") {
        return {
          ...section,
          style: {
            ...section.style,
            background: fallbackGradient
          }
        };
      }

      return section;
    })
  }));

  return { ...document, pages, mediaLibrary };
};

async function runCompletionWithTimeout(
  openai: any,
  message: string,
  timeoutMs: number,
  temperature = 0.45
): Promise<string> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const completion = await openai.chat.completions.create(
      {
        model: "gpt-4o-mini",
        temperature,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Return JSON only. No markdown." },
          { role: "user", content: message }
        ]
      },
      { signal: controller.signal } as any
    );

    return completion.choices[0]?.message?.content ?? "";
  } catch (err: any) {
    const messageText = String(err?.message ?? "").toLowerCase();
    const isAbort =
      err?.name === "AbortError" ||
      messageText.includes("aborted") ||
      messageText.includes("abort");
    if (isAbort) {
      const e = new Error("OPENAI_TIMEOUT_ABORT");
      (e as any).cause = err;
      throw e;
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

export async function POST(request: Request) {
  const startedAt = Date.now();
  const serializeIssuePath = (path: PropertyKey[]) =>
    path.map((part) => (typeof part === "symbol" ? part.toString() : part));
  let lastValidationIssues: Array<{ path: Array<string | number>; message: string }> | null = null;

  try {
    console.log("[GEN] start", new Date().toISOString());

    const supabase = getSupabaseRouteClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return NextResponse.json({ error: "Unauthorized", phase: "auth" }, { status: 401 });
    }

    const payload = await request.json().catch(() => null);
    const parsed = PayloadSchema.safeParse(payload);
    if (!parsed.success) {
      console.log("[GEN] payload invalid", parsed.error.flatten());
      return NextResponse.json(
        { error: "Invalid payload", phase: "payload-parse", details: parsed.error.flatten() },
        { status: 400 }
      );
    }

    const parsedInput = {
      ...parsed.data,
      templateId: resolveTemplateId(parsed.data.templateId, parsed.data.industry)
    };
    const featureFlags = resolveFeatureFlags(parsedInput);
    const sectionPolicy = computeSectionPolicyFromFeatureFlags(featureFlags);
    const nicheRules = getNicheRules(parsedInput.industry, parsedInput.templateId);
    const templatePreset = resolveTemplatePreset({
      nicheKey: nicheRules.key,
      requestedTemplateId: parsedInput.templateId,
      allowedSectionTypes: sectionPolicy.allowedSectionTypes,
      requiredSectionTypes: sectionPolicy.requiredSectionTypes
    });
    const input = {
      ...parsedInput,
      templateId: templatePreset.templateId
    };

    console.log("[GEN] env", {
      hasOpenAI: Boolean(process.env.OPENAI_API_KEY)
    });

    const { data: site, error: siteErr } = await (supabase as any)
      .from("builder_sites")
      .select("id,business_id")
      .eq("id", input.siteId)
      .eq("business_id", input.businessId)
      .maybeSingle();

    if (siteErr) {
      console.error("[GEN] site lookup error", siteErr);
      return NextResponse.json(
        {
          error: "Site lookup failed",
          phase: "site-lookup",
          message: siteErr.message,
          code: siteErr.code
        },
        { status: 500 }
      );
    }

    if (!site) {
      return NextResponse.json({ error: "Site not found", phase: "site-lookup" }, { status: 404 });
    }

    const openai = getOpenAIClient();
    const hasOpenAI = Boolean(openai);
    let aiAttempted = hasOpenAI;
    let aiSucceeded = false;
    let fallbackUsed = false;
    const variationSeed = `${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const seedNumber = seedFromString(variationSeed);
    let document: SiteDocument | null = null;
    let designDna: DesignDna | null = null;
    let layoutPlan: LayoutPlan | null = null;

    const OPENAI_TIMEOUT_MS = 90000;

    const parseDesignDna = (raw: string) => {
      const parsed = safeJsonParse(raw);
      if (!parsed) return null;
      const validated = DesignDnaSchema.safeParse(parsed);
      if (!validated.success) return null;
      return validated.data;
    };

    const parseLayoutPlan = (raw: string) => {
      const parsed = safeJsonParse(raw);
      if (!parsed) return null;
      const validated = LayoutPlanSchema.safeParse(parsed);
      if (!validated.success) return null;
      return validated.data;
    };

    const scoreLayoutPlan = (plan: LayoutPlan | null) => {
      if (!plan) return -Infinity;
      const variantList = Object.values(plan.variants ?? {});
      const nonA = variantList.filter((variant) => variant && variant !== "A").length;
      const spacingVariety = new Set(Object.values(plan.spacing ?? {})).size;
      const alignmentVariety = new Set(Object.values(plan.alignment ?? {})).size;
      const orderVariety = new Set(plan.sectionOrder ?? []).size;
      return nonA * 3 + spacingVariety * 2 + alignmentVariety + orderVariety;
    };

    const runOpenAiJson = async (
      message: string,
      label: string,
      temperature = 0.6
    ): Promise<string> => {
      if (!openai) {
        throw new Error("OPENAI_UNAVAILABLE");
      }
      console.log(`[GEN] ${label} call 1`);
      try {
        return await runCompletionWithTimeout(openai, message, OPENAI_TIMEOUT_MS, temperature);
      } catch (err: any) {
        if (err?.message === "OPENAI_TIMEOUT_ABORT") {
          console.warn("[GEN] OpenAI aborted (timeout)", { timeoutMs: OPENAI_TIMEOUT_MS });
          console.warn(`[GEN] ${label} call 1 aborted; retrying once`);
          try {
            return await runCompletionWithTimeout(openai, message, OPENAI_TIMEOUT_MS, temperature);
          } catch (retryErr: any) {
            if (retryErr?.message === "OPENAI_TIMEOUT_ABORT") {
              console.warn("[GEN] OpenAI aborted (timeout)", { timeoutMs: OPENAI_TIMEOUT_MS });
              console.error(`[GEN] ${label} call retry aborted`);
              throw retryErr;
            }
            console.error("[GEN] openai failed", retryErr);
            throw retryErr;
          }
        }
        console.error("[GEN] openai failed", err);
        throw err;
      }
    };

    const designPrompt = buildDesignDnaPrompt(input, nicheRules, templatePreset, variationSeed);
    try {
      const rawDna = await runOpenAiJson(designPrompt, "design-dna", 0.9);
      designDna = parseDesignDna(rawDna);
      if (!designDna) {
        const repair = [
          "The previous output was invalid JSON. Regenerate a valid design DNA object.",
          designPrompt
        ].join("\n");
        const repaired = await runOpenAiJson(repair, "design-dna-fix", 0.9);
        designDna = parseDesignDna(repaired);
      }
    } catch (err) {
      console.error("[GEN] design DNA failed", err);
    }

    if (!designDna) {
      console.warn("[GEN] design DNA fallback activated");
      designDna = buildFallbackDesignDna(input, templatePreset.templateId, variationSeed);
      fallbackUsed = true;
    }

    designDna = { ...designDna, variationSeed };
    const layoutPrompt = buildLayoutPlanPrompt(
      input,
      nicheRules,
      templatePreset,
      sectionPolicy,
      designDna,
      variationSeed
    );
    try {
      const rawLayout = await runOpenAiJson(layoutPrompt, "layout-plan", 0.85);
      layoutPlan = parseLayoutPlan(rawLayout);
      if (!layoutPlan) {
        const repair = [
          "The previous output was invalid. Regenerate a valid layout plan JSON only.",
          layoutPrompt
        ].join("\n");
        const repaired = await runOpenAiJson(repair, "layout-plan-fix", 0.85);
        layoutPlan = parseLayoutPlan(repaired);
      }
    } catch (err) {
      console.warn("[GEN] layout plan failed", err);
    }
    try {
      const altPrompt = buildLayoutPlanPrompt(
        input,
        nicheRules,
        templatePreset,
        sectionPolicy,
        designDna,
        `${variationSeed}-alt`
      );
      const rawAlt = await runOpenAiJson(altPrompt, "layout-plan-alt", 0.9);
      const altPlan = parseLayoutPlan(rawAlt);
      if (scoreLayoutPlan(altPlan) > scoreLayoutPlan(layoutPlan)) {
        layoutPlan = altPlan;
      }
    } catch (err) {
      console.warn("[GEN] layout plan alt failed", err);
    }
    if (!layoutPlan) {
      layoutPlan = buildFallbackLayoutPlan(templatePreset, sectionPolicy);
      fallbackUsed = true;
    }
    layoutPlan = {
      ...layoutPlan,
      templateId:
        layoutPlan.templateId && templatePreset.allowedTemplateIds.includes(layoutPlan.templateId)
          ? layoutPlan.templateId
          : templatePreset.templateId,
      variantBias: {
        ...templatePreset.variantBias,
        ...(layoutPlan.variantBias ?? {})
      },
      sectionOrder: templatePreset.sectionOrder
    };
    const palette = resolvePalette(input, designDna);
    const prompt = buildPrompt(
      input,
      variationSeed,
      designDna,
      layoutPlan,
      featureFlags,
      nicheRules,
      sectionPolicy,
      templatePreset
    );

    const tryParse = (
      raw: string,
      designDna: DesignDna | null,
      palette: { primary: string; secondary: string; background: string; accent: string }
    ) => {
      const pages = parseAiPages(raw);
      if (!pages) return null;

      const normalizedPages = (Array.isArray(pages) ? pages : []).map((page: any, index: number) => ({
        id: page.id ?? createId(),
        name: page.name ?? "Home",
        slug: page.slug ?? "home",
        showInMenu: page.showInMenu ?? true,
        menuTitle: page.menuTitle ?? page.name ?? "Home",
        parentId: page.parentId ?? null,
        order: typeof page.order === "number" ? page.order : index,
        sections: Array.isArray(page.sections) ? page.sections : []
      }));

      if (!normalizedPages.length) {
        normalizedPages.push({
          id: createId(),
          name: "Home",
          slug: "home",
          showInMenu: true,
          menuTitle: "Home",
          parentId: null,
          order: 0,
          sections: []
        });
      }

      const planSections = buildSectionPlan(templatePreset.templateId, input, seedNumber, {
        useFallbackContent: false,
        sectionOrder: templatePreset.sectionOrder,
        variantBias: {
          ...(templatePreset.variantBias as Record<string, string>),
          ...(layoutPlan?.variantBias ?? {}),
          ...(layoutPlan?.variants ?? {}),
          ...(designDna?.variantBias ?? {})
        },
        spacingOverrides: layoutPlan?.spacing ?? undefined,
        alignmentOverrides: layoutPlan?.alignment ?? undefined,
        layoutStyle: designDna?.layoutStyle ?? undefined,
        allowedSectionTypes: sectionPolicy.allowedSectionTypes,
        requiredSectionTypes: sectionPolicy.requiredSectionTypes
      }).map((preset) => ({
        ...preset,
        id: createId()
      })) as SiteSection[];

      const orderedTypes = planSections.map((section) => section.type);
      const aiSectionsRaw = normalizedPages[0]?.sections ?? [];
      const aiSections = aiSectionsRaw
        .filter((section: any) => section && typeof section === "object" && typeof section.type === "string")
        .map((section: any) => ({
          ...section,
          ...normalizeAiSectionShape(section)
        }));

      const aiVariantDiversity = aiSections.some((section: any) => {
        const variant = typeof section?.variant === "string" ? section.variant : null;
        return variant && variant !== "A";
      });

      const mergedSections = planSections.map((preset) => {
        const match = aiSections.find((section: any) => section.type === preset.type);
        return mergeAiSection(preset, match, input.templateId, aiVariantDiversity);
      });

      const diversifiedSections = enforceVariantDiversity(mergedSections, templatePreset.templateId, seedNumber);
      diversifiedSections.forEach((section) => ensureImageQueries(section, input));

      const sortedSections = diversifiedSections.sort((a, b) => {
        return orderedTypes.indexOf(a.type) - orderedTypes.indexOf(b.type);
      });

      const anchoredSections = ensureRequiredSections(
        sortedSections,
        input,
        templatePreset.templateId,
        seedNumber,
        sectionPolicy.requiredSectionTypes
      );

      const finalPages = [
        {
          id: normalizedPages[0]?.id ?? createId(),
          name: normalizedPages[0]?.name ?? "Home",
          slug: normalizedPages[0]?.slug ?? "home",
          showInMenu: true,
          menuTitle: normalizedPages[0]?.menuTitle ?? normalizedPages[0]?.name ?? "Home",
          parentId: null,
          order: 0,
          sections: anchoredSections
        }
      ];

      const baseDocument: SiteDocument = {
        templateId: templatePreset.templateId,
        tone: input.tone,
        theme: buildTheme(palette, input.fontFamily ?? undefined, designDna?.fontPair, {
          seed: seedNumber,
          typographyScale: layoutPlan?.typographyScale ?? null,
          layoutStyle: designDna?.layoutStyle ?? null
        }),
        seo: {
          title: `${input.businessName} | ${input.industry}`,
          description: input.description,
          ogImage: null
        },
        pages: finalPages,
        apps: [],
        siteBrief: {
          businessName: input.businessName,
          industry: input.industry,
          description: input.description,
          tone: input.tone,
          pages: finalPages.map((page) => page.name),
          theme: {
            primary: palette.primary,
            background: palette.background,
            fontFamily: input.fontFamily ?? designDna?.fontPair?.body ?? undefined
          },
          designDNA: {
            variationSeed,
            layoutStyle: designDna?.layoutStyle,
            palette: designDna?.palette,
            fontPair: designDna?.fontPair,
            variantBias: designDna?.variantBias,
            sectionOrder: designDna?.sectionOrder,
            imageryStyle: designDna?.imageryStyle
          }
        },
        savedSections: [],
        mediaLibrary: [],
        chat_prompt_topbar_enabled: false,
        chat_prompt_topbar_text: DEFAULT_CHAT_PROMPT_TEXT,
        chat_prompt_topbar_cta: DEFAULT_CHAT_PROMPT_CTA,
        chat_launcher_glow_enabled: false,
        customCode: {
          head: null,
          body: null
        }
      };

      const withRules = applyGenerationRules(
        baseDocument,
        input,
        nicheRules,
        sectionPolicy,
        templatePreset.templateId,
        seedNumber
      );
      const validated = SiteDocumentSchema.safeParse(withRules);
      if (!validated.success) {
        lastValidationIssues = validated.error.issues.map((issue) => ({
          path: serializeIssuePath(issue.path),
          message: issue.message
        }));
        const onlyMissingContent = validated.error.issues.every(
          (issue) =>
            issue.path.includes("content") &&
            typeof issue.message === "string" &&
            issue.message.startsWith("Missing ")
        );
        if (onlyMissingContent) {
          return withRules;
        }
        return null;
      }
      return validated.data;
    };

    let raw = "";
    try {
      raw = await runOpenAiJson(prompt, "openai", 0.7);
    } catch (err: any) {
      console.error("[GEN] OpenAI generation failed", err);
      fallbackUsed = true;
    }

    document = tryParse(raw, designDna, palette);
    if (document) {
      aiSucceeded = true;
    }

    if (!document) {
      const fixPrompt = [
        "The previous output was invalid (wrong enum values or truncated). Regenerate from scratch.",
        "Return JSON only. No markdown.",
        "STYLE ENUMS (MUST FOLLOW EXACTLY):",
        'alignment: "left" | "center"',
        'spacing: "compact" | "normal" | "airy"',
        'background: {"type":"plain"} OR {"type":"gradient","angle":0-360,"stops":[{"color":"#hex","position":0-100}]} OR {"type":"image","value":"<url?>","overlay":0.0-1.0,"size":"cover|contain","position":"center|top|bottom|left|right","repeat":"no-repeat|repeat"}',
        'buttonStyle: "solid" | "outline"',
        "FORBIDDEN:",
        '- spacing values like "large"',
        '- background as a string like "image"',
        '- buttonStyle like "rounded"',
        "Minimal JSON example:",
        "{",
        '  "pages":[',
        "    {",
        '      "id":"...",',
        '      "name":"Home",',
        '      "slug":"home",',
        '      "sections":[',
        "        {",
        '          "id":"...",',
        '          "type":"hero",',
        '          "variant":"A",',
        '          "enabled":true,',
        '          "style":{',
        '            "alignment":"left",',
        '            "spacing":"normal",',
        '            "background":{"type":"plain"},',
        '            "buttonStyle":"solid",',
        '            "colorOverride":null',
        "          },",
        '          "content":{',
        '            "headline":"...",',
        '            "subheadline":"...",',
        '            "ctaLabel":"...",',
        '            "ctaHref":"#contact",',
        '            "imageQueries":["..."]',
        "          }",
        "        }",
        "      ]",
        "    }",
        "  ]",
        "}",
        `templateId: ${input.templateId}`,
        `allowedTemplateIds: ${JSON.stringify(templatePreset.allowedTemplateIds)}`,
        `nicheKey: ${nicheRules.key}`,
        `forbiddenTopics: ${JSON.stringify(nicheRules.forbiddenTopics)}`,
        `requiredTopics: ${JSON.stringify(nicheRules.requiredTerms)}`,
        `tone: ${input.tone}`,
        `designLayoutStyle: ${designDna?.layoutStyle ?? ""}`,
        `designPalette: ${JSON.stringify(designDna?.palette ?? {})}`,
        `designFonts: ${JSON.stringify(designDna?.fontPair ?? {})}`,
        `sectionOrder: ${JSON.stringify(designDna?.sectionOrder ?? [])}`,
        `businessName: ${input.businessName}`,
        `industry: ${input.industry}`,
        `description: ${input.description}`,
        `sectionsOrder: ${JSON.stringify(templatePreset.sectionOrder)}`,
        `allowedVariants: ${JSON.stringify(TEMPLATE_ALLOWED_VARIANTS[templatePreset.templateId] ?? {})}`,
        "Output shape:",
        "{ pages: [{ id, name, slug, sections: [{ id, type, variant, enabled, style, content }] }] }"
      ].join("\n");

      try {
        const repaired = await runOpenAiJson(fixPrompt, "openai-fix", 0.6);
        document = tryParse(repaired, designDna, palette);
        if (document) {
          aiSucceeded = true;
        }
      } catch (err: any) {
        console.warn("[GEN] OpenAI fix failed", err);
      }
    }

    if (!document) {
      console.error("[GEN] invalid after repair; using fallback", lastValidationIssues);
      document = buildAnyValidFallbackDocument(
        input,
        seedNumber,
        nicheRules,
        sectionPolicy,
        templatePreset
      );
      fallbackUsed = true;
    }

    if (!document) {
      document = buildEmergencyDocument(
        input,
        seedNumber + 0.31,
        getNicheRules("generic", templatePreset.templateId),
        sectionPolicy,
        templatePreset
      );
      fallbackUsed = true;
    }

    document = applyGenerationRules(
      document,
      input,
      nicheRules,
      sectionPolicy,
      templatePreset.templateId,
      seedNumber
    );

    const bannedHits = findBannedPhraseHits(document, nicheRules);
    if (bannedHits.length) {
      const rewritePrompt = [
        "Rewrite only the offending strings in the SiteDocument JSON.",
        "Keep keys, structure, IDs, variants, and section order exactly the same.",
        "Return JSON only. No markdown.",
        `Banned phrases: ${JSON.stringify(nicheRules.bannedPhrases)}`,
        `Offending strings: ${JSON.stringify(
          bannedHits.slice(0, 24).map((hit) => ({
            sectionId: hit.sectionId,
            sectionType: hit.sectionType,
            phrase: hit.phrase,
            value: hit.value
          }))
        )}`,
        "Current JSON:",
        JSON.stringify({ pages: document.pages })
      ].join("\n");

      try {
        const rewrittenRaw = await runOpenAiJson(rewritePrompt, "openai-banned-rewrite", 0.35);
        const rewritten = tryParse(rewrittenRaw, designDna, palette);
        if (rewritten) {
          document = rewritten;
          aiSucceeded = true;
        }
      } catch (err) {
        console.warn("[GEN] OpenAI banned phrase rewrite failed", err);
      }

      const afterRewriteHits = findBannedPhraseHits(document, nicheRules);
      if (afterRewriteHits.length) {
        document = sanitizeBannedCopyDeterministically(document, nicheRules);
        fallbackUsed = true;
      }
    }

    document = applyGenerationRules(
      document,
      input,
      nicheRules,
      sectionPolicy,
      templatePreset.templateId,
      seedNumber + 0.21
    );

    const missing = findMissingContent(document);
    if (missing.length) {
      const repairPrompt = [
        "You are repairing a SiteDocument JSON. Fill the missing required content keys only.",
        "Do not remove or change existing content unless required to add the missing keys.",
        "Return JSON only. No markdown.",
        `Missing fields: ${JSON.stringify(missing)}`,
        "Required keys by section:",
        JSON.stringify(REQUIRED_CONTENT_KEYS),
        "Current JSON:",
        JSON.stringify({ pages: document.pages })
      ].join("\n");

      try {
        const repaired = await runOpenAiJson(repairPrompt, "openai-repair", 0.4);
        const repairedDoc = tryParse(repaired, designDna, palette);
        if (repairedDoc) {
          document = repairedDoc;
          aiSucceeded = true;
        }
      } catch (err) {
        console.warn("[GEN] OpenAI repair failed", err);
      }
    }

    const remainingMissing = findMissingContent(document);
    if (remainingMissing.length) {
      const patchPrompt = [
        "Return JSON only with this shape:",
        '{ "patches": [ { "sectionId": "...", "content": { "key": "value" } } ] }',
        "Fill only the missing required keys. Do not alter existing content.",
        `Missing: ${JSON.stringify(remainingMissing)}`,
        "Required keys by section:",
        JSON.stringify(REQUIRED_CONTENT_KEYS),
        "Current sections (id, type, content):",
        JSON.stringify(
          document.pages.flatMap((page) =>
            page.sections.map((section) => ({
              id: section.id,
              type: section.type,
              content: section.content
            }))
          )
        )
      ].join("\n");

      try {
        const patchedRaw = await runOpenAiJson(patchPrompt, "openai-patch", 0.3);
        const parsedPatch = safeJsonParse(patchedRaw);
        let patches: Array<{ sectionId: string; content: Record<string, any> }> = [];
        if (Array.isArray(parsedPatch?.patches)) {
          patches = parsedPatch.patches;
        } else if (parsedPatch?.patches && typeof parsedPatch.patches === "object") {
          patches = Object.entries(parsedPatch.patches).map(([sectionId, content]) => ({
            sectionId,
            content: content as Record<string, any>
          }));
        }
        if (patches.length) {
          document = applyContentPatches(document, patches);
          aiSucceeded = true;
        }
      } catch (err) {
        console.warn("[GEN] OpenAI patch failed", err);
      }
    }

    if (findMissingContent(document).length) {
      document = fillMissingContentDeterministically(document, input, seedNumber);
      fallbackUsed = true;
    }

    if (findMissingContent(document).length) {
      const fallbackDocument = buildAnyValidFallbackDocument(
        input,
        seedNumber,
        nicheRules,
        sectionPolicy,
        templatePreset
      );
      if (fallbackDocument) {
        document = fallbackDocument;
        fallbackUsed = true;
      }
    }

    const baseSections = document.pages[0]?.sections ?? [];
    const requiredSections = ensureRequiredSections(
      baseSections,
      input,
      templatePreset.templateId,
      seedNumber,
      sectionPolicy.requiredSectionTypes
    );
    const styledSections = applyVisualDepth(
      requiredSections,
      palette,
      seedNumber,
      layoutPlan?.typographyScale ?? designDna?.layoutStyle ?? null,
      layoutPlan?.emphasis ?? null
    );
    const nextPages =
      input.pagesMode === "multi"
        ? buildMultiPageStructure(styledSections)
        : [
            {
              id: document.pages[0]?.id ?? createId(),
              name: document.pages[0]?.name ?? "Home",
              slug: document.pages[0]?.slug ?? "home",
              showInMenu: true,
              menuTitle: document.pages[0]?.menuTitle ?? document.pages[0]?.name ?? "Home",
              parentId: null,
              order: 0,
              sections: styledSections
            }
          ];

    let withFeatures: SiteDocument = {
      ...document,
      pages: nextPages,
      siteBrief: document.siteBrief
        ? { ...document.siteBrief, pages: nextPages.map((page) => page.name) }
        : document.siteBrief
    };
    withFeatures = applyGenerationRules(
      withFeatures,
      input,
      nicheRules,
      sectionPolicy,
      templatePreset.templateId,
      seedNumber + 0.43
    );

    let withImages = withFeatures;
    let imageError: string | null = null;
    try {
      withImages = await applyAiImages(withFeatures, input, designDna, variationSeed, openai, sectionPolicy);
    } catch (err: any) {
      console.error("[GEN] image generation failed", err);
      imageError = err?.message ?? "AI image generation failed";
      withImages = withFeatures;
      fallbackUsed = true;
    }
    withImages = applyGenerationRules(
      withImages,
      input,
      nicheRules,
      sectionPolicy,
      templatePreset.templateId,
      seedNumber + 0.57
    );

    const imageStats = countImageStats(withImages);
    if (process.env.NODE_ENV !== "production") {
      const featureSummary =
        sectionPolicy.selectedFeatureKeys.length > 0
          ? sectionPolicy.selectedFeatureKeys.join(",")
          : "none";
      console.log(
        `[builder.generate] niche=${nicheRules.key} features=${featureSummary} queries=${imageStats.totalImageQueries} images=${imageStats.totalImages}`
      );
    }

    let finalValidation = SiteDocumentSchema.safeParse(withImages);
    if (!finalValidation.success) {
      console.error("[GEN] final validation failed", finalValidation.error.issues);
      const fallbackDocument = buildAnyValidFallbackDocument(
        input,
        seedNumber,
        nicheRules,
        sectionPolicy,
        templatePreset
      );
      if (fallbackDocument) {
        try {
          withImages = await applyAiImages(
            fallbackDocument,
            input,
            designDna,
            variationSeed,
            openai,
            sectionPolicy
          );
        } catch {
          withImages = fallbackDocument;
        }
        withImages = applyGenerationRules(
          withImages,
          input,
          nicheRules,
          sectionPolicy,
          templatePreset.templateId,
          seedNumber + 0.73
        );
        finalValidation = SiteDocumentSchema.safeParse(withImages);
        fallbackUsed = true;
      }
    }

    if (!finalValidation.success) {
      const emergencyRules = getNicheRules("generic", templatePreset.templateId);
      const emergencyPreset = resolveTemplatePreset({
        nicheKey: emergencyRules.key,
        requestedTemplateId: templatePreset.templateId,
        allowedSectionTypes: sectionPolicy.allowedSectionTypes,
        requiredSectionTypes: sectionPolicy.requiredSectionTypes
      });
      const emergencyDocument = buildEmergencyDocument(
        input,
        seedNumber + 0.67,
        emergencyRules,
        sectionPolicy,
        emergencyPreset
      );
      const emergencyValidation = SiteDocumentSchema.safeParse(emergencyDocument);
      if (emergencyValidation.success) {
        withImages = emergencyValidation.data;
        finalValidation = emergencyValidation;
        fallbackUsed = true;
      } else {
        console.error("[GEN] emergency validation failed; returning deterministic emergency document");
        withImages = emergencyDocument;
        fallbackUsed = true;
      }
    }

    const socialsSafe = input.socials ?? {}; // NEVER null
    const finalDocument = finalValidation.success ? finalValidation.data : withImages;

    console.log("[GEN] saving site_document to DB");
    const { error: updateError } = await (supabase as any)
      .from("builder_sites")
      .update({
        business_name: input.businessName,
        industry: input.industry,
        description: input.description,
        primary_color: palette.primary ?? null,
        secondary_color: palette.background ?? null,
        font_family: input.fontFamily ?? designDna?.fontPair?.body ?? null,
        logo_url: input.logoUrl ?? null,
        contact_email: input.contact?.email ?? null,
        contact_phone: input.contact?.phone ?? null,
        contact_address: input.contact?.address ?? null,
        template_id: input.templateId,
        tone: input.tone,
        pages_mode: input.pagesMode,
        has_own_photos: Boolean(input.hasOwnPhotos),
        opening_hours: input.openingHours ?? null,
        socials: socialsSafe,
        include_services: featureFlags.includeServices,
        include_testimonials: featureFlags.includeTestimonials,
        include_pricing: featureFlags.includePricing,
        include_faq: featureFlags.includeFaq,
        include_contact: featureFlags.includeContact,
        include_reservation: featureFlags.includeReservation,
        include_gallery: featureFlags.includeGallery,
        site_document: finalDocument,
        // ONLY keep this if the column exists in DB; otherwise DELETE THIS LINE:
        template_key: selectTemplateKey(input.industry, input.templateId)
      })
      .eq("id", input.siteId);

    if (updateError) {
      console.error("[BUILDER_GENERATE_UPDATE_ERROR]", updateError);
      return NextResponse.json(
        {
          error: "Failed to update site",
          phase: "db-update",
          message: updateError.message,
          code: updateError.code
        },
        { status: 500 }
      );
    }

    console.log("[GEN] done", { ms: Date.now() - startedAt });
    const meta = {
      templateId: input.templateId,
      allowedSectionTypes: sectionPolicy.allowedSectionTypes,
      requiredSectionTypes: sectionPolicy.requiredSectionTypes,
      selectedFeatures: sectionPolicy.selectedFeatureKeys,
      hasOpenAI,
      aiAttempted,
      aiSucceeded,
      fallbackUsed,
      variationSeed,
      designDna,
      layoutPlan,
      imageError
    };
    return NextResponse.json({ siteDocument: finalDocument, meta });
  } catch (err: any) {
    console.error("[GEN] FAILED", {
      ms: Date.now() - startedAt,
      message: err?.message ?? String(err),
      stack: err?.stack ?? null
    });
    return NextResponse.json(
      { error: "Generate route failed", phase: "unknown", message: err?.message ?? String(err) },
      { status: 500 }
    );
  }
}

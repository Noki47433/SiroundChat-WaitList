import type { TokenSetId } from "@/lib/builder/design/tokens";
import type { SectionType } from "@/lib/builder/generation/schemas/sections";

export type TemplateDefinition = {
  templateId: string;
  allowedNiches: string[];
  defaultSectionOrder: SectionType[];
  allowedVariants: {
    hero: Array<"A" | "B" | "C" | "D">;
    about: Array<"A" | "B" | "C">;
    services: Array<"A" | "B" | "C">;
    testimonials: Array<"A" | "B" | "C">;
    gallery: Array<"A" | "B" | "C">;
    pricing: Array<"A" | "B" | "C">;
    faq: Array<"A" | "B">;
    cta: Array<"A" | "B" | "C">;
    contact: Array<"A" | "B" | "C">;
    footer: Array<"A" | "B">;
  };
  requiredImageSlots: Partial<Record<SectionType, Partial<Record<string, string[]>>>>;
  defaultTokenSetId: TokenSetId;
};

const BASE_VARIANTS: TemplateDefinition["allowedVariants"] = {
  hero: ["A", "B", "C", "D"],
  // About schema currently only includes title/body, so keep generation on variant A.
  about: ["A"],
  services: ["A", "B", "C"],
  testimonials: ["A", "B", "C"],
  gallery: ["A", "B", "C"],
  pricing: ["A", "B", "C"],
  faq: ["A", "B"],
  cta: ["A", "B", "C"],
  contact: ["A", "B", "C"],
  footer: ["A", "B"]
};

const IMAGE_SLOTS: TemplateDefinition["requiredImageSlots"] = {
  hero: {
    B: ["hero-main"],
    C: ["hero-main"],
    D: ["hero-main"]
  },
  gallery: {
    A: ["gallery-1", "gallery-2", "gallery-3"],
    B: ["gallery-1", "gallery-2", "gallery-3", "gallery-4"],
    C: ["gallery-1", "gallery-2", "gallery-3", "gallery-4", "gallery-5", "gallery-6"]
  },
  about: {
    C: ["about-main"]
  },
  cta: {
    C: ["cta-main"]
  }
};

export const TEMPLATE_REGISTRY: TemplateDefinition[] = [
  {
    templateId: "auto-modern",
    allowedNiches: ["service", "home-services", "local-services"],
    defaultSectionOrder: ["hero", "services", "about", "cta", "contact", "footer"],
    allowedVariants: BASE_VARIANTS,
    requiredImageSlots: IMAGE_SLOTS,
    defaultTokenSetId: "service-clean"
  },
  {
    templateId: "restaurant-editorial",
    allowedNiches: ["restaurant", "cafe", "hospitality"],
    defaultSectionOrder: ["hero", "services", "gallery", "testimonials", "faq", "cta", "contact", "footer"],
    allowedVariants: BASE_VARIANTS,
    requiredImageSlots: IMAGE_SLOTS,
    defaultTokenSetId: "restaurant-warm"
  },
  {
    templateId: "clinic-clean",
    allowedNiches: ["clinic", "dental", "medical"],
    defaultSectionOrder: ["hero", "services", "about", "contact", "footer"],
    allowedVariants: BASE_VARIANTS,
    requiredImageSlots: IMAGE_SLOTS,
    defaultTokenSetId: "clinic-calm"
  },
  {
    templateId: "beauty-lux",
    allowedNiches: ["beauty", "salon", "spa"],
    defaultSectionOrder: ["hero", "about", "services", "gallery", "testimonials", "cta", "contact", "footer"],
    allowedVariants: BASE_VARIANTS,
    requiredImageSlots: IMAGE_SLOTS,
    defaultTokenSetId: "studio-editorial"
  },
  {
    templateId: "corporate-sleek",
    allowedNiches: ["consulting", "agency", "software"],
    defaultSectionOrder: ["hero", "services", "about", "pricing", "faq", "cta", "contact", "footer"],
    allowedVariants: BASE_VARIANTS,
    requiredImageSlots: IMAGE_SLOTS,
    defaultTokenSetId: "consulting-sharp"
  },
  {
    templateId: "portfolio-minimal",
    allowedNiches: ["portfolio", "fashion", "studio", "creative"],
    defaultSectionOrder: ["hero", "about", "gallery", "cta", "contact", "footer"],
    allowedVariants: BASE_VARIANTS,
    requiredImageSlots: IMAGE_SLOTS,
    defaultTokenSetId: "studio-editorial"
  },
  {
    templateId: "ecommerce-simple",
    allowedNiches: ["retail", "shop", "ecommerce"],
    defaultSectionOrder: ["hero", "services", "pricing", "faq", "cta", "contact", "footer"],
    allowedVariants: BASE_VARIANTS,
    requiredImageSlots: IMAGE_SLOTS,
    defaultTokenSetId: "service-clean"
  },
  {
    templateId: "hospitality-resort",
    allowedNiches: ["hospitality", "travel", "resort"],
    defaultSectionOrder: ["hero", "about", "gallery", "services", "testimonials", "cta", "contact", "footer"],
    allowedVariants: BASE_VARIANTS,
    requiredImageSlots: IMAGE_SLOTS,
    defaultTokenSetId: "restaurant-warm"
  },
  {
    templateId: "legal-clarity",
    allowedNiches: ["legal", "law", "attorney"],
    defaultSectionOrder: ["hero", "about", "services", "faq", "cta", "contact", "footer"],
    allowedVariants: BASE_VARIANTS,
    requiredImageSlots: IMAGE_SLOTS,
    defaultTokenSetId: "legal-trust"
  },
  {
    templateId: "home-services-trust",
    allowedNiches: ["plumbing", "hvac", "electrical", "landscaping", "home-services"],
    defaultSectionOrder: ["hero", "services", "pricing", "testimonials", "faq", "cta", "contact", "footer"],
    allowedVariants: BASE_VARIANTS,
    requiredImageSlots: IMAGE_SLOTS,
    defaultTokenSetId: "home-trades"
  }
];

export const TEMPLATE_IDS = TEMPLATE_REGISTRY.map((item) => item.templateId) as [
  string,
  ...string[]
];

export const TEMPLATE_MAP = Object.fromEntries(
  TEMPLATE_REGISTRY.map((item) => [item.templateId, item])
) as Record<string, TemplateDefinition>;

export const getTemplateById = (templateId: string): TemplateDefinition | null => {
  return TEMPLATE_MAP[templateId] ?? null;
};

export const pickTemplateForNiche = (businessType: string, subtype?: string | null): TemplateDefinition => {
  const haystack = `${businessType} ${subtype ?? ""}`.toLowerCase();
  const direct = TEMPLATE_REGISTRY.find((template) =>
    template.allowedNiches.some((tag) => haystack.includes(tag.toLowerCase()))
  );
  if (direct) return direct;
  return TEMPLATE_MAP["auto-modern"];
};

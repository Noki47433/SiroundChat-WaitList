import type { SiteDocument, SiteImage, SiteSection, SiteThemeTokens } from "@/lib/website-builder/types";

export type SupportedIndustryKey =
  | "barbershop"
  | "restaurant"
  | "dental_clinic"
  | "real_estate";

export type LayoutDensity = "compact" | "balanced" | "airy";
export type ContrastLevel = "soft" | "medium" | "high";
export type SectionEmphasis = "base" | "soft" | "contrast" | "brand" | "image";
export type ConversionRole =
  | "brand"
  | "education"
  | "proof"
  | "primary_cta"
  | "secondary_cta"
  | "contact"
  | "menu"
  | "listings"
  | "pricing"
  | "trust";

export type LegacySectionType = Extract<
  SiteSection["type"],
  "hero" | "services" | "about" | "gallery" | "testimonials" | "pricing" | "cta" | "faq" | "contact" | "reservation" | "footer"
>;

export type SectionBlueprintId =
  | "hero"
  | "signature_services"
  | "service_pricing"
  | "featured_dishes"
  | "menu_preview"
  | "treatments_grid"
  | "featured_listings"
  | "buyer_seller_services"
  | "proof_grid"
  | "review_summary"
  | "brand_story"
  | "atmosphere_story"
  | "clinic_reassurance"
  | "neighborhood_expertise"
  | "gallery_showcase"
  | "faq"
  | "booking_cta"
  | "reservation_cta"
  | "lead_cta"
  | "contact_hours"
  | "payment_info"
  | "footer";

export type IndustryConfig = {
  id: SupportedIndustryKey;
  label: string;
  detectionKeywords: string[];
  primaryConversionGoals: string[];
  allowedSections: SectionBlueprintId[];
  discouragedSections: SectionBlueprintId[];
  preferredSectionStacks: Array<SectionBlueprintId[]>;
  contentRules: string[];
  trustPatterns: string[];
  ctaPatterns: string[];
  mediaNeeds: string[];
  toneConstraints: {
    preferred: string[];
    avoid: string[];
  };
  userJourneys: string[];
  mustHaveInformation: string[];
  proofFallbacks: string[];
};

export type BrandArchetypeConfig = {
  id: string;
  industryId: SupportedIndustryKey;
  label: string;
  tone: string;
  mood: string;
  density: LayoutDensity;
  contrast: ContrastLevel;
  imageTreatment: string;
  ctaStyle: "solid" | "outline";
  headlineStyle: string;
  trustStyle: string;
  proofStyle: string;
  bannedPhrases: string[];
  contentFlavor: string[];
  preferredLayoutIds: string[];
  fontPair: {
    heading: string;
    body: string;
  };
  palette: {
    primary: string;
    secondary: string;
    background: string;
    accent: string;
    text: string;
    muted: string;
    surface: string;
    border: string;
    buttonText: string;
  };
};

export type LayoutDNA = {
  id: string;
  label: string;
  compatibleIndustries: SupportedIndustryKey[];
  heroVariant: "A" | "B" | "C" | "D";
  sectionVariantBias: Partial<Record<LegacySectionType, string[]>>;
  sectionRhythm: SectionEmphasis[];
  spacing: SiteSection["style"]["spacing"];
  alignment: SiteSection["style"]["alignment"];
  cardDensity: LayoutDensity;
  imageUsage: string;
  ctaPlacement: string;
  contrastNotes: string;
};

export type SectionDefinition = {
  id: SectionBlueprintId;
  label: string;
  purpose: string;
  supportedIndustries: SupportedIndustryKey[];
  supportedArchetypes?: string[];
  legacyType: LegacySectionType;
  requiredContentFields: string[];
  optionalContentFields: string[];
  visualVariants: string[];
  conversionRole: ConversionRole;
  includeRules: {
    requiresPhotos?: boolean;
    requiresProof?: boolean;
    requiresAddress?: boolean;
    minServices?: number;
    onlyForPrimaryGoal?: string[];
  };
  excludeRules?: {
    whenNoProof?: boolean;
  };
  promptGuidance: string;
};

export type TemplateGenerationInput = {
  businessName: string;
  industry: string;
  subtype?: string | null;
  description: string;
  targetCustomer?: string | null;
  tone: string;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  fontFamily?: string | null;
  services: string[];
  proofPoints: string[];
  contact?: {
    email?: string | null;
    phone?: string | null;
    address?: string | null;
  } | null;
  openingHours?: string | null;
  socials?: Record<string, string | null> | null;
  uploadedImages?: Array<{
    src: string;
    alt?: string;
    width?: number;
    height?: number;
  }>;
  language: string;
  qualityMode: "fast" | "balanced" | "best";
  brief: {
    audience: string;
    coreOffer: string;
    primaryCtaGoal: string;
    topServices: string[];
    proofPoints: string[];
    tone: string;
  };
};

export type IndustryFacts = {
  industryId: SupportedIndustryKey;
  locationLabel: string;
  audience: string;
  coreOffer: string;
  primaryGoal: string;
  topServices: string[];
  proofPoints: string[];
  menuHighlights: string[];
  treatmentHighlights: string[];
  listingHighlights: string[];
  reservationIntent: string;
  bookingIntent: string;
  inquiryIntent: string;
};

export type SectionDraft = {
  blueprintId: SectionBlueprintId;
  legacyType: LegacySectionType;
  variant: string;
  label: string;
  purpose: string;
  conversionRole: ConversionRole;
  emphasis: SectionEmphasis;
  content: Record<string, any>;
  images?: SiteImage[];
};

export type ArchitectureCandidate = {
  industry: IndustryConfig;
  archetype: BrandArchetypeConfig;
  layout: LayoutDNA;
  sections: SectionDefinition[];
  sectionOrder: SectionBlueprintId[];
  theme: SiteThemeTokens;
  facts: IndustryFacts;
  score: number;
};

export type TemplateValidationIssue = {
  code: string;
  severity: "critical" | "warning";
  message: string;
  sectionId?: string;
};

export type TemplateValidationReport = {
  passed: boolean;
  score: number;
  issues: TemplateValidationIssue[];
  architecture: {
    industryId: SupportedIndustryKey;
    archetypeId: string;
    layoutId: string;
  };
};

export type TemplateGenerationOutput = {
  siteDocument: SiteDocument;
  validation: TemplateValidationReport;
  meta: {
    pipeline: "industry_v2";
    industryId: SupportedIndustryKey;
    archetypeId: string;
    layoutId: string;
    sectionBlueprintIds: SectionBlueprintId[];
    candidateScores: Array<{
      industryId: SupportedIndustryKey;
      archetypeId: string;
      layoutId: string;
      score: number;
    }>;
    promptUsed: boolean;
  };
};

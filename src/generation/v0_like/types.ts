import type { SiteDocument } from "@/lib/website-builder/types";
import type {
  ContentLanguage,
  GenerationBriefData,
  QualityMode
} from "@/lib/builder/generation-config";

export const SITE_TYPES = [
  "saas",
  "portfolio",
  "local_business",
  "ecommerce",
  "event",
  "blog",
  "other"
] as const;

export const VERTICALS = [
  "restaurant",
  "clinic",
  "barbershop",
  "saas",
  "portfolio",
  "ecommerce",
  "local_business",
  "event",
  "blog",
  "other"
] as const;

export const PRIMARY_GOALS = [
  "sign_up",
  "request_demo",
  "book_call",
  "reservations",
  "buy_now",
  "email_capture",
  "visit_location",
  "download",
  "other"
] as const;

export const TONES = [
  "neutral",
  "playful",
  "premium",
  "minimal",
  "bold",
  "technical"
] as const;

export const DENSITIES = ["airy", "normal", "dense"] as const;

export const THEME_MODES = ["light", "dark", "system"] as const;

export const THEME_ACCENTS = [
  "slate",
  "blue",
  "indigo",
  "violet",
  "cyan",
  "teal",
  "green",
  "orange",
  "red",
  "yellow"
] as const;

export const THEME_FONTS = ["sans", "serif", "mono"] as const;

export const SECTION_TYPES = [
  "header",
  "hero",
  "logos",
  "features",
  "feature_spotlight",
  "metrics",
  "testimonials",
  "pricing",
  "faq",
  "cta_banner",
  "contact",
  "footer"
] as const;

export type SiteType = (typeof SITE_TYPES)[number];
export type Vertical = (typeof VERTICALS)[number];
export type PrimaryGoal = (typeof PRIMARY_GOALS)[number];
export type Tone = (typeof TONES)[number];
export type Density = (typeof DENSITIES)[number];
export type ThemeMode = (typeof THEME_MODES)[number];
export type ThemeAccent = (typeof THEME_ACCENTS)[number];
export type ThemeFont = (typeof THEME_FONTS)[number];
export type SectionType = (typeof SECTION_TYPES)[number];

export type IntakeLocks = {
  accent: boolean;
  font: boolean;
  goal: boolean;
  vertical: boolean;
};

export type IntakeTheme = {
  mode: ThemeMode;
  tone: Tone;
  accent: ThemeAccent;
  font: ThemeFont;
};

export type IntakeBrief = {
  siteType: SiteType;
  vertical: Vertical;
  businessNiche?: string;
  language: ContentLanguage;
  brief: GenerationBriefData;
  primaryGoal: PrimaryGoal;
  brandName: string;
  logoUrl?: string | null;
  audience: string;
  offer: string;
  tone: Tone;
  density: Density;
  theme: IntakeTheme;
  locks: IntakeLocks;
  allowPricingForRestaurant: boolean;
  mustHaveSections: SectionType[];
  mustAvoid: string[];
};

export type GenerationInputMetadata = {
  businessName?: string | null;
  logoUrl?: string | null;
  category?: string | null;
  industry?: string | null;
  subtype?: string | null;
  description?: string | null;
  tone?: string | null;
  themeMode?: ThemeMode | null;
  primaryColor?: string | null;
  secondaryColor?: string | null;
  fontFamily?: string | null;
  includePricing?: boolean | null;
  targetCustomer?: string | null;
  services?: string[] | null;
  language?: ContentLanguage | null;
  brief?: GenerationBriefData | null;
};

export type V0LikeGenerationInput = {
  rawPrompt: string;
  metadata?: GenerationInputMetadata;
  openai?: any;
  runCommandChecks?: boolean;
  qualityMode?: QualityMode;
};

export type PlanValidationIssue = {
  code: string;
  path: string;
  message: string;
  offendingPhrase?: string;
  replacementRule?: string;
};

export type GeneratedFile = {
  path: string;
  content: string;
};

export type RenderOutput = {
  files: GeneratedFile[];
  pageMarkup: string;
  h1Count: number;
  siteDocument: SiteDocument;
};

export type PipelineStage =
  | "stage0_intake"
  | "stage1_plan"
  | "stage2_validate"
  | "stage3_render"
  | "stage4_clamp"
  | "stage5_output"
  | "stage6_checks";

export type StageFailure = {
  stage: PipelineStage;
  attempts: number;
  errors: string[];
  lastOutputSnippet?: string;
};

export type PipelineChecksResult = {
  ok: boolean;
  errors: string[];
};

export type GenerationQualityIssue = {
  code: string;
  severity: "error" | "warning";
  message: string;
  suggestion?: string;
};

export type GenerationQualityReport = {
  mode: QualityMode;
  score: number;
  threshold: number;
  passed: boolean;
  issues: GenerationQualityIssue[];
  genericPhraseHits: string[];
  candidateCount: number;
};

export type V0LikeGenerationSuccess = {
  ok: true;
  plan: unknown;
  intake: IntakeBrief;
  rendered: RenderOutput;
  checks: PipelineChecksResult;
  quality: GenerationQualityReport;
};

export type V0LikeGenerationFailure = {
  ok: false;
  error: StageFailure;
};

export type V0LikeGenerationResult = V0LikeGenerationSuccess | V0LikeGenerationFailure;

import { NextResponse } from "next/server";
import { z } from "zod";
import Ajv, { type ValidateFunction } from "ajv";
import { userHasLaunchAccess } from "@/lib/server/launch-access";
import { getOpenAIClient } from "@/lib/ai/client";
import { selectTemplateKey } from "@/lib/builder/utils";
import { emitGenerationEvent } from "@/lib/builder/generation/analytics";
import { applyDeterministicImages } from "@/lib/builder/generation/images";
import { toLegacySiteDocument } from "@/lib/builder/generation/legacy";
import { buildGenerationPlanCandidates } from "@/lib/builder/generation/plan";
import { getGenerationPolicy } from "@/lib/builder/generation/policy";
import { regenerateFailingSections } from "@/lib/builder/generation/regenerateSection";
import { computeWebsiteQualityScore } from "@/lib/builder/generation/score";
import { buildSkeleton } from "@/lib/builder/generation/structure";
import type { GenerationIntake, GenerationPlan } from "@/lib/builder/generation/types";
import { validateSiteDocument } from "@/lib/builder/generation/validate";
import { fillSkeletonSections } from "@/lib/builder/generation/fill";
import { getBuilderPlanForRoute } from "@/lib/builder/plan";
import {
  CTA_GOALS,
  CONTENT_LANGUAGES,
  QUALITY_MODES,
  normalizeContentLanguage,
  normalizeQualityMode,
  sanitizeGenerationBrief
} from "@/lib/builder/generation-config";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getSupabaseServerAdminClientIfAvailable } from "@/lib/supabase/serverAdmin";
import { SiteDocumentSchema } from "@/lib/website-builder/schema";
import type { SiteDocument, SiteSection, SiteThemeTokens } from "@/lib/website-builder/types";
import { hasEntitlement, resolveEntitlements } from "@/src/billing/entitlements";
import { getOwnedBuilderSite } from "@/lib/builder/site-access";
import { DeterministicTemplateRenderer } from "@/components/deterministic-templates";
import { generateIndustrySiteV2, isIndustryV2Supported } from "@/lib/builder/generation/v2";
import {
  buildGenerationContract,
  getPersistedTemplateIdForRail,
  parseAndValidateGeneratedJson,
  resolveDeterministicTemplate,
  type DeterministicPayload,
  type DeterministicTemplateId
} from "@/lib/deterministic-templates";
import { runV0LikeGenerationPipeline } from "@/src/generation/v0_like";

export const runtime = "nodejs";

const ColorSchema = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/)
  .optional()
  .nullable();

const ContentLanguageSchema = z.enum(
  CONTENT_LANGUAGES.map((item) => item.value) as [string, ...string[]]
);

const QualityModeSchema = z.enum(QUALITY_MODES);

const GenerationBriefSchema = z.object({
  audience: z.string().trim().min(1),
  coreOffer: z.string().trim().min(1),
  primaryCtaGoal: z.enum(CTA_GOALS),
  topServices: z.array(z.string().trim().min(1)).min(3),
  proofPoints: z.array(z.string().trim().min(1)).optional().default([]),
  tone: z.string().trim().min(1)
});

const PayloadSchema = z
  .object({
    siteId: z.string().uuid(),
    businessId: z.string().uuid(),
    businessName: z.string().min(1),
    industry: z.string().min(1),
    subtype: z.string().optional().nullable(),
    description: z.string().min(1),
    targetCustomer: z.string().optional().nullable(),
    services: z.array(z.string()).optional(),
    tone: z.string().min(1),
    ctaIntent: z.enum(["contact", "call", "quote", "reserve", "buy", "demo"]).optional(),
    proofAssets: z.array(z.string()).optional(),
    pagesMode: z.enum(["one", "multi"]).default("one"),
    templateId: z.string().min(1).optional(),
    primaryColor: ColorSchema,
    secondaryColor: ColorSchema,
    fontFamily: z.string().min(2).optional().nullable(),
    logoUrl: z.string().url().optional().nullable(),
    openingHours: z.string().optional().nullable(),
    contact: z
      .object({
        email: z.string().email().optional().nullable(),
        phone: z.string().min(2).optional().nullable(),
        address: z.string().min(2).optional().nullable()
      })
      .optional()
      .nullable(),
    socials: z.record(z.string(), z.string().nullable()).optional().nullable(),
    uploadedImages: z
      .array(
        z.object({
          src: z.string().url(),
          alt: z.string().optional(),
          width: z.number().int().positive().optional(),
          height: z.number().int().positive().optional()
        })
      )
      .optional(),
    features: z
      .object({
        includeServices: z.boolean().optional(),
        includeTestimonials: z.boolean().optional(),
        includePricing: z.boolean().optional(),
        includeFaq: z.boolean().optional(),
        includeContact: z.boolean().optional(),
        includeGallery: z.boolean().optional()
      })
      .optional()
      .nullable(),
    hasOwnPhotos: z.boolean().optional(),
    language: ContentLanguageSchema,
    qualityMode: QualityModeSchema,
    brief: GenerationBriefSchema,
    chatbotEmbedSnippet: z.string().trim().optional().nullable()
  })
  .strict();

const normalizeToneProfile = (tone: string): GenerationIntake["toneProfile"] => {
  const normalized = tone.toLowerCase();
  if (normalized.includes("friend")) return "friendly";
  if (normalized.includes("premium") || normalized.includes("lux")) return "premium";
  if (normalized.includes("bold")) return "bold";
  if (normalized.includes("calm")) return "calm";
  if (normalized.includes("playful")) return "playful";
  return "professional";
};

const inferCtaIntent = (payload: z.infer<typeof PayloadSchema>): GenerationIntake["ctaIntent"] => {
  if (payload.ctaIntent) return payload.ctaIntent;
  const industry = payload.industry.toLowerCase();
  if (industry.includes("restaurant") || industry.includes("cafe") || industry.includes("hospitality")) {
    return "reserve";
  }
  if (industry.includes("clinic") || industry.includes("dental") || industry.includes("medical")) {
    return "call";
  }
  return "contact";
};

const applyFeatureSelection = (
  plan: GenerationPlan,
  features: z.infer<typeof PayloadSchema>["features"]
) => {
  const flags = {
    includeServices: features?.includeServices ?? true,
    includeTestimonials: features?.includeTestimonials ?? false,
    includePricing: features?.includePricing ?? false,
    includeFaq: features?.includeFaq ?? false,
    includeContact: features?.includeContact ?? true,
    includeGallery: features?.includeGallery ?? false
  };

  const disallowed = new Set<string>();
  if (!flags.includeServices) disallowed.add("services");
  if (!flags.includeTestimonials) disallowed.add("testimonials");
  if (!flags.includePricing) disallowed.add("pricing");
  if (!flags.includeFaq) disallowed.add("faq");
  if (!flags.includeGallery) disallowed.add("gallery");

  const sectionOrder = plan.sectionOrder.filter((type) => !disallowed.has(type));
  if (!sectionOrder.includes("hero")) sectionOrder.unshift("hero");
  if (!sectionOrder.includes("contact")) sectionOrder.push("contact");
  if (!sectionOrder.includes("footer")) sectionOrder.push("footer");

  const trimmed = sectionOrder.slice(0, 10);
  return {
    ...plan,
    sectionOrder: trimmed
  };
};

const countValidationIssues = (validation: ReturnType<typeof validateSiteDocument>) => {
  const sectionIssues = Object.values(validation.errorsBySectionId).reduce(
    (count, issues) => count + issues.length,
    0
  );
  return validation.errorsGlobal.length + sectionIssues;
};

const rankCandidate = (
  score: ReturnType<typeof computeWebsiteQualityScore>,
  validation: ReturnType<typeof validateSiteDocument>
) => {
  const issuePenalty = countValidationIssues(validation) * 5;
  const gatePenalty = score.gates.length * 8;
  const autoFailPenalty = score.autoFail ? 25 : 0;
  return score.total - issuePenalty - gatePenalty - autoFailPenalty;
};

const evaluateCandidatePlan = async (
  plan: GenerationPlan,
  intake: GenerationIntake,
  policy: ReturnType<typeof getGenerationPolicy>,
  openai: ReturnType<typeof getOpenAIClient>
) => {
  const skeleton = buildSkeleton(plan, intake);
  let generated = await fillSkeletonSections(skeleton, intake, policy, openai);

  let validation = validateSiteDocument(generated);
  let regensCount = 0;

  if (!validation.ok && Object.keys(validation.errorsBySectionId).length > 0) {
    const regenResult = await regenerateFailingSections(
      generated,
      intake,
      policy,
      openai,
      validation
    );
    generated = regenResult.document;
    regensCount = regenResult.regensCount;
    validation = validateSiteDocument(generated);
  }

  generated = await applyDeterministicImages(generated, intake);
  validation = validateSiteDocument(generated);

  if (!validation.ok) {
    generated = disableFailingOptionalSections(generated, Object.keys(validation.errorsBySectionId));
    validation = validateSiteDocument(generated);
  }

  const score = computeWebsiteQualityScore(generated, validation);
  return {
    plan,
    generated,
    validation,
    score,
    regensCount,
    rankingScore: rankCandidate(score, validation)
  };
};

const disableFailingOptionalSections = (
  siteDoc: any,
  failingSectionIds: string[]
) => {
  const required = new Set(["hero", "contact", "footer"]);
  return {
    ...siteDoc,
    pages: siteDoc.pages.map((page: any) => ({
      ...page,
      sections: page.sections.map((section: any) => {
        if (!failingSectionIds.includes(section.sectionId)) return section;
        if (required.has(section.type)) return section;
        return {
          ...section,
          enabled: false
        };
      })
    }))
  };
};

const parseBooleanEnv = (value: string | undefined): boolean | null => {
  if (!value) return null;
  const lowered = value.trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(lowered)) return true;
  if (["0", "false", "no", "off"].includes(lowered)) return false;
  return null;
};

const isV0LikePipelineEnabled = () => {
  const envOverride = parseBooleanEnv(process.env.SIROUNDCHAT_V0LIKE_GENERATOR);
  if (envOverride !== null) return envOverride;
  return process.env.NODE_ENV !== "production";
};

const buildRawPromptFromInput = (input: z.infer<typeof PayloadSchema>) => {
  const brief = sanitizeGenerationBrief(input.brief, input.tone);
  const lines = [
    input.description,
    `Business: ${input.businessName}`,
    `Industry: ${input.industry}`,
    input.subtype ? `Subtype: ${input.subtype}` : null,
    input.targetCustomer ? `Audience: ${input.targetCustomer}` : null,
    `Tone: ${input.tone}`,
    `Language: ${input.language}`,
    `Quality mode: ${input.qualityMode}`,
    `Primary audience: ${brief.audience}`,
    `Core offer: ${brief.coreOffer}`,
    `Primary CTA goal: ${brief.primaryCtaGoal}`,
    brief.topServices.length ? `Top services: ${brief.topServices.join(", ")}` : null,
    brief.proofPoints.length ? `Proof points: ${brief.proofPoints.join(", ")}` : null,
    input.services?.length ? `Services: ${input.services.join(", ")}` : null,
    input.features?.includePricing ? "Include pricing" : "Avoid pricing unless explicitly requested",
    input.features?.includeFaq ? "Include FAQ" : null,
    input.features?.includeTestimonials ? "Include testimonials" : null,
    input.contact?.address ? `Location: ${input.contact.address}` : null,
    input.primaryColor ? `Primary color: ${input.primaryColor}` : null,
    input.secondaryColor ? `Secondary color: ${input.secondaryColor}` : null,
    input.fontFamily ? `Font family: ${input.fontFamily}` : null
  ];

  return lines.filter(Boolean).join("\n");
};

const withLogoInSiteBrief = (
  document: Record<string, any>,
  input: Pick<z.infer<typeof PayloadSchema>, "businessName" | "logoUrl" | "industry" | "description" | "tone" | "language" | "brief">
) => {
  const logoUrl = input.logoUrl ?? null;
  return {
    ...document,
    siteBrief: {
      ...(document.siteBrief ?? {}),
      businessName: input.businessName,
      logoUrl: logoUrl ?? undefined,
      industry: input.industry,
      description: input.description,
      tone: input.tone,
      language: input.language,
      generationBrief: sanitizeGenerationBrief(input.brief, input.tone)
    }
  };
};

const withBundleChatbot = (
  document: Record<string, any>,
  isBundlePlan: boolean
) => {
  if (!isBundlePlan) return document;

  const nowIso = new Date().toISOString();
  const existingApps = Array.isArray(document.apps) ? [...document.apps] : [];
  const chatAppIndex = existingApps.findIndex((app: any) => app?.id === "live-chat");

  if (chatAppIndex >= 0) {
    existingApps[chatAppIndex] = {
      ...existingApps[chatAppIndex],
      enabled: true,
      config: {
        ...(existingApps[chatAppIndex]?.config ?? {}),
        autoInstalledByGeneration: true
      }
    };
  } else {
    existingApps.push({
      id: "live-chat",
      name: "Live Chat",
      installedAt: nowIso,
      enabled: true,
      config: {
        autoInstalledByGeneration: true
      }
    });
  }

  return {
    ...document,
    apps: existingApps,
    chat_prompt_topbar_enabled: true,
    chat_prompt_topbar_text:
      document.chat_prompt_topbar_text ??
      "Need help choosing the right option? Chat with us now.",
    chat_prompt_topbar_cta: document.chat_prompt_topbar_cta ?? "Open chat",
    chat_launcher_glow_enabled: true
  };
};

const extractChatbotEmbedSrc = (snippet?: string | null) => {
  const trimmed = snippet?.trim();
  if (!trimmed) return null;
  if (/^https?:\/\/\S+$/i.test(trimmed)) {
    return trimmed;
  }
  const match = trimmed.match(/<script[^>]*\bsrc=(["'])(.*?)\1/i);
  return match?.[2]?.trim() || null;
};

const withEmbeddedChatbotSnippet = (
  document: Record<string, any>,
  snippetSrc: string | null
) => {
  if (!snippetSrc) return document;

  const nowIso = new Date().toISOString();
  const existingApps = Array.isArray(document.apps) ? [...document.apps] : [];
  const chatAppIndex = existingApps.findIndex((app: any) => app?.id === "live-chat");

  if (chatAppIndex >= 0) {
    existingApps[chatAppIndex] = {
      ...existingApps[chatAppIndex],
      enabled: true,
      config: {
        ...(existingApps[chatAppIndex]?.config ?? {}),
        src: snippetSrc,
        pastedEmbedSnippet: true
      }
    };
  } else {
    existingApps.push({
      id: "live-chat",
      name: "Live Chat",
      installedAt: nowIso,
      enabled: true,
      config: {
        src: snippetSrc,
        pastedEmbedSnippet: true
      }
    });
  }

  return {
    ...document,
    apps: existingApps
  };
};

const DETERMINISTIC_PIPELINE = "deterministic_rails";
const DETERMINISTIC_MODEL = "gpt-4o-mini";
const deterministicAjv = new Ajv({ allErrors: true });
const schemaValidators = new Map<string, ValidateFunction>();

type GeneratePayloadInput = z.infer<typeof PayloadSchema>;
type DeterministicValidationIssue = {
  path: string;
  code: string;
  message: string;
};

const isEnvTrue = (value: string | undefined): boolean => value?.trim().toLowerCase() === "true";

const DEFAULT_THEME_COLORS = {
  primary: "#111827",
  secondary: "#f3f4f6",
  bg: "#ffffff",
  text: "#111827",
  muted: "#6b7280",
  surface: "#f9fafb",
  border: "#e5e7eb",
  buttonText: "#ffffff"
} as const;

const defaultSectionStyle = (): SiteSection["style"] => ({
  alignment: "left",
  spacing: "normal",
  background: { type: "plain" },
  buttonStyle: "solid",
  colorOverride: null
});

const stringifyValue = (value: unknown): string => {
  if (value === null || value === undefined) return "";
  if (typeof value === "string") return value.trim();
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => stringifyValue(item))
      .filter(Boolean)
      .join(" • ");
  }
  if (typeof value === "object") {
    return Object.values(value as Record<string, unknown>)
      .map((item) => stringifyValue(item))
      .filter(Boolean)
      .join(" • ");
  }
  return "";
};

const summarizeSectionValue = (value: unknown, maxChars = 240): string => {
  const summary = stringifyValue(value)
    .replace(/\s+/g, " ")
    .trim();
  if (!summary) return "Content added from deterministic rail.";
  return summary.length > maxChars ? `${summary.slice(0, maxChars - 3)}...` : summary;
};

const toTitle = (key: string): string =>
  key
    .replaceAll("_", " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase())
    .trim();

const buildThemeFromInput = (input: GeneratePayloadInput, rail: DeterministicTemplateId): SiteThemeTokens => {
  const primary = input.primaryColor ?? DEFAULT_THEME_COLORS.primary;
  const bg = input.secondaryColor ?? DEFAULT_THEME_COLORS.bg;
  const headingFont =
    rail === "restaurant" || rail === "real_estate"
      ? "ui-serif, Georgia, Cambria, 'Times New Roman', serif"
      : "ui-sans-serif, system-ui, sans-serif";

  return {
    primary,
    secondary: input.secondaryColor ?? DEFAULT_THEME_COLORS.secondary,
    bg,
    text: DEFAULT_THEME_COLORS.text,
    muted: DEFAULT_THEME_COLORS.muted,
    surface: DEFAULT_THEME_COLORS.surface,
    border: DEFAULT_THEME_COLORS.border,
    buttonText: DEFAULT_THEME_COLORS.buttonText,
    fontHeading: headingFont,
    fontBody: "ui-sans-serif, system-ui, sans-serif",
    radius: "xl",
    pageTransitions: "none",
    textStyles: {
      h1: { size: "2.5rem", weight: 700, lineHeight: "1.15", letterSpacing: "-0.01em" },
      h2: { size: "2rem", weight: 650, lineHeight: "1.2", letterSpacing: "-0.01em" },
      h3: { size: "1.5rem", weight: 600, lineHeight: "1.3" },
      body: { size: "1rem", weight: 400, lineHeight: "1.65" },
      caption: { size: "0.875rem", weight: 400, lineHeight: "1.5" }
    }
  };
};

const buildHeroSection = (payload: DeterministicPayload): SiteSection => {
  const heroData = (payload as any).hero ?? {};
  const subheadline = heroData.subhead ?? heroData.tagline ?? "";
  const ctaLabel = heroData.primary_cta_label ?? "Get started";
  const ctaHref = heroData.primary_cta_url ?? "#contact";
  return {
    id: "hero",
    type: "hero",
    variant: "A",
    enabled: true,
    style: defaultSectionStyle(),
    content: {
      headline: heroData.headline ?? "Business website",
      subheadline,
      ctaLabel,
      ctaHref
    }
  };
};

const buildContactSection = (payload: DeterministicPayload): SiteSection | null => {
  const contactData = (payload as any).contact;
  if (!contactData || typeof contactData !== "object") return null;

  const title = payload.template === "real_estate" ? "Inquire" : "Contact";
  const body = summarizeSectionValue(contactData, 280);
  const ctaUrl =
    contactData.booking_cta_url ??
    contactData.inquire_cta_url ??
    contactData.map_url ??
    contactData.keyboard_navigation_url ??
    "#";

  return {
    id: "contact",
    type: "contact",
    variant: "A",
    enabled: true,
    style: defaultSectionStyle(),
    content: {
      title,
      body,
      email: (payload as any).footer?.email ?? undefined,
      phone: contactData.phone ?? (payload as any).header?.phone ?? undefined,
      address: contactData.address ?? (payload as any).header?.location ?? undefined,
      ctaLabel:
        contactData.booking_cta_label ??
        contactData.inquire_cta_label ??
        (payload as any).header?.primary_cta_label ??
        "Contact us",
      ctaHref: ctaUrl
    }
  };
};

const buildFooterSection = (payload: DeterministicPayload): SiteSection => {
  const footerData = (payload as any).footer ?? {};
  const footerText =
    footerData.email ??
    footerData.legal_url ??
    footerData.instagram_url ??
    `© ${new Date().getFullYear()} ${(payload as any).brand?.business_name ?? "Business"}.`;
  return {
    id: "footer",
    type: "footer",
    variant: "A",
    enabled: true,
    style: defaultSectionStyle(),
    content: {
      text: footerText
    }
  };
};

const buildNewsletterSection = (payload: DeterministicPayload): SiteSection | null => {
  if (payload.template !== "restaurant") return null;
  return {
    id: "newsletter",
    type: "newsletter",
    variant: "A",
    enabled: true,
    style: defaultSectionStyle(),
    content: {
      title: payload.newsletter.headline,
      body: payload.newsletter.subhead,
      ctaLabel: "Subscribe"
    }
  };
};

const buildCustomSection = (sectionId: string, payload: DeterministicPayload): SiteSection => {
  const data = (payload as any)[sectionId];
  return {
    id: sectionId,
    type: "custom",
    variant: "A",
    enabled: true,
    style: defaultSectionStyle(),
    content: {
      title: toTitle(sectionId),
      body: summarizeSectionValue(data)
    }
  };
};

const buildLegacySectionsFromDeterministic = (
  payload: DeterministicPayload,
  fixedOrder: readonly string[]
): SiteSection[] => {
  const sections: SiteSection[] = [];

  for (const sectionId of fixedOrder) {
    if (sectionId === "hero") {
      sections.push(buildHeroSection(payload));
      continue;
    }
    if (sectionId === "contact") {
      const contactSection = buildContactSection(payload);
      if (contactSection) sections.push(contactSection);
      continue;
    }
    if (sectionId === "newsletter") {
      const newsletter = buildNewsletterSection(payload);
      if (newsletter) sections.push(newsletter);
      continue;
    }
    if (sectionId === "footer") {
      sections.push(buildFooterSection(payload));
      continue;
    }
    sections.push(buildCustomSection(sectionId, payload));
  }

  return sections;
};

const buildLegacySiteDocumentFromDeterministic = (args: {
  input: GeneratePayloadInput;
  payload: DeterministicPayload;
  rail: DeterministicTemplateId;
  fixedOrder: readonly string[];
  renderedHtml: string;
}): SiteDocument => {
  const { input, payload, rail, fixedOrder, renderedHtml } = args;
  const sections = buildLegacySectionsFromDeterministic(payload, fixedOrder);
  const templateId = getPersistedTemplateIdForRail(rail);
  const theme = buildThemeFromInput(input, rail);

  return {
    templateId,
    tone: input.tone,
    theme,
    pages: [
      {
        id: "home",
        name: "Home",
        slug: "home",
        showInMenu: true,
        order: 0,
        sections
      }
    ],
    siteBrief: {
      businessName: input.businessName,
      logoUrl: input.logoUrl ?? undefined,
      industry: input.industry,
      description: input.description,
      tone: input.tone,
      language: input.language,
      generationBrief: sanitizeGenerationBrief(input.brief, input.tone),
      designDNA: {
        sectionOrder: fixedOrder.map((key) => key),
        variantBias: {},
        layoutStyle: "deterministic",
        imageryStyle: "schema-locked"
      }
    },
    seo: {
      title: `${(payload as any).brand?.business_name ?? input.businessName} | ${toTitle(rail)}`,
      description: input.description,
      ogImage: ((payload as any).hero?.hero_image?.src as string | undefined) ?? null
    },
    customCode: {
      head: null,
      body: renderedHtml
    }
  };
};

const buildDeterministicUserPrompt = (
  input: GeneratePayloadInput,
  schema: Record<string, unknown>,
  rail: DeterministicTemplateId
) => {
  return [
    `Template rail: ${rail}`,
    "Return JSON only that matches the schema exactly.",
    `business_name: ${input.businessName}`,
    `industry: ${input.industry}`,
    input.subtype ? `subtype: ${input.subtype}` : null,
    `description: ${input.description}`,
    input.targetCustomer ? `target_customer: ${input.targetCustomer}` : null,
    `language: ${input.language}`,
    `quality_mode: ${input.qualityMode}`,
    `brief: ${JSON.stringify(sanitizeGenerationBrief(input.brief, input.tone))}`,
    input.contact?.phone ? `phone: ${input.contact.phone}` : null,
    input.contact?.email ? `email: ${input.contact.email}` : null,
    input.contact?.address ? `address: ${input.contact.address}` : null,
    input.openingHours ? `opening_hours: ${input.openingHours}` : null,
    input.services?.length ? `services: ${input.services.join(", ")}` : null,
    input.socials ? `socials: ${JSON.stringify(input.socials)}` : null,
    "JSON_SCHEMA:",
    JSON.stringify(schema)
  ]
    .filter(Boolean)
    .join("\n");
};

const parseModelJson = (raw: string): unknown | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start === -1 || end === -1 || end < start) return null;
    try {
      return JSON.parse(trimmed.slice(start, end + 1));
    } catch {
      return null;
    }
  }
};

const sanitizeIssues = (issues: DeterministicValidationIssue[]) =>
  issues.map((issue) => ({
    path: issue.path,
    code: issue.code,
    message: issue.message
  }));

const renderDeterministicHtml = (payload: DeterministicPayload): string => {
  // `react-dom/server` type declarations are not bundled in this workspace.
  const serverRenderer = require("react-dom/server") as {
    renderToStaticMarkup: (input: unknown) => string;
  };
  return serverRenderer.renderToStaticMarkup(DeterministicTemplateRenderer({ payload }));
};

const getSchemaValidator = (rail: DeterministicTemplateId, schema: Record<string, unknown>) => {
  const schemaIdentity =
    typeof schema.$id === "string" && schema.$id.length > 0
      ? schema.$id
      : JSON.stringify(schema);
  const cacheKey = `${rail}:${schemaIdentity}`;
  const cached = schemaValidators.get(cacheKey);
  if (cached) return cached;
  const compiled = deterministicAjv.compile(schema);
  schemaValidators.set(cacheKey, compiled);
  return compiled;
};

const validateDeterministicModelOutput = (args: {
  rawJson: string;
  rail: DeterministicTemplateId;
  schema: Record<string, unknown>;
}):
  | { ok: true; payload: DeterministicPayload; issues: [] }
  | { ok: false; issues: DeterministicValidationIssue[] } => {
  const parsed = parseModelJson(args.rawJson);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== "object") {
    return {
      ok: false,
      issues: [{ path: "$", code: "invalid_json", message: "Model response is not a valid JSON object." }]
    };
  }

  // AJV validates exported JSON schema contracts; Zod + guardrails remain authoritative runtime checks.
  const schemaValidator = getSchemaValidator(args.rail, args.schema);
  const validBySchema = schemaValidator(parsed);
  if (!validBySchema) {
    const issues: DeterministicValidationIssue[] = (schemaValidator.errors ?? []).map((error: any) => ({
      path: error.instancePath || error.dataPath || "$",
      code: "json_schema",
      message: error.message ?? "JSON schema validation failed."
    }));
    return { ok: false, issues };
  }

  const zodGuardResult = parseAndValidateGeneratedJson(args.rail, JSON.stringify(parsed));
  if (!zodGuardResult.ok) {
    return { ok: false, issues: zodGuardResult.errors };
  }

  return { ok: true, payload: zodGuardResult.value as DeterministicPayload, issues: [] };
};

const runDeterministicCompletion = async (
  openai: NonNullable<ReturnType<typeof getOpenAIClient>>,
  systemPrompt: string,
  userPrompt: string
) => {
  const response = await openai.chat.completions.create({
    model: DETERMINISTIC_MODEL,
    temperature: 0,
    response_format: { type: "json_object" },
    messages: [
      { role: "system", content: systemPrompt },
      { role: "user", content: userPrompt }
    ]
  });
  return response.choices[0]?.message?.content ?? "";
};

const generateDeterministicPayload = async (args: {
  openai: NonNullable<ReturnType<typeof getOpenAIClient>>;
  input: GeneratePayloadInput;
  rail: DeterministicTemplateId;
  prompt: string;
  schema: Record<string, unknown>;
}):
  Promise<
    | { ok: true; payload: DeterministicPayload; repairUsed: boolean }
    | { ok: false; issues: DeterministicValidationIssue[]; repairUsed: boolean }
  > => {
  const initialUserPrompt = buildDeterministicUserPrompt(args.input, args.schema, args.rail);
  const firstRaw = await runDeterministicCompletion(args.openai, args.prompt, initialUserPrompt);
  const firstValidation = validateDeterministicModelOutput({
    rawJson: firstRaw,
    rail: args.rail,
    schema: args.schema
  });
  if (firstValidation.ok) {
    return { ok: true, payload: firstValidation.payload, repairUsed: false };
  }

  console.warn("[GEN:deterministic] validation failed; running repair", {
    rail: args.rail,
    issues: sanitizeIssues(firstValidation.issues)
  });

  const repairPrompt = [
    "Repair the JSON. Return JSON only.",
    `Rail: ${args.rail}`,
    "Validation issues:",
    ...firstValidation.issues.map((issue) => `- [${issue.code}] ${issue.path}: ${issue.message}`),
    "Do not add keys outside the schema.",
    "Keep section order exactly as schema key order.",
    "Previous JSON:",
    firstRaw,
    "JSON_SCHEMA:",
    JSON.stringify(args.schema)
  ].join("\n");

  const repairedRaw = await runDeterministicCompletion(
    args.openai,
    `${args.prompt}\nThis is a deterministic repair attempt. Output corrected JSON only.`,
    repairPrompt
  );
  const repairedValidation = validateDeterministicModelOutput({
    rawJson: repairedRaw,
    rail: args.rail,
    schema: args.schema
  });
  if (repairedValidation.ok) {
    return { ok: true, payload: repairedValidation.payload, repairUsed: true };
  }

  return { ok: false, issues: repairedValidation.issues, repairUsed: true };
};

export async function POST(request: Request) {
  const startedAt = Date.now();
  const supabase = getSupabaseRouteClient();
  const admin = getSupabaseServerAdminClientIfAvailable();
  if (!admin) {
    console.error("[BUILDER_GENERATE_CONFIG_MISSING]");
    return NextResponse.json({ error: "Builder generation is unavailable right now." }, { status: 500 });
  }
  let analyticsContext: {
    businessId?: string;
    siteId?: string;
    templateId?: string;
    niche?: string;
    policy?: unknown;
  } = {};

  try {
    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!(await userHasLaunchAccess(userData.user.id))) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const payload = await request.json().catch(() => null);
    const parsed = PayloadSchema.safeParse(payload);
    if (!parsed.success) {
      return NextResponse.json({ error: "Invalid payload", details: parsed.error.flatten() }, { status: 400 });
    }

    const input = parsed.data;
    const contentLanguage = normalizeContentLanguage(input.language);
    const qualityMode = normalizeQualityMode(input.qualityMode);
    const generationBrief = sanitizeGenerationBrief(input.brief, input.tone);
    analyticsContext = {
      businessId: input.businessId,
      siteId: input.siteId
    };
    const site = await getOwnedBuilderSite<{
      id: string;
      business_id: string;
      site_document: unknown;
      owner_user_id?: string | null;
    }>(input.siteId, userData.user.id, "id,business_id,site_document,owner_user_id");

    if (!site || site.business_id !== input.businessId) {
      return NextResponse.json({ error: "Site not found" }, { status: 404 });
    }

    const { plan: builderPlan, flags } = await getBuilderPlanForRoute(input.businessId);
    if (!flags.canRegenerate) {
      return NextResponse.json(
        {
          error: "Your current plan does not include website generation.",
          code: "PLAN_UPGRADE_REQUIRED",
          blocked: "website_builder",
          upgradeUrl: "/billing?blocked=website_builder"
        },
        { status: 403 }
      );
    }
    const isBundlePlan = builderPlan === "bundle";
    const canAttachChatbotEmbed = hasEntitlement(
      resolveEntitlements(builderPlan),
      "chatbot_embed"
    );
    const chatbotEmbedSrc = canAttachChatbotEmbed
      ? extractChatbotEmbedSrc(input.chatbotEmbedSnippet)
      : null;
    const openai = getOpenAIClient();
    const deterministicEnabled =
      isEnvTrue(process.env.SIROUNDCHAT_DETERMINISTIC_GENERATOR) &&
      !isEnvTrue(process.env.SIROUNDCHAT_DISABLE_DETERMINISTIC_GENERATOR);

    if (isIndustryV2Supported(input.industry, input.subtype, input.description)) {
      const industryV2Result = await generateIndustrySiteV2({
        input: {
          businessName: input.businessName,
          industry: input.industry,
          subtype: input.subtype ?? null,
          description: input.description,
          targetCustomer: input.targetCustomer ?? null,
          tone: input.tone,
          primaryColor: input.primaryColor ?? null,
          secondaryColor: input.secondaryColor ?? null,
          fontFamily: input.fontFamily ?? null,
          services: input.services?.filter(Boolean) ?? [],
          proofPoints: input.proofAssets?.length ? input.proofAssets : generationBrief.proofPoints,
          contact: input.contact ?? null,
          openingHours: input.openingHours ?? null,
          socials: input.socials ?? null,
          uploadedImages: input.uploadedImages ?? [],
          language: contentLanguage,
          qualityMode,
          brief: {
            audience: generationBrief.audience ?? input.targetCustomer ?? "local customers",
            coreOffer: generationBrief.coreOffer ?? input.description,
            primaryCtaGoal: generationBrief.primaryCtaGoal ?? input.ctaIntent ?? "contact",
            topServices: generationBrief.topServices?.length
              ? generationBrief.topServices
              : input.services?.filter(Boolean) ?? [],
            proofPoints: generationBrief.proofPoints ?? [],
            tone: generationBrief.tone ?? input.tone
          }
        },
        openai
      });

      if (!industryV2Result) {
        return NextResponse.json({ error: "Industry generation unavailable" }, { status: 500 });
      }

      const generatedWithBranding = withEmbeddedChatbotSnippet(
        withBundleChatbot(
          withLogoInSiteBrief(industryV2Result.siteDocument as Record<string, any>, {
            ...input,
            language: contentLanguage,
            brief: generationBrief
          }),
          isBundlePlan
        ),
        chatbotEmbedSrc
      );
      const legacyValidation = SiteDocumentSchema.safeParse(generatedWithBranding);
      if (!legacyValidation.success) {
        await emitGenerationEvent(supabase, {
          businessId: input.businessId,
          siteId: input.siteId,
          type: "site_generation_failed",
          metadata: {
            niche: input.industry,
            pipeline: "industry_v2",
            errors: legacyValidation.error.flatten()
          }
        });
        return NextResponse.json(
          { error: "Generated site failed legacy validation", issues: legacyValidation.error.flatten() },
          { status: 500 }
        );
      }

      const sectionTypes = new Set(
        legacyValidation.data.pages.flatMap((page) =>
          page.sections.filter((section) => section.enabled).map((section) => section.type)
        )
      );

      const { error: updateError } = await (admin as any)
        .from("builder_sites")
        .update({
          business_name: input.businessName,
          industry: input.industry,
          description: input.description,
          primary_color: input.primaryColor ?? legacyValidation.data.theme.primary,
          secondary_color: input.secondaryColor ?? legacyValidation.data.theme.bg,
          font_family: input.fontFamily ?? legacyValidation.data.theme.fontBody ?? null,
          logo_url: input.logoUrl ?? null,
          contact_email: input.contact?.email ?? null,
          contact_phone: input.contact?.phone ?? null,
          contact_address: input.contact?.address ?? null,
          template_id: legacyValidation.data.templateId,
          tone: input.tone,
          pages_mode: input.pagesMode,
          has_own_photos: Boolean(input.hasOwnPhotos),
          opening_hours: input.openingHours ?? null,
          socials: input.socials ?? {},
          content_language: contentLanguage,
          generation_brief: generationBrief,
          include_services: sectionTypes.has("services"),
          include_testimonials: sectionTypes.has("testimonials"),
          include_pricing: sectionTypes.has("pricing"),
          include_faq: sectionTypes.has("faq"),
          include_contact: sectionTypes.has("contact"),
          include_reservation: sectionTypes.has("reservation"),
          include_gallery: sectionTypes.has("gallery"),
          site_document: legacyValidation.data,
          template_key: selectTemplateKey(input.industry, legacyValidation.data.templateId)
        })
        .eq("id", input.siteId);

      if (updateError) {
        await emitGenerationEvent(supabase, {
          businessId: input.businessId,
          siteId: input.siteId,
          type: "site_generation_failed",
          metadata: {
            niche: input.industry,
            pipeline: "industry_v2",
            message: updateError.message
          }
        });
        return NextResponse.json({ error: "Failed to update site", message: updateError.message }, { status: 500 });
      }

      await emitGenerationEvent(supabase, {
        businessId: input.businessId,
        siteId: input.siteId,
        type: "site_generation_completed",
        metadata: {
          niche: input.industry,
          pipeline: "industry_v2",
          validation: industryV2Result.validation,
          meta: industryV2Result.meta
        }
      });

      return NextResponse.json({
        siteDocument: legacyValidation.data,
        meta: {
          ...industryV2Result.meta,
          validation: industryV2Result.validation,
          durationMs: Date.now() - startedAt
        }
      });
    }

    if (deterministicEnabled) {
      const nicheDescriptor = `${input.industry} ${input.subtype ?? ""}`.trim();
      const resolvedRail = resolveDeterministicTemplate(nicheDescriptor);
      const contract = buildGenerationContract(nicheDescriptor);
      const rail = contract.template;
      const selectedTemplateId = getPersistedTemplateIdForRail(rail);
      analyticsContext = {
        ...analyticsContext,
        niche: input.industry,
        templateId: selectedTemplateId,
        policy: { pipeline: DETERMINISTIC_PIPELINE, rail }
      };

      console.info("[GEN:deterministic] rail selected", {
        rail,
        pipeline: DETERMINISTIC_PIPELINE
      });

      await emitGenerationEvent(supabase, {
        businessId: input.businessId,
        siteId: input.siteId,
        type: "site_generation_started",
        metadata: {
          niche: input.industry,
          pipeline: DETERMINISTIC_PIPELINE,
          rail
        }
      });

      if (!openai) {
        await emitGenerationEvent(supabase, {
          businessId: input.businessId,
          siteId: input.siteId,
          type: "site_generation_failed",
          metadata: {
            niche: input.industry,
            pipeline: DETERMINISTIC_PIPELINE,
            rail,
            code: "OPENAI_UNAVAILABLE"
          }
        });
        return NextResponse.json(
          {
            error: "Deterministic generation unavailable",
            code: "OPENAI_UNAVAILABLE"
          },
          { status: 503 }
        );
      }

      const deterministicResult = await generateDeterministicPayload({
        openai,
        input,
        rail,
        prompt: contract.prompt,
        schema: contract.jsonSchema
      });

      if (!deterministicResult.ok) {
        const issues = sanitizeIssues(deterministicResult.issues);
        await emitGenerationEvent(supabase, {
          businessId: input.businessId,
          siteId: input.siteId,
          type: "site_generation_failed",
          metadata: {
            niche: input.industry,
            pipeline: DETERMINISTIC_PIPELINE,
            rail,
            repairUsed: deterministicResult.repairUsed,
            issues
          }
        });
        return NextResponse.json(
          {
            error: "Deterministic validation failed",
            code: "DETERMINISTIC_VALIDATION_FAILED",
            rail,
            issues
          },
          { status: 422 }
        );
      }

      if (deterministicResult.repairUsed) {
        console.info("[GEN:deterministic] repair path used", { rail });
      }

      const renderedHtml = renderDeterministicHtml(deterministicResult.payload);

      const deterministicLegacyDocument = buildLegacySiteDocumentFromDeterministic({
        input: {
          ...input,
          language: contentLanguage,
          qualityMode,
          brief: generationBrief
        },
        payload: deterministicResult.payload,
        rail,
        fixedOrder: contract.fixedSectionOrder,
        renderedHtml
      });

      const deterministicGeneratedWithBranding = withEmbeddedChatbotSnippet(
        withBundleChatbot(
          withLogoInSiteBrief(deterministicLegacyDocument as Record<string, any>, {
            ...input,
            language: contentLanguage,
            brief: generationBrief
          }),
          isBundlePlan
        ),
        chatbotEmbedSrc
      );
      const deterministicLegacyValidation = SiteDocumentSchema.safeParse(deterministicGeneratedWithBranding);
      if (!deterministicLegacyValidation.success) {
        await emitGenerationEvent(supabase, {
          businessId: input.businessId,
          siteId: input.siteId,
          type: "site_generation_failed",
          metadata: {
            niche: input.industry,
            pipeline: DETERMINISTIC_PIPELINE,
            rail,
            code: "LEGACY_SCHEMA_REJECTED"
          }
        });
        return NextResponse.json(
          {
            error: "Generated site failed legacy validation",
            code: "LEGACY_SCHEMA_REJECTED"
          },
          { status: 500 }
        );
      }

      const deterministicSectionTypes = new Set(
        deterministicLegacyValidation.data.pages.flatMap((page) =>
          page.sections.filter((section) => section.enabled).map((section) => section.type)
        )
      );

      const { error: deterministicUpdateError } = await (admin as any)
        .from("builder_sites")
        .update({
          business_name: input.businessName,
          industry: input.industry,
          description: input.description,
          primary_color: input.primaryColor ?? deterministicLegacyValidation.data.theme.primary,
          secondary_color: input.secondaryColor ?? deterministicLegacyValidation.data.theme.bg,
          font_family: input.fontFamily ?? deterministicLegacyValidation.data.theme.fontBody ?? null,
          logo_url: input.logoUrl ?? null,
          contact_email: input.contact?.email ?? null,
          contact_phone: input.contact?.phone ?? null,
          contact_address: input.contact?.address ?? null,
          template_id: deterministicLegacyValidation.data.templateId,
          tone: input.tone,
          pages_mode: input.pagesMode,
          has_own_photos: Boolean(input.hasOwnPhotos),
          opening_hours: input.openingHours ?? null,
          socials: input.socials ?? {},
          content_language: contentLanguage,
          generation_brief: generationBrief,
          include_services: deterministicSectionTypes.has("services"),
          include_testimonials: deterministicSectionTypes.has("testimonials"),
          include_pricing: deterministicSectionTypes.has("pricing"),
          include_faq: deterministicSectionTypes.has("faq"),
          include_contact: deterministicSectionTypes.has("contact"),
          include_reservation: deterministicSectionTypes.has("reservation"),
          include_gallery: deterministicSectionTypes.has("gallery"),
          site_document: deterministicLegacyValidation.data,
          template_key: selectTemplateKey(input.industry, deterministicLegacyValidation.data.templateId)
        })
        .eq("id", input.siteId);

      if (deterministicUpdateError) {
        await emitGenerationEvent(supabase, {
          businessId: input.businessId,
          siteId: input.siteId,
          type: "site_generation_failed",
          metadata: {
            niche: input.industry,
            pipeline: DETERMINISTIC_PIPELINE,
            rail,
            code: "SITE_UPDATE_FAILED",
            message: deterministicUpdateError.message
          }
        });
        return NextResponse.json(
          { error: "Failed to update site", message: deterministicUpdateError.message },
          { status: 500 }
        );
      }

      await emitGenerationEvent(supabase, {
        businessId: input.businessId,
        siteId: input.siteId,
        type: "site_generation_completed",
        metadata: {
          niche: input.industry,
          pipeline: DETERMINISTIC_PIPELINE,
          rail,
          repairUsed: deterministicResult.repairUsed
        }
      });

      return NextResponse.json({
        siteDocument: deterministicLegacyValidation.data,
        meta: {
          pipeline: DETERMINISTIC_PIPELINE,
          rail,
          resolvedRail: resolvedRail.template,
          repairUsed: deterministicResult.repairUsed,
          fixedSectionOrder: contract.fixedSectionOrder,
          durationMs: Date.now() - startedAt
        }
      });
    }

    if (isV0LikePipelineEnabled()) {
      const rawPrompt = buildRawPromptFromInput(input);
      analyticsContext = {
        ...analyticsContext,
        niche: input.industry,
        policy: { pipeline: "v0_like" }
      };

      await emitGenerationEvent(supabase, {
        businessId: input.businessId,
        siteId: input.siteId,
        type: "site_generation_started",
        metadata: {
          niche: input.industry,
          pipeline: "v0_like"
        }
      });

      const v0LikeResult = await runV0LikeGenerationPipeline({
        rawPrompt,
        metadata: {
          businessName: input.businessName,
          logoUrl: input.logoUrl,
          category: input.industry,
          industry: input.industry,
          subtype: input.subtype,
          description: input.description,
          tone: input.tone,
          primaryColor: input.primaryColor,
          secondaryColor: input.secondaryColor,
          fontFamily: input.fontFamily,
          includePricing: input.features?.includePricing,
          targetCustomer: input.targetCustomer,
          services: input.services,
          language: contentLanguage,
          brief: generationBrief
        },
        openai,
        runCommandChecks: process.env.SIROUNDCHAT_V0LIKE_RUN_COMMAND_CHECKS === "1",
        qualityMode
      });

      if (!v0LikeResult.ok) {
        await emitGenerationEvent(supabase, {
          businessId: input.businessId,
          siteId: input.siteId,
          type: "site_generation_failed",
          metadata: {
            niche: input.industry,
            pipeline: "v0_like",
            stage: v0LikeResult.error.stage,
            attempts: v0LikeResult.error.attempts,
            errors: v0LikeResult.error.errors
          }
        });
        return NextResponse.json(
          {
            error: "V0-like generation failed",
            details: v0LikeResult.error
          },
          { status: 500 }
        );
      }

      if (!v0LikeResult.quality.passed) {
        await emitGenerationEvent(supabase, {
          businessId: input.businessId,
          siteId: input.siteId,
          type: "site_generation_failed",
          metadata: {
            niche: input.industry,
            pipeline: "v0_like",
            code: "QUALITY_THRESHOLD_FAILED",
            quality: v0LikeResult.quality
          }
        });
        return NextResponse.json(
          {
            error: "Generated output did not meet the quality threshold",
            code: "QUALITY_THRESHOLD_FAILED",
            quality: v0LikeResult.quality
          },
          { status: 422 }
        );
      }

      const generatedWithBranding = withEmbeddedChatbotSnippet(
        withBundleChatbot(
          withLogoInSiteBrief(v0LikeResult.rendered.siteDocument as Record<string, any>, {
            ...input,
            language: contentLanguage,
            brief: generationBrief
          }),
          isBundlePlan
        ),
        chatbotEmbedSrc
      );
      const legacyValidation = SiteDocumentSchema.safeParse(generatedWithBranding);
      if (!legacyValidation.success) {
        await emitGenerationEvent(supabase, {
          businessId: input.businessId,
          siteId: input.siteId,
          type: "site_generation_failed",
          metadata: {
            niche: input.industry,
            pipeline: "v0_like",
            errors: legacyValidation.error.flatten()
          }
        });
        return NextResponse.json(
          { error: "Generated site failed legacy validation", issues: legacyValidation.error.flatten() },
          { status: 500 }
        );
      }

      const sectionTypes = new Set(
        legacyValidation.data.pages.flatMap((page) =>
          page.sections.filter((section) => section.enabled).map((section) => section.type)
        )
      );

      const { error: updateError } = await (admin as any)
        .from("builder_sites")
        .update({
          business_name: input.businessName,
          industry: input.industry,
          description: input.description,
          primary_color: input.primaryColor ?? legacyValidation.data.theme.primary,
          secondary_color: input.secondaryColor ?? legacyValidation.data.theme.bg,
          font_family: input.fontFamily ?? legacyValidation.data.theme.fontBody ?? null,
          logo_url: input.logoUrl ?? null,
          contact_email: input.contact?.email ?? null,
          contact_phone: input.contact?.phone ?? null,
          contact_address: input.contact?.address ?? null,
          template_id: legacyValidation.data.templateId,
          tone: input.tone,
          pages_mode: input.pagesMode,
          has_own_photos: Boolean(input.hasOwnPhotos),
          opening_hours: input.openingHours ?? null,
          socials: input.socials ?? {},
          content_language: contentLanguage,
          generation_brief: generationBrief,
          include_services: sectionTypes.has("services"),
          include_testimonials: sectionTypes.has("testimonials"),
          include_pricing: sectionTypes.has("pricing"),
          include_faq: sectionTypes.has("faq"),
          include_contact: sectionTypes.has("contact"),
          include_reservation: false,
          include_gallery: sectionTypes.has("gallery"),
          site_document: legacyValidation.data,
          template_key: selectTemplateKey(input.industry, legacyValidation.data.templateId)
        })
        .eq("id", input.siteId);

      if (updateError) {
        await emitGenerationEvent(supabase, {
          businessId: input.businessId,
          siteId: input.siteId,
          type: "site_generation_failed",
          metadata: {
            niche: input.industry,
            pipeline: "v0_like",
            message: updateError.message
          }
        });
        return NextResponse.json({ error: "Failed to update site", message: updateError.message }, { status: 500 });
      }

      await emitGenerationEvent(supabase, {
        businessId: input.businessId,
        siteId: input.siteId,
        type: "site_generation_completed",
        metadata: {
          niche: input.industry,
          pipeline: "v0_like",
          checksOk: v0LikeResult.checks.ok,
          quality: v0LikeResult.quality
        }
      });

      return NextResponse.json({
        siteDocument: legacyValidation.data,
        meta: {
          pipeline: "v0_like",
          checks: v0LikeResult.checks,
          plan: v0LikeResult.plan,
          intake: v0LikeResult.intake,
          quality: v0LikeResult.quality,
          generatedFiles: v0LikeResult.rendered.files.map((file) => file.path),
          durationMs: Date.now() - startedAt
        }
      });
    }

    const intake: GenerationIntake = {
      businessName: input.businessName,
      businessType: input.industry,
      subtype: input.subtype ?? null,
      location: input.contact?.address ?? null,
      services: input.services?.filter(Boolean) ?? [],
      targetCustomer: input.targetCustomer ?? null,
      toneProfile: normalizeToneProfile(input.tone),
      ctaIntent: inferCtaIntent(input),
      proofAssets:
        input.proofAssets?.length ? input.proofAssets : generationBrief.proofPoints,
      photosAvailable: Boolean(input.hasOwnPhotos),
      description: input.description,
      uploadedImages: input.uploadedImages ?? []
    };

    const policy = getGenerationPolicy(intake.businessType, intake.subtype, intake.ctaIntent);
    analyticsContext = {
      ...analyticsContext,
      niche: intake.businessType,
      policy
    };

    await emitGenerationEvent(supabase, {
      businessId: input.businessId,
      siteId: input.siteId,
      type: "site_generation_started",
      metadata: {
        niche: intake.businessType,
        policy
      }
    });

    const plannedCandidates = await buildGenerationPlanCandidates(
      intake,
      policy,
      openai,
      policy.conversion_first ? 2 : 3
    );
    const candidatePlans = plannedCandidates.map((plan) => applyFeatureSelection(plan, input.features));

    let bestCandidate: Awaited<ReturnType<typeof evaluateCandidatePlan>> | null = null;
    const evaluatedCandidates: Array<{
      templateId: string;
      score: number;
      rankingScore: number;
      autoFail: boolean;
      gates: string[];
      validationOk: boolean;
      regensCount: number;
    }> = [];

    for (const candidate of candidatePlans) {
      const evaluated = await evaluateCandidatePlan(candidate, intake, policy, openai);
      evaluatedCandidates.push({
        templateId: evaluated.generated.templateId,
        score: evaluated.score.total,
        rankingScore: evaluated.rankingScore,
        autoFail: evaluated.score.autoFail,
        gates: evaluated.score.gates,
        validationOk: evaluated.validation.ok,
        regensCount: evaluated.regensCount
      });
      if (!bestCandidate || evaluated.rankingScore > bestCandidate.rankingScore) {
        bestCandidate = evaluated;
      }
    }

    if (!bestCandidate) {
      return NextResponse.json({ error: "No viable generation candidates" }, { status: 500 });
    }

    analyticsContext = {
      ...analyticsContext,
      templateId: bestCandidate.generated.templateId
    };

    await emitGenerationEvent(supabase, {
      businessId: input.businessId,
      siteId: input.siteId,
      type: "site_template_selected",
      metadata: {
        templateId: bestCandidate.generated.templateId,
        niche: intake.businessType,
        policy,
        candidates: evaluatedCandidates
      }
    });
    let generated = bestCandidate.generated;
    let validation = bestCandidate.validation;
    let regensCount = bestCandidate.regensCount;
    let score = bestCandidate.score;

    await emitGenerationEvent(supabase, {
      businessId: input.businessId,
      siteId: input.siteId,
      type: "site_generation_validated",
      metadata: {
        templateId: generated.templateId,
        niche: intake.businessType,
        ok: validation.ok,
        errorsGlobal: validation.errorsGlobal.length,
        errorsSections: Object.keys(validation.errorsBySectionId).length,
        WQS: score.total,
        rankingScore: bestCandidate.rankingScore
      }
    });
    if (regensCount > 0) {
      await emitGenerationEvent(supabase, {
        businessId: input.businessId,
        siteId: input.siteId,
        type: "site_generation_partial_regen",
        metadata: {
          templateId: generated.templateId,
          niche: intake.businessType,
          regensCount,
          okAfterRegen: validation.ok
        }
      });
    }
    const finalLegacyDocument = toLegacySiteDocument(generated, intake.businessName);
    const generatedWithBranding = withEmbeddedChatbotSnippet(
      withBundleChatbot(
        withLogoInSiteBrief(finalLegacyDocument as Record<string, any>, {
          ...input,
          language: contentLanguage,
          brief: generationBrief
        }),
        isBundlePlan
      ),
      chatbotEmbedSrc
    );
    const legacyValidation = SiteDocumentSchema.safeParse(generatedWithBranding);

    if (!legacyValidation.success) {
      await emitGenerationEvent(supabase, {
        businessId: input.businessId,
        siteId: input.siteId,
        type: "site_generation_failed",
        metadata: {
          templateId: generated.templateId,
          niche: intake.businessType,
          errors: legacyValidation.error.flatten()
        }
      });
      return NextResponse.json({ error: "Generated site failed legacy validation" }, { status: 500 });
    }

    const sectionTypes = new Set(
      legacyValidation.data.pages.flatMap((page) => page.sections.filter((section) => section.enabled).map((section) => section.type))
    );

    const { error: updateError } = await (admin as any)
      .from("builder_sites")
      .update({
        business_name: input.businessName,
        industry: input.industry,
        description: input.description,
        primary_color: input.primaryColor ?? legacyValidation.data.theme.primary,
        secondary_color: input.secondaryColor ?? legacyValidation.data.theme.bg,
        font_family: input.fontFamily ?? legacyValidation.data.theme.fontBody ?? null,
        logo_url: input.logoUrl ?? null,
        contact_email: input.contact?.email ?? null,
        contact_phone: input.contact?.phone ?? null,
        contact_address: input.contact?.address ?? null,
        template_id: legacyValidation.data.templateId,
        tone: input.tone,
        pages_mode: input.pagesMode,
        has_own_photos: Boolean(input.hasOwnPhotos),
        opening_hours: input.openingHours ?? null,
        socials: input.socials ?? {},
        content_language: contentLanguage,
        generation_brief: generationBrief,
        include_services: sectionTypes.has("services"),
        include_testimonials: sectionTypes.has("testimonials"),
        include_pricing: sectionTypes.has("pricing"),
        include_faq: sectionTypes.has("faq"),
        include_contact: sectionTypes.has("contact"),
        include_reservation: false,
        include_gallery: sectionTypes.has("gallery"),
        site_document: legacyValidation.data,
        template_key: selectTemplateKey(input.industry, legacyValidation.data.templateId)
      })
      .eq("id", input.siteId);

    if (updateError) {
      await emitGenerationEvent(supabase, {
        businessId: input.businessId,
        siteId: input.siteId,
        type: "site_generation_failed",
        metadata: {
          templateId: generated.templateId,
          niche: intake.businessType,
          message: updateError.message
        }
      });
      return NextResponse.json({ error: "Failed to update site", message: updateError.message }, { status: 500 });
    }

    await emitGenerationEvent(supabase, {
      businessId: input.businessId,
      siteId: input.siteId,
      type: "site_generation_completed",
      metadata: {
        templateId: generated.templateId,
        niche: intake.businessType,
        WQS: score.total,
        regensCount,
        policy,
        autoFail: score.autoFail,
        gates: score.gates
      }
    });

    return NextResponse.json({
      siteDocument: legacyValidation.data,
      meta: {
        templateId: generated.templateId,
        niche: intake.businessType,
        WQS: score.total,
        regensCount,
        policy,
        score,
        validation,
        durationMs: Date.now() - startedAt
      }
    });
  } catch (error: any) {
    if (analyticsContext.businessId && analyticsContext.siteId) {
      await emitGenerationEvent(supabase, {
        businessId: analyticsContext.businessId,
        siteId: analyticsContext.siteId,
        type: "site_generation_failed",
        metadata: {
          templateId: analyticsContext.templateId ?? null,
          niche: analyticsContext.niche ?? null,
          policy: analyticsContext.policy ?? null,
          message: error?.message ?? "Unknown error"
        }
      });
    }
    console.error("[GEN] failed", error);
    return NextResponse.json(
      {
        error: "Generate route failed",
        message: error?.message ?? "Unknown error"
      },
      { status: 500 }
    );
  }
}

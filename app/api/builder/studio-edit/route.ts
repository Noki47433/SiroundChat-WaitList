import { NextResponse } from "next/server";
import { z } from "zod";
import { BRAND_ARCHETYPES } from "@/lib/builder/generation/v2/archetypes";
import { LAYOUT_DNA_REGISTRY } from "@/lib/builder/generation/v2/layout-dna";
import { getOpenAIClient } from "@/lib/ai/client";
import {
  inferBuilderImageSlot,
  isMissingBuilderAssetSlotColumnError,
  normalizeBuilderImageSlot
} from "@/lib/builder/site-assets";
import { buildSectionPatch } from "@/lib/builder/generation/patch";
import { getGenerationPolicy } from "@/lib/builder/generation/policy";
import type { GenerationIntake } from "@/lib/builder/generation/types";
import { getOwnedBuilderSite } from "@/lib/builder/site-access";
import { refineRestaurantTemplateContent } from "@/lib/builder/template-sites/content";
import {
  applyDeterministicIntegratedTemplateEdit,
  type SectionKey
} from "@/lib/builder/template-sites/editor";
import { resolveTemplateImages, shouldRefreshTemplateImages } from "@/lib/builder/template-sites/images";
import { mapIntegratedTemplateData } from "@/lib/builder/template-sites/mappers";
import { buildIntegratedTemplateTheme } from "@/lib/builder/template-sites/palette";
import {
  parseIntegratedTemplateSiteDocument,
  type IntegratedTemplateSiteDocument
} from "@/lib/builder/template-sites/schema";
import {
  buildUpgradeRequiredResponse,
  getBusinessEntitlementAccess
} from "@/lib/server/billing-access";
import { userHasLaunchAccess } from "@/lib/server/launch-access";
import { getSupabaseRouteClient } from "@/lib/supabase/server";
import { getSupabaseServerAdminClient } from "@/lib/supabase/serverAdmin";
import { buildTheme } from "@/lib/website-builder/editor/theme";
import { SiteDocumentSchema } from "@/lib/website-builder/schema";
import { resolveThemeFontPair } from "@/lib/website-builder/theme/fonts";
import type { ContentStyle, SiteDocument, SiteSection } from "@/lib/website-builder/types";
import {
  appendStudioRefinementToSiteDocument,
  attachStudioMetadataToSiteDocument,
  resolveStudioGenerationSpec
} from "@/lib/website-studio/normalize";
import { logStudioVariationSnapshot } from "@/lib/website-studio/dev";
import {
  createStudioGenerationProvider,
  getCurrentStudioProviderMetadata
} from "@/lib/website-studio/providers";
import { classifyStudioRefinementRequest } from "@/lib/website-studio/refinement";
import type { StudioRefinementPlan } from "@/lib/website-studio/schema";
import { routeWebsiteEditRequest } from "@/lib/website-builder/ai/website-edit-router";
import { generateIntegratedPage } from "@/lib/website-builder/ai/page-generator";
import { injectNavigationItemsIntoTemplateData, normalizePageSlug } from "@/lib/builder/template-sites/nav-inject";
import type { IntegratedTemplatePage, NavigationItem } from "@/lib/builder/template-sites/schema";

export const runtime = "nodejs";

const REFINEMENT_DUPLICATE_WINDOW_MS = 60_000;

const PayloadSchema = z.object({
  siteId: z.string().uuid(),
  prompt: z.string().trim().min(1),
  thinkMode: z.boolean().optional().default(false)
});

const MAX_REFERENCE_IMAGES = 3;
const MAX_REFERENCE_IMAGE_SIZE = 8 * 1024 * 1024;
const ALLOWED_REFERENCE_IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);

type StudioEditReferenceImage = File;

const ReservationPatchSchema = z.object({
  title: z.string().trim().min(1),
  body: z.string().trim().min(1),
  ctaLabel: z.string().trim().min(1).optional(),
  ctaHref: z.string().trim().min(1).optional()
});

const isFile = (value: unknown): value is File => {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as {
    arrayBuffer?: unknown;
    size?: unknown;
    type?: unknown;
    name?: unknown;
  };
  return (
    typeof candidate.arrayBuffer === "function" &&
    typeof candidate.size === "number" &&
    typeof candidate.type === "string" &&
    typeof candidate.name === "string"
  );
};

const parseThinkMode = (value: unknown) =>
  value === true || value === "true" || value === "1" || value === 1;

const readStudioEditPayload = async (
  request: Request
): Promise<
  | {
      ok: true;
      payload: {
        siteId: string;
        prompt: string;
        thinkMode: boolean;
        referenceImages: StudioEditReferenceImage[];
      };
    }
  | { ok: false; response: NextResponse }
> => {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData().catch(() => null);
    if (!formData) {
      return {
        ok: false,
        response: NextResponse.json({ error: "Invalid payload" }, { status: 400 })
      };
    }

    const parsed = PayloadSchema.safeParse({
      siteId: formData.get("siteId"),
      prompt: formData.get("prompt"),
      thinkMode: parseThinkMode(formData.get("thinkMode"))
    });
    if (!parsed.success) {
      return {
        ok: false,
        response: NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
      };
    }

    const referenceImages = formData
      .getAll("files")
      .filter(isFile)
      .slice(0, MAX_REFERENCE_IMAGES);
    const invalidImage = referenceImages.find(
      (file) =>
        !ALLOWED_REFERENCE_IMAGE_TYPES.has(file.type) ||
        file.size > MAX_REFERENCE_IMAGE_SIZE
    );
    if (invalidImage) {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error:
              "Reference images must be PNG, JPEG, or WebP and smaller than 8MB."
          },
          { status: 400 }
        )
      };
    }

    return {
      ok: true,
      payload: {
        ...parsed.data,
        referenceImages
      }
    };
  }

  const payload = await request.json().catch(() => null);
  const parsed = PayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return {
      ok: false,
      response: NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
    };
  }

  return {
    ok: true,
    payload: {
      ...parsed.data,
      referenceImages: []
    }
  };
};

const analyzeEditReferenceImages = async (
  openai: NonNullable<ReturnType<typeof getOpenAIClient>>,
  args: {
    prompt: string;
    referenceImages: StudioEditReferenceImage[];
    thinkMode: boolean;
  }
) => {
  if (!args.referenceImages.length) return null;

  const imageParts = await Promise.all(
    args.referenceImages.map(async (file) => {
      const bytes = Buffer.from(await file.arrayBuffer());
      return {
        type: "image_url" as const,
        image_url: {
          url: `data:${file.type};base64,${bytes.toString("base64")}`
        }
      };
    })
  );

  const preferredModel = args.thinkMode ? "gpt-4o" : "gpt-4o-mini";
  const fallbackModel = "gpt-4o-mini";
  const messages = [
    {
      role: "system" as const,
      content:
        "You analyze website editor screenshots or reference images. Return short actionable website edit instructions only. Prefer imperative phrasing that can be directly applied, such as 'make hero text white', 'make background dark', 'center text', 'increase spacing', 'tighten section spacing', 'replace hero image with a darker dining photo'. If there is an overlap, readability, or contrast failure, call it out directly and name the section, for example 'fix faq contrast with dark text on a lighter surface' or 'prevent desktop nav overlap in the preview'. Mention only concrete visible changes."
    },
    {
      role: "user" as const,
      content: [
        {
          type: "text" as const,
          text: [
            `User request: ${args.prompt}`,
            "Review the attached screenshots or reference images.",
            "Respond with 3 to 6 short edit instructions.",
            "Focus on layout, color, typography, imagery, and emphasis changes that should be made to the site."
          ].join("\n")
        },
        ...imageParts
      ]
    }
  ];

  try {
    const completion = await openai.chat.completions.create({
      model: preferredModel,
      temperature: 0.1,
      messages
    });
    return completion.choices[0]?.message?.content?.trim() ?? null;
  } catch (error) {
    if (preferredModel === fallbackModel) {
      throw error;
    }
    const fallback = await openai.chat.completions.create({
      model: fallbackModel,
      temperature: 0.1,
      messages
    });
    return fallback.choices[0]?.message?.content?.trim() ?? null;
  }
};

const summarizeReferenceGuidance = (value: string | null) =>
  (value ?? "")
    .split(/\n+/)
    .map((line) => line.replace(/^[-*0-9.)\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 6);

const serializeTargetSection = (
  content: IntegratedTemplateSiteDocument["content"],
  targetSection: SectionKey | null
) => {
  switch (targetSection) {
    case "hero":
      return JSON.stringify(content.hero);
    case "story":
      return JSON.stringify(content.story);
    case "highlights":
      return JSON.stringify(content.highlights);
    case "experience":
      return JSON.stringify(content.experience);
    case "faq":
      return JSON.stringify(content.faq);
    case "menu":
      return JSON.stringify(content.menu ?? null);
    case "contact":
      return JSON.stringify(content.contact);
    case "reservation":
      return JSON.stringify(content.reservation);
    case "footer":
      return JSON.stringify(content.footer);
    default:
      return JSON.stringify(content);
  }
};

const hasMaterialContentChange = (
  before: IntegratedTemplateSiteDocument["content"],
  after: IntegratedTemplateSiteDocument["content"],
  targetSection: SectionKey | null
) => serializeTargetSection(before, targetSection) !== serializeTargetSection(after, targetSection);

const hasMaterialDocumentChange = (args: {
  beforeContent: IntegratedTemplateSiteDocument["content"];
  afterContent: IntegratedTemplateSiteDocument["content"];
  targetSection: SectionKey | null;
  beforeSettings: IntegratedTemplateSiteDocument["editorSettings"] | undefined;
  afterSettings: IntegratedTemplateSiteDocument["editorSettings"] | undefined;
}) =>
  hasMaterialContentChange(args.beforeContent, args.afterContent, args.targetSection) ||
  JSON.stringify(args.beforeSettings ?? {}) !== JSON.stringify(args.afterSettings ?? {});

const buildEscalatedInstruction = (instruction: string, targetSection: SectionKey | null) =>
  [
    instruction,
    targetSection
      ? `The ${targetSection} section is still not fixed. Replace that section completely and make the improvement unmistakable.`
      : "The last edit attempt was too weak. Make the requested change unmistakable.",
    "Do not return content that is effectively unchanged."
  ]
    .filter(Boolean)
    .join("\n\n");

const THEME_HINTS = [
  {
    id: "premium_dark",
    archetypeId: "premium_fine_dining",
    layoutId: "immersive_stack",
    fontId: "cormorant",
    matches: ["dark", "premium", "luxury", "luxurious", "elegant", "dramatic", "moody", "contrast"],
    variants: { hero: "B", gallery: "D", testimonials: "D", reservation: "C", contact: "D" }
  },
  {
    id: "warm_story",
    archetypeId: "cozy_family_dining",
    layoutId: "centered_story",
    fontId: "playfair",
    matches: ["warm", "cozy", "friendly", "family", "inviting", "welcoming", "comfort"],
    variants: { hero: "D", about: "F", services: "F", reservation: "C", gallery: "E", testimonials: "E", contact: "E" }
  },
  {
    id: "modern_clean",
    archetypeId: "premium_fine_dining",
    layoutId: "split_showcase",
    fontId: "jakarta",
    matches: ["modern", "clean", "minimal", "refined", "sleek", "reduce clutter", "cleaner"],
    variants: { hero: "A", about: "D", services: "D", gallery: "B", testimonials: "C", reservation: "A", contact: "F" }
  }
] as const;

const COPY_PROMPT_HINTS = [
  "headline",
  "subheadline",
  "copy",
  "rewrite",
  "wording",
  "text",
  "story",
  "description",
  "cta",
  "title",
  "body"
];
const STYLE_PROMPT_HINTS = [
  "dark",
  "premium",
  "luxury",
  "luxurious",
  "elegant",
  "modern",
  "warm",
  "welcoming",
  "contrast",
  "refined",
  "clean",
  "cleaner",
  "clutter",
  "typography",
  "font",
  "spacing",
  "prominent",
  "harder",
  "trustworthy"
];
const IMAGE_CHANGE_HINTS = [
  "new image",
  "new images",
  "replace image",
  "replace the image",
  "replace hero image",
  "replace the hero image",
  "replace gallery image",
  "replace the gallery image",
  "change image",
  "change images",
  "different photo",
  "different photos",
  "regenerate image",
  "regenerate images"
];
const HEAVY_REGEN_HINTS = ["regenerate site", "redo the site", "reimagine the site", "full redesign"];

const SECTION_HINTS: Array<{
  sectionType: SiteSection["type"];
  keywords: string[];
}> = [
  { sectionType: "hero", keywords: ["hero", "headline", "above the fold"] },
  { sectionType: "gallery", keywords: ["gallery", "images", "imagery", "photos"] },
  { sectionType: "reservation", keywords: ["reservation", "reservations", "booking", "book table"] },
  { sectionType: "testimonials", keywords: ["testimonial", "testimonials", "reviews", "social proof"] },
  { sectionType: "contact", keywords: ["contact", "hours", "location", "address", "email", "phone"] },
  { sectionType: "about", keywords: ["about", "story", "intro"] },
  { sectionType: "services", keywords: ["menu", "dish", "dishes", "signature", "specialties"] },
  { sectionType: "footer", keywords: ["footer"] }
];

const includesAny = (value: string, terms: readonly string[]) =>
  terms.some((term) => value.includes(term));

const resolvePromptKind = (prompt: string) => {
  const normalized = prompt.toLowerCase();
  return {
    normalized,
    isCopyFocused: includesAny(normalized, COPY_PROMPT_HINTS),
    isStyleFocused: includesAny(normalized, STYLE_PROMPT_HINTS),
    isImageChangeRequested: includesAny(normalized, IMAGE_CHANGE_HINTS),
    isHeavyRegenerationRequested: includesAny(normalized, HEAVY_REGEN_HINTS)
  };
};

const toIntake = (site: any, doc: any): GenerationIntake => {
  const brief = doc.siteBrief ?? {};
  const generationBrief =
    brief.generationBrief && typeof brief.generationBrief === "object"
      ? (brief.generationBrief as Record<string, unknown>)
      : site.generation_brief && typeof site.generation_brief === "object"
        ? (site.generation_brief as Record<string, unknown>)
        : {};
  const topServices = Array.isArray(generationBrief.topServices)
    ? generationBrief.topServices.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const proofPoints = Array.isArray(generationBrief.proofPoints)
    ? generationBrief.proofPoints.filter((item): item is string => typeof item === "string" && item.trim().length > 0)
    : [];
  const primaryCtaGoal =
    typeof generationBrief.primaryCtaGoal === "string" ? generationBrief.primaryCtaGoal : null;

  return {
    businessName: brief.businessName ?? site.business_name ?? "Business",
    businessType: brief.industry ?? site.industry ?? "service",
    subtype: null,
    location: site.contact_address ?? null,
    services: topServices,
    targetCustomer:
      typeof generationBrief.audience === "string" && generationBrief.audience.trim().length > 0
        ? generationBrief.audience.trim()
        : null,
    toneProfile: "professional",
    ctaIntent:
      primaryCtaGoal === "book_appointment" ||
      primaryCtaGoal === "book_call" ||
      primaryCtaGoal === "reserve_table"
        ? "reserve"
        : primaryCtaGoal === "request_demo"
          ? "demo"
          : primaryCtaGoal === "buy_now"
            ? "buy"
            : "contact",
    proofAssets: proofPoints,
    photosAvailable: Boolean(site.has_own_photos),
    description:
      (typeof generationBrief.coreOffer === "string" && generationBrief.coreOffer.trim().length > 0
        ? generationBrief.coreOffer.trim()
        : brief.description) ??
      site.description ??
      "",
    uploadedImages: (doc.mediaLibrary ?? []).map((image: any) => ({
      src: image.src,
      alt: image.alt,
      width: image.width,
      height: image.height
    }))
  };
};

const isRecentTimestamp = (value?: string | null, windowMs = REFINEMENT_DUPLICATE_WINDOW_MS) => {
  if (!value) return false;
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return false;
  return Date.now() - timestamp <= windowMs;
};

const hasRecentMatchingRefinement = (
  document: z.infer<typeof SiteDocumentSchema>,
  refinementPlan: StudioRefinementPlan
) => {
  const latest = document.siteBrief?.studio?.refinements?.at(-1);
  if (!latest) return false;
  if (!isRecentTimestamp(latest.createdAt)) return false;
  return (
    latest.request === refinementPlan.request &&
    latest.scope === refinementPlan.scope &&
    latest.target.sectionId === refinementPlan.target.sectionId &&
    latest.target.pageId === refinementPlan.target.pageId &&
    latest.target.sectionType === refinementPlan.target.sectionType
  );
};

const resolveSectionTarget = (document: z.infer<typeof SiteDocumentSchema>, prompt: string) => {
  const normalized = prompt.toLowerCase();
  for (const hint of SECTION_HINTS) {
    if (!hint.keywords.some((keyword) => normalized.includes(keyword))) continue;
    for (const page of document.pages) {
      const match = page.sections.find((section) => section.type === hint.sectionType);
      if (match) {
        return {
          pageId: page.id,
          sectionId: match.id,
          sectionType: match.type
        };
      }
    }
  }
  return {
    pageId: document.pages[0]?.id ?? null,
    sectionId: null,
    sectionType: null
  };
};

const buildReservationPatch = async (
  section: SiteSection,
  prompt: string,
  intake: GenerationIntake,
  openai: ReturnType<typeof getOpenAIClient>
) => {
  const fallback = {
    title: String(section.content?.title ?? "Plan your visit"),
    body: String(section.content?.body ?? "Make it easy to reserve a table."),
    ctaLabel: String(section.content?.ctaLabel ?? "Reserve a table"),
    ctaHref: String(section.content?.ctaHref ?? "#reservations")
  };

  if (!openai) return fallback;

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.35,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content:
            "You rewrite reservation website copy. Return JSON only with keys: title, body, ctaLabel, ctaHref."
        },
        {
          role: "user",
          content: [
            `Instruction: ${prompt}`,
            `Business: ${intake.businessName}`,
            `Description: ${intake.description}`,
            `Current reservation content: ${JSON.stringify(fallback)}`
          ].join("\n")
        }
      ]
    });

    const raw = completion.choices[0]?.message?.content ?? "";
    const parsed = ReservationPatchSchema.safeParse(JSON.parse(raw));
    if (!parsed.success) return fallback;
    return {
      title: parsed.data.title,
      body: parsed.data.body,
      ctaLabel: parsed.data.ctaLabel ?? fallback.ctaLabel,
      ctaHref: parsed.data.ctaHref ?? fallback.ctaHref
    };
  } catch {
    return fallback;
  }
};

const applySectionContentPatch = (
  document: z.infer<typeof SiteDocumentSchema>,
  sectionId: string,
  patch: Record<string, unknown>
) => {
  return {
    ...document,
    pages: document.pages.map((page) => ({
      ...page,
      sections: page.sections.map((section) =>
        section.id === sectionId
          ? {
              ...section,
              content: {
                ...section.content,
                ...patch
              }
            }
          : section
      )
    }))
  };
};

const selectThemeDirection = (
  prompt: string,
  currentSpec: ReturnType<typeof resolveStudioGenerationSpec>,
  document: z.infer<typeof SiteDocumentSchema>
) => {
  const normalized = prompt.toLowerCase();
  const matched = THEME_HINTS.find((entry) => entry.matches.some((term) => normalized.includes(term)));
  const currentArchetypeId = document.siteBrief?.designDNA?.archetypeKey;
  const currentLayoutId = document.siteBrief?.designDNA?.layoutDNA;
  const archetype =
    BRAND_ARCHETYPES.find((entry) => entry.id === matched?.archetypeId) ??
    BRAND_ARCHETYPES.find((entry) => entry.id === currentArchetypeId) ??
    BRAND_ARCHETYPES.find((entry) => entry.id === "cozy_family_dining");
  const layout =
    LAYOUT_DNA_REGISTRY.find((entry) => entry.id === matched?.layoutId) ??
    LAYOUT_DNA_REGISTRY.find((entry) => entry.id === currentLayoutId) ??
    LAYOUT_DNA_REGISTRY.find((entry) => entry.id === archetype?.preferredLayoutIds[0]) ??
    LAYOUT_DNA_REGISTRY.find((entry) => entry.id === "editorial_stack");
  const fontPair = resolveThemeFontPair(matched?.fontId ?? archetype?.fontPair.heading ?? currentSpec.theme.fontFamily);
  const variantBias: Partial<Record<SiteSection["type"], string>> = {
    ...(Object.fromEntries(
      Object.entries(layout?.sectionVariantBias ?? {}).map(([key, values]) => [key, values[0]])
    ) as Partial<Record<SiteSection["type"], string>>),
    ...(matched?.variants ?? {})
  };

  return { matched, archetype, layout, fontPair, variantBias };
};

const buildSectionContentStyles = (
  section: SiteSection,
  theme: z.infer<typeof SiteDocumentSchema>["theme"],
  layout: { alignment?: "left" | "center"; cardDensity?: string } | undefined
) => {
  const textAlign: ContentStyle["textAlign"] = layout?.alignment === "center" ? "center" : "left";
  const isEditorial = /playfair|cormorant|serif/i.test(theme.fontHeading ?? "");
  const headingFont = theme.fontHeading ? { fontFamily: theme.fontHeading } : {};
  const bodyFont = theme.fontBody ? { fontFamily: theme.fontBody } : {};
  const title: ContentStyle = {
    textAlign,
    textTransform: isEditorial ? ("none" as const) : ("uppercase" as const),
    letterSpacing: isEditorial ? "0" : "0.08em",
    ...headingFont,
    maxWidth: textAlign === "center" ? "14ch" : "12ch"
  };
  const body: ContentStyle = {
    textAlign,
    ...bodyFont,
    maxWidth: textAlign === "center" ? "58ch" : "62ch",
    opacity: 0.92
  };

  if (section.type === "hero") {
    return {
      ...(section.contentStyles ?? {}),
      eyebrow: {
        textAlign,
        textTransform: "uppercase" as const,
        letterSpacing: "0.12em",
        ...bodyFont,
        opacity: 0.72
      },
      headline: title,
      subheadline: body,
      ctaLabel: {
        textAlign,
        ...bodyFont,
        fontWeight: 600
      }
    };
  }

  if (section.type === "reservation") {
    return {
      ...(section.contentStyles ?? {}),
      title: { ...title, maxWidth: "16ch" },
      body: { ...body, maxWidth: "48ch" },
      ctaLabel: {
        textAlign,
        ...bodyFont,
        fontWeight: 600
      }
    };
  }

  return {
    ...(section.contentStyles ?? {}),
    title,
    body
  };
};

const applyVisualDirectionToSection = (
  section: SiteSection,
  prompt: string,
  nextTheme: z.infer<typeof SiteDocumentSchema>["theme"],
  direction: ReturnType<typeof selectThemeDirection>,
  onlyTargetedSection: boolean
): SiteSection => {
  const normalized = prompt.toLowerCase();
  const suggestedVariant = direction.variantBias[section.type];
  const nextVariant = typeof suggestedVariant === "string" ? suggestedVariant : section.variant;
  const nextContentStyles = buildSectionContentStyles(section, nextTheme, direction.layout ?? undefined);

  if (section.type === "hero") {
    return {
      ...section,
      variant: nextVariant,
      contentStyles: nextContentStyles,
      style: {
        ...section.style,
        alignment: "center",
        spacing: "airy",
        buttonStyle: direction.archetype?.ctaStyle === "outline" ? "outline" : "solid",
        background:
          direction.layout?.id === "immersive_stack"
            ? {
                type: "image",
                overlay: includesAny(normalized, ["dark", "premium", "luxury", "dramatic"]) ? 0.56 : 0.42,
                position: "center",
                size: "cover",
                repeat: "no-repeat"
              }
            : {
                type: "gradient",
                angle: 180,
                stops: [
                  { color: `${nextTheme.secondary}26`, position: 0 },
                  { color: nextTheme.bg, position: 100 }
                ]
              },
        colorOverride:
          direction.layout?.id === "immersive_stack"
            ? { text: "#FFF8F1", bg: nextTheme.primary, primary: nextTheme.secondary }
            : null
      }
    };
  }

  if (section.type === "gallery") {
    return {
      ...section,
      variant: nextVariant,
      contentStyles: nextContentStyles,
      style: {
        ...section.style,
        spacing: "airy",
        background:
          direction.layout?.id === "immersive_stack"
            ? {
                type: "gradient",
                angle: 180,
                stops: [
                  { color: nextTheme.surface, position: 0 },
                  { color: nextTheme.bg, position: 100 }
                ]
              }
            : { type: "plain" },
        buttonStyle: "outline"
      }
    };
  }

  if (section.type === "reservation") {
    return {
      ...section,
      variant: nextVariant,
      contentStyles: nextContentStyles,
      style: {
        ...section.style,
        alignment: "center",
        spacing: "airy",
        buttonStyle: "solid",
        background:
          includesAny(normalized, ["dark", "premium", "luxury", "contrast"])
            ? {
                type: "gradient",
                angle: 140,
                stops: [
                  { color: nextTheme.primary, position: 0 },
                  { color: nextTheme.text, position: 100 }
                ]
              }
            : {
                type: "gradient",
                angle: 135,
                stops: [
                  { color: `${nextTheme.secondary}33`, position: 0 },
                  { color: nextTheme.surface, position: 100 }
                ]
              },
        colorOverride:
          includesAny(normalized, ["dark", "premium", "luxury", "contrast"])
            ? { bg: nextTheme.primary, text: "#FFF8F1", primary: nextTheme.secondary }
            : null
      }
    };
  }

  if (section.type === "testimonials") {
    return {
      ...section,
      variant: nextVariant,
      contentStyles: nextContentStyles,
      style: {
        ...section.style,
        alignment: "center",
        spacing: direction.layout?.cardDensity === "airy" ? "airy" : section.style.spacing,
        background:
          includesAny(normalized, ["premium", "trustworthy", "contrast"])
            ? {
                type: "gradient",
                angle: 135,
                stops: [
                  { color: nextTheme.primary, position: 0 },
                  { color: nextTheme.text, position: 100 }
                ]
              }
            : {
                type: "gradient",
                angle: 180,
                stops: [
                  { color: `${nextTheme.secondary}24`, position: 0 },
                  { color: nextTheme.bg, position: 100 }
                ]
              },
        colorOverride:
          includesAny(normalized, ["premium", "trustworthy", "contrast"])
            ? { bg: nextTheme.primary, text: "#FFF8F1", primary: nextTheme.secondary }
            : null
      }
    };
  }

  if (section.type === "about" || section.type === "services" || section.type === "contact") {
    return {
      ...section,
      variant: nextVariant,
      contentStyles: nextContentStyles,
      style: {
        ...section.style,
        alignment: direction.layout?.alignment === "center" ? "center" : section.style.alignment,
        spacing:
          includesAny(normalized, ["clean", "cleaner", "clutter", "premium", "luxury", "refined"])
            ? "airy"
            : direction.layout?.cardDensity === "compact"
              ? "compact"
              : section.style.spacing,
        buttonStyle: section.type === "contact" ? "outline" : section.style.buttonStyle,
        background:
          onlyTargetedSection && includesAny(normalized, ["warm", "welcoming"])
            ? {
                type: "gradient",
                angle: 180,
                stops: [
                  { color: `${nextTheme.secondary}1f`, position: 0 },
                  { color: nextTheme.bg, position: 100 }
                ]
              }
            : section.style.background
      }
    };
  }

  return {
    ...section,
    variant: nextVariant,
    contentStyles: nextContentStyles
  };
};

const shouldUseProviderForRefinement = (refinementPlan: StudioRefinementPlan, prompt: string) => {
  const promptKind = resolvePromptKind(prompt);
  if (refinementPlan.scope === "full_site" || refinementPlan.scope === "page") return true;
  if (promptKind.isHeavyRegenerationRequested || promptKind.isImageChangeRequested) return true;
  return false;
};

const shouldUseCopyPatch = (refinementPlan: StudioRefinementPlan, targetSection: SiteSection, prompt: string) => {
  const promptKind = resolvePromptKind(prompt);
  if (targetSection.type === "reservation" && includesAny(promptKind.normalized, ["reserve", "booking", "reservation", "prominent", "harder"])) {
    return true;
  }
  if (refinementPlan.scope === "content_only") return true;
  return promptKind.isCopyFocused && !promptKind.isImageChangeRequested;
};

const applyThemePromptFallback = (
  document: z.infer<typeof SiteDocumentSchema>,
  prompt: string,
  currentSpec: ReturnType<typeof resolveStudioGenerationSpec>
) => {
  const direction = selectThemeDirection(prompt, currentSpec, document);
  const builtTheme = buildTheme(
    direction.archetype?.palette.primary ?? currentSpec.theme.primary,
    direction.archetype?.palette.background ?? currentSpec.theme.background,
    direction.fontPair.value
  );
  const nextTheme = {
    ...builtTheme,
    secondary: direction.archetype?.palette.secondary ?? builtTheme.secondary,
    bg: direction.archetype?.palette.background ?? builtTheme.bg,
    surface: direction.archetype?.palette.surface ?? builtTheme.surface,
    text: direction.archetype?.palette.text ?? builtTheme.text,
    muted: direction.archetype?.palette.muted ?? builtTheme.muted,
    border: direction.archetype?.palette.border ?? builtTheme.border,
    buttonText: direction.archetype?.palette.buttonText ?? builtTheme.buttonText,
    fontHeading: direction.fontPair.heading,
    fontBody: direction.fontPair.body,
    textStyles: builtTheme.textStyles
      ? {
          ...builtTheme.textStyles,
          h1: {
            ...builtTheme.textStyles.h1,
            size: /playfair|cormorant|serif/i.test(direction.fontPair.heading) ? "4rem" : "3.3rem",
            weight: /playfair|cormorant|serif/i.test(direction.fontPair.heading) ? 600 : 700,
            lineHeight: direction.layout?.alignment === "center" ? "1.02" : "1.08",
            letterSpacing: /playfair|cormorant|serif/i.test(direction.fontPair.heading) ? "0" : "0.04em"
          },
          body: {
            ...builtTheme.textStyles.body,
            lineHeight: includesAny(prompt.toLowerCase(), ["premium", "luxury", "clean", "clutter", "refined"])
              ? "1.72"
              : builtTheme.textStyles.body.lineHeight
          },
          caption: {
            ...builtTheme.textStyles.caption,
            letterSpacing: "0.08em"
          }
        }
      : builtTheme.textStyles,
    pageTransitions:
      includesAny(prompt.toLowerCase(), ["dramatic", "premium", "luxury"]) || direction.layout?.id === "split_showcase"
        ? "fade"
        : builtTheme.pageTransitions
  };
  const nextPages = document.pages.map((page) => ({
    ...page,
    sections: page.sections.map((section) =>
      applyVisualDirectionToSection(section, prompt, nextTheme, direction, false)
    )
  }));
  const nextTone =
    includesAny(prompt.toLowerCase(), ["premium", "lux", "elegant"])
      ? "premium"
      : includesAny(prompt.toLowerCase(), ["warm", "friendly", "welcoming"])
        ? "friendly"
        : includesAny(prompt.toLowerCase(), ["modern", "clean", "minimal"])
          ? "modern"
          : document.tone;

  return {
    ...document,
    tone: nextTone,
    theme: nextTheme,
    pages: nextPages,
    siteBrief: {
      ...(document.siteBrief ?? {}),
      tone: nextTone,
      theme: {
        primary: nextTheme.primary,
        background: nextTheme.bg,
        fontFamily: nextTheme.fontBody ?? currentSpec.theme.fontFamily
      },
      designDNA: {
        ...(document.siteBrief?.designDNA ?? {}),
        palette: {
          primary: nextTheme.primary,
          secondary: nextTheme.secondary,
          background: nextTheme.bg,
          accent: direction.archetype?.palette.accent ?? nextTheme.primary
        },
        fontPair: {
          heading: nextTheme.fontHeading,
          body: nextTheme.fontBody
        },
        variantBias: Object.fromEntries(
          nextPages.flatMap((page) => page.sections.filter((section) => section.enabled).map((section) => [section.type, section.variant]))
        ),
        sectionOrder: nextPages.flatMap((page) => page.sections.filter((section) => section.enabled).map((section) => section.id)),
        imageryStyle: direction.archetype?.imageTreatment,
        industryKey: "restaurant",
        archetypeKey: direction.archetype?.id,
        layoutDNA: direction.layout?.id,
        layoutStyle: direction.layout?.label,
        sectionBlueprints: nextPages.flatMap((page) =>
          page.sections.filter((section) => section.enabled).map((section) => `${section.id}:${section.variant}`)
        ),
        conversionGoal: currentSpec.business.ctaGoal
      }
    }
  };
};

const applySectionVisualFallback = (
  document: z.infer<typeof SiteDocumentSchema>,
  targetSection: SiteSection,
  prompt: string,
  currentSpec: ReturnType<typeof resolveStudioGenerationSpec>
) => {
  const direction = selectThemeDirection(prompt, currentSpec, document);
  const nextPages = document.pages.map((page) => ({
    ...page,
    sections: page.sections.map((section) =>
      section.id === targetSection.id
        ? applyVisualDirectionToSection(section, prompt, document.theme, direction, true)
        : section
    )
  }));
  return {
    ...document,
    pages: nextPages,
    siteBrief: {
      ...(document.siteBrief ?? {}),
      designDNA: {
        ...(document.siteBrief?.designDNA ?? {}),
        variantBias: Object.fromEntries(
          nextPages
            .flatMap((page) => page.sections)
            .filter((section) => section.enabled)
            .map((section) => [section.type, section.variant])
        ),
        sectionOrder: nextPages.flatMap((page) => page.sections.filter((section) => section.enabled).map((section) => section.id)),
        sectionBlueprints: nextPages.flatMap((page) =>
          page.sections.filter((section) => section.enabled).map((section) => `${section.id}:${section.variant}`)
        )
      }
    }
  };
};

const getMissingBuilderColumnName = (error: unknown) => {
  if (!error || typeof error !== "object") return null;
  const code = "code" in error ? (error as { code?: unknown }).code : "";
  const message = "message" in error ? (error as { message?: unknown }).message : "";
  if (code !== "PGRST204" || typeof message !== "string") return null;
  const match = message.match(/Could not find the '([^']+)' column/i);
  return match?.[1] ?? null;
};

const updateBuilderSiteWithCompatibleColumns = async (
  admin: any,
  siteId: string,
  values: Record<string, unknown>
) => {
  const nextValues = { ...values };

  while (Object.keys(nextValues).length > 0) {
    const { error } = await admin.from("builder_sites").update(nextValues).eq("id", siteId);
    if (!error) {
      return null;
    }

    const missingColumn = getMissingBuilderColumnName(error);
    if (missingColumn && Object.prototype.hasOwnProperty.call(nextValues, missingColumn)) {
      delete nextValues[missingColumn];
      continue;
    }

    return error;
  }

  return new Error("No compatible builder_sites columns available for draft save");
};

const persistDocument = async (
  admin: any,
  siteId: string,
  siteDocument: z.infer<typeof SiteDocumentSchema>,
  tone: string | null
) => {
  return updateBuilderSiteWithCompatibleColumns(admin, siteId, {
    template_id: siteDocument.templateId,
    tone,
    site_document: siteDocument,
    primary_color: siteDocument.theme?.primary ?? null,
    secondary_color: siteDocument.theme?.bg ?? null,
    font_family: siteDocument.theme?.fontBody ?? null,
    seo_title: siteDocument.seo?.title ?? null,
    seo_description: siteDocument.seo?.description ?? null
  });
};

const persistIntegratedTemplateDocument = async (
  admin: any,
  siteId: string,
  siteDocument: IntegratedTemplateSiteDocument
) => {
  return updateBuilderSiteWithCompatibleColumns(admin, siteId, {
    template_id: siteDocument.template,
    template_key: siteDocument.template,
    site_document: siteDocument,
    primary_color:
      siteDocument.editorSettings?.colors?.primaryColor ??
      siteDocument.theme?.primaryColor ??
      null,
    secondary_color:
      siteDocument.editorSettings?.colors?.secondaryColor ??
      siteDocument.theme?.secondaryColor ??
      null,
    seo_title: siteDocument.meta.seo.title ?? null,
    seo_description: siteDocument.meta.seo.description ?? null
  });
};

export async function POST(request: Request) {
  const supabase = getSupabaseRouteClient();
  const { data: userData } = await supabase.auth.getUser();

  if (!userData?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!(await userHasLaunchAccess(userData.user.id))) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const payloadResult = await readStudioEditPayload(request);
  if (!payloadResult.ok) {
    return payloadResult.response;
  }

  const { siteId, prompt, thinkMode, referenceImages } = payloadResult.payload;
  const site = await getOwnedBuilderSite<any>(
    siteId,
    userData.user.id,
    "id,business_id,business_name,industry,description,template_id,site_document,contact_email,contact_phone,contact_address,opening_hours,socials,has_own_photos,content_language,generation_brief,logo_url,primary_color,secondary_color"
  );

  if (!site?.site_document) {
    return NextResponse.json({ error: "Site not found" }, { status: 404 });
  }

  const billingAccess = await getBusinessEntitlementAccess(site.business_id as string, "website_builder");
  if (!billingAccess.allowed) {
    return buildUpgradeRequiredResponse("website_builder", billingAccess);
  }

  const admin = getSupabaseServerAdminClient() as any;
  const integratedDocument = parseIntegratedTemplateSiteDocument(site.site_document);
  if (integratedDocument) {
    // Intent classification + KB retrieval — non-fatal if it fails
    let routingKnowledgeContext: string | null = null;
    let routingIntentType: string | null = null;
    try {
      const routing = await routeWebsiteEditRequest({
        prompt,
        businessId: site.business_id as string,
        businessType: site.industry ?? integratedDocument.meta.industry ?? "restaurant",
        businessName: site.business_name ?? integratedDocument.meta.businessName,
        documentKind: "integrated_template"
      });

      routingIntentType = routing.intent.intent;

      if (routing.action === "clarify") {
        return NextResponse.json({
          type: "clarification_needed",
          clarification: routing.clarification
        });
      }

      if (routing.action === "advisory") {
        return NextResponse.json({
          type: "advisory",
          advisory: routing.advisory
        });
      }

      if (routing.action === "proceed") {
        routingKnowledgeContext = routing.knowledgeContext;
      }
    } catch (routingError) {
      console.warn("[BUILDER_STUDIO_EDIT_ROUTING_WARN]", routingError);
    }

    // ── Page addition ────────────────────────────────────────────────────────
    const isPageAddition =
      routingIntentType === "page_addition" ||
      routingIntentType === "knowledge_based_page_generation";

    if (isPageAddition) {
      const businessName = site.business_name ?? integratedDocument.meta.businessName;
      const businessType = site.industry ?? integratedDocument.meta.industry ?? "restaurant";
      const existingSlugs = (integratedDocument.additionalPages ?? []).map((p) => p.slug);

      const generated = await generateIntegratedPage({
        prompt,
        businessName,
        businessType,
        template: integratedDocument.template,
        knowledgeContext: routingKnowledgeContext,
        existingSlugs
      });

      if (!generated) {
        return NextResponse.json(
          {
            error: "Could not generate the requested page. Try again or be more specific.",
            code: "PAGE_GENERATION_FAILED"
          },
          { status: 500 }
        );
      }

      const now = new Date().toISOString();
      const newPage: IntegratedTemplatePage = {
        id: `page-${Date.now()}`,
        slug: generated.slug,
        title: generated.title,
        kind: generated.kind,
        metaDescription: generated.metaDescription,
        status: "draft",
        blocks: generated.blocks,
        source: "ai_generated",
        createdAt: now,
        updatedAt: now
      };

      // Deduplicate by slug — replace existing page with same slug
      const existingPages = (integratedDocument.additionalPages ?? []).filter(
        (p) => p.slug !== newPage.slug
      );
      const updatedPages = [...existingPages, newPage];

      // Build or update the navigation item for this page
      const existingNavItems = (integratedDocument.navigationItems ?? []).filter(
        (n) => n.pageId !== newPage.id && n.href !== `?page=${newPage.slug}`
      );
      const newNavItem: NavigationItem = {
        id: `nav-${newPage.id}`,
        label: generated.navigationLabel,
        href: `?page=${newPage.slug}`,
        kind: "page",
        pageId: newPage.id,
        order: existingNavItems.length,
        enabled: true
      };
      const updatedNavItems = [...existingNavItems, newNavItem];

      // Rebuild template data with injected nav
      const nextData = injectNavigationItemsIntoTemplateData(
        integratedDocument.template,
        mapIntegratedTemplateData(
          integratedDocument.template,
          integratedDocument.content,
          integratedDocument.images,
          { logoUrl: site.logo_url ?? null }
        ),
        updatedNavItems
      );

      const nextDocument: IntegratedTemplateSiteDocument = {
        ...integratedDocument,
        additionalPages: updatedPages,
        navigationItems: updatedNavItems,
        data: nextData,
        meta: {
          ...integratedDocument.meta,
          updatedAt: now
        }
      };

      const saveError = await persistIntegratedTemplateDocument(admin, siteId, nextDocument);
      if (saveError) {
        return NextResponse.json(
          { error: "Failed to save new page", message: saveError.message },
          { status: 500 }
        );
      }

      console.info("[BUILDER_STUDIO_EDIT_PAGE_ADDED]", {
        siteId,
        pageSlug: newPage.slug,
        pageKind: newPage.kind,
        blockCount: newPage.blocks.length,
        knowledgeUsed: Boolean(routingKnowledgeContext)
      });

      return NextResponse.json({
        type: "page_added",
        siteDocument: nextDocument,
        pageSlug: newPage.slug,
        pageTitle: newPage.title,
        pageKind: newPage.kind,
        navigationLabel: generated.navigationLabel,
        knowledgeUsed: Boolean(routingKnowledgeContext)
      });
    }
    // ────────────────────────────────────────────────────────────────────────

    const analysisRequested = thinkMode || referenceImages.length > 0;
    const openai = analysisRequested ? getOpenAIClient() : null;
    if (analysisRequested && !openai) {
      return NextResponse.json(
        {
          error:
            "Image-aware edits and Think mode are unavailable right now.",
          code: "OPENAI_UNAVAILABLE"
        },
        { status: 503 }
      );
    }

    let referenceGuidance: string | null = null;
    if (referenceImages.length) {
      try {
        referenceGuidance = await analyzeEditReferenceImages(openai!, {
          prompt,
          referenceImages,
          thinkMode
        });
      } catch (error) {
        console.error("[BUILDER_STUDIO_EDIT_REFERENCE_ANALYSIS_ERROR]", error);
        return NextResponse.json(
          { error: "We couldn't analyze the attached reference images." },
          { status: 500 }
        );
      }
    }

    const effectiveInstruction = [
      prompt,
      referenceGuidance
        ? `Reference image guidance:\n${referenceGuidance}`
        : null,
      routingKnowledgeContext
        ? `Business document context:\n${routingKnowledgeContext}`
        : null
    ]
      .filter(Boolean)
      .join("\n\n");

    const deterministicEdit = applyDeterministicIntegratedTemplateEdit(
      integratedDocument,
      effectiveInstruction
    );
    const appliedChanges = [...deterministicEdit.appliedChanges];
    console.info("[BUILDER_STUDIO_EDIT_REQUEST]", {
      siteId,
      template: integratedDocument.template,
      prompt,
      thinkMode,
      referenceImagesCount: referenceImages.length,
      appliedChanges,
      shouldRunAiRefinement: deterministicEdit.shouldRunAiRefinement
    });

    const shouldRunAiRefinement =
      deterministicEdit.shouldRunAiRefinement || thinkMode || referenceImages.length > 0;
    const refinementClient =
      openai ?? (shouldRunAiRefinement ? getOpenAIClient() : null);
    if (shouldRunAiRefinement && !refinementClient) {
      return NextResponse.json(
        { error: "Template refinement is unavailable right now.", code: "OPENAI_UNAVAILABLE" },
        { status: 503 }
      );
    }

    let { data: uploadedAssetRows, error: uploadedAssetError } = await admin
      .from("builder_site_assets")
      .select("kind,target_slot,url,created_at")
      .eq("site_id", siteId)
      .order("created_at", { ascending: false });
    if (isMissingBuilderAssetSlotColumnError(uploadedAssetError)) {
      const fallbackAssets = await admin
        .from("builder_site_assets")
        .select("kind,url,created_at")
        .eq("site_id", siteId)
        .order("created_at", { ascending: false });
      uploadedAssetRows = (fallbackAssets.data ?? []).map(
        (image: { kind?: string | null; url?: string | null; created_at?: string | null }) => ({
          ...image,
          target_slot: inferBuilderImageSlot({
            kind: image.kind,
            url: image.url
          })
        })
      );
      uploadedAssetError = fallbackAssets.error;
    }
    if (uploadedAssetError) {
      console.error("[BUILDER_STUDIO_EDIT_ASSET_LOAD_ERROR]", uploadedAssetError);
      return NextResponse.json({ error: "Unable to load uploaded site images." }, { status: 500 });
    }
    const uploadedImages = ((uploadedAssetRows ?? []) as Array<{
      kind?: string | null;
      target_slot?: string | null;
      url?: string | null;
    }>)
      .filter(
        (image): image is { kind?: string | null; target_slot?: string | null; url: string } =>
          typeof image?.url === "string" && image.url.length > 0
      )
      .map((image, index) => ({
        url: image.url,
        kind:
          image.kind === "hero" || image.kind === "gallery" || image.kind === "other"
            ? (image.kind as "hero" | "gallery" | "other")
            : index === 0
              ? ("hero" as const)
              : ("gallery" as const),
        targetSlot: normalizeBuilderImageSlot(
          image.target_slot,
          image.kind === "hero" ? "hero" : index === 0 ? "hero" : "auto"
        ),
        alt:
          image.kind === "hero"
            ? `${site.business_name ?? integratedDocument.meta.businessName} hero image`
            : `${site.business_name ?? integratedDocument.meta.businessName} restaurant photo ${index + 1}`
      }));
    const socials =
      site.socials && typeof site.socials === "object"
        ? Object.fromEntries(
            Object.entries(site.socials as Record<string, unknown>)
              .map(([key, value]) => [key, typeof value === "string" && value.trim().length > 0 ? value.trim() : null] as const)
              .filter(([, value]) => value !== null)
          )
        : {};
    let nextContent = deterministicEdit.content;
    const deterministicDocumentChanged = hasMaterialDocumentChange({
      beforeContent: integratedDocument.content,
      afterContent: deterministicEdit.content,
      targetSection: deterministicEdit.targetSection,
      beforeSettings: integratedDocument.editorSettings,
      afterSettings: deterministicEdit.editorSettings
    });
    if (shouldRunAiRefinement) {
      const refineContent = async (instruction: string, model?: string) =>
        refineRestaurantTemplateContent(
          refinementClient!,
          {
            prompt: integratedDocument.meta.enhancedPrompt ?? integratedDocument.meta.sourcePrompt,
            businessName: site.business_name ?? integratedDocument.meta.businessName,
            industry: site.industry ?? integratedDocument.meta.industry,
            template: integratedDocument.template,
            themeStyle: integratedDocument.meta.themeStyle ?? null,
            primaryColor:
              deterministicEdit.editorSettings.colors?.primaryColor ??
              site.primary_color ??
              integratedDocument.theme?.primaryColor ??
              null,
            secondaryColor:
              deterministicEdit.editorSettings.colors?.secondaryColor ??
              site.secondary_color ??
              integratedDocument.theme?.secondaryColor ??
              null,
            contact: {
              email: site.contact_email ?? integratedDocument.content.contact.email,
              phone: site.contact_phone ?? integratedDocument.content.contact.phone,
              address:
                site.contact_address ??
                integratedDocument.content.contact.addressLines.join(", ")
            },
            openingHours: site.opening_hours ?? integratedDocument.content.contact.hours.join(", "),
            socials,
            currentContent: deterministicEdit.content,
            instruction
          },
          {
            model
          }
        );

      const preferredModel =
        thinkMode || deterministicEdit.isRepairRequest ? "gpt-4o" : undefined;

      nextContent = await refineContent(effectiveInstruction, preferredModel);

      const refinedDocumentChanged = hasMaterialDocumentChange({
        beforeContent: integratedDocument.content,
        afterContent: nextContent,
        targetSection: deterministicEdit.targetSection,
        beforeSettings: integratedDocument.editorSettings,
        afterSettings: deterministicEdit.editorSettings
      });

      if (!refinedDocumentChanged && deterministicEdit.requiresMaterialChange) {
        if (deterministicDocumentChanged) {
          nextContent = deterministicEdit.content;
        } else {
          nextContent = await refineContent(
            buildEscalatedInstruction(
              effectiveInstruction,
              deterministicEdit.targetSection
            ),
            "gpt-4o"
          );
        }
      }
    } else if (!deterministicEdit.appliedChanges.length) {
      return NextResponse.json(
        {
          error:
            "That edit did not match any supported content or styling controls. Try naming the hero, text color, button color, background, alignment, spacing, or a specific section."
        },
        { status: 400 }
      );
    }

    const finalDocumentChanged = hasMaterialDocumentChange({
      beforeContent: integratedDocument.content,
      afterContent: nextContent,
      targetSection: deterministicEdit.targetSection,
      beforeSettings: integratedDocument.editorSettings,
      afterSettings: deterministicEdit.editorSettings
    });
    if (!finalDocumentChanged && deterministicEdit.requiresMaterialChange) {
      return NextResponse.json(
        {
          error:
            "The edit request did not produce a meaningful change. Be more explicit about the section and what must be fixed, or attach a screenshot.",
          code: "EDIT_PRODUCED_NO_CHANGE"
        },
        { status: 409 }
      );
    }
    if (
      deterministicEdit.targetSection &&
      deterministicEdit.isRepairRequest &&
      !appliedChanges.some((entry) => entry.startsWith(`${deterministicEdit.targetSection}_`))
    ) {
      appliedChanges.push(`${deterministicEdit.targetSection}_repaired`);
    }

    const forceRefreshImages = shouldRefreshTemplateImages(effectiveInstruction);
    const { images, policy } = await resolveTemplateImages({
      template: integratedDocument.template,
      prompt: effectiveInstruction,
      themeStyle: integratedDocument.meta.themeStyle ?? null,
      primaryColor:
        deterministicEdit.editorSettings.colors?.primaryColor ??
        site.primary_color ??
        integratedDocument.theme?.primaryColor ??
        null,
      secondaryColor:
        deterministicEdit.editorSettings.colors?.secondaryColor ??
        site.secondary_color ??
        integratedDocument.theme?.secondaryColor ??
        null,
      content: nextContent,
      existingImages: integratedDocument.images,
      uploadedImages,
      forceRefresh: forceRefreshImages
    });
    const nextData = injectNavigationItemsIntoTemplateData(
      integratedDocument.template,
      mapIntegratedTemplateData(
        integratedDocument.template,
        nextContent,
        images,
        { logoUrl: site.logo_url ?? null }
      ),
      integratedDocument.navigationItems
    );
    const nextTheme = buildIntegratedTemplateTheme(
      integratedDocument.template,
      deterministicEdit.editorSettings.colors?.primaryColor ??
        site.primary_color ??
        integratedDocument.theme?.primaryColor ??
        null,
      deterministicEdit.editorSettings.colors?.secondaryColor ??
        site.secondary_color ??
        integratedDocument.theme?.secondaryColor ??
        null
    );
    const nextDocument: IntegratedTemplateSiteDocument = {
      ...integratedDocument,
      theme: nextTheme,
      editorSettings: deterministicEdit.editorSettings,
      content: nextContent,
      images,
      data: nextData,
      // Preserve additional pages and navigation items across regular edits
      additionalPages: integratedDocument.additionalPages ?? [],
      navigationItems: integratedDocument.navigationItems,
      meta: {
        ...integratedDocument.meta,
        themeStyle: integratedDocument.meta.themeStyle ?? undefined,
        sourcePrompt: integratedDocument.meta.enhancedPrompt ?? integratedDocument.meta.sourcePrompt,
        imagePolicy: policy,
        seo: {
          title: `${site.business_name ?? integratedDocument.meta.businessName} | ${nextContent.business.cuisine}`,
          description: nextContent.hero.subheadline,
          ogImage: images.hero?.url ?? integratedDocument.meta.seo.ogImage
        },
        updatedAt: new Date().toISOString()
      }
    };

    const saveError = await persistIntegratedTemplateDocument(admin, siteId, nextDocument);
    if (saveError) {
      return NextResponse.json(
        { error: "Failed to save refinement", message: saveError.message },
        { status: 500 }
      );
    }

    console.info("[BUILDER_STUDIO_EDIT_APPLIED]", {
      siteId,
      template: nextDocument.template,
      appliedChanges,
      aiRefinementUsed: shouldRunAiRefinement,
      imageRefreshUsed: forceRefreshImages,
      referenceImagesCount: referenceImages.length,
      thinkMode
    });

    return NextResponse.json({
      siteDocument: nextDocument,
      template: nextDocument.template,
      reusedImages: !forceRefreshImages,
      imagePolicy: policy,
      appliedChanges,
      referenceImagesUsed: referenceImages.length,
      analysisNotes: summarizeReferenceGuidance(referenceGuidance),
      aiRefinementUsed: shouldRunAiRefinement,
      imageRefreshUsed: forceRefreshImages,
      thinkMode
    });
  }

  const allowLegacyStudioEdit = process.env.ENABLE_LEGACY_STUDIO_EDIT === "true";
  if (!allowLegacyStudioEdit) {
    console.warn("[BUILDER_STUDIO_EDIT_UNSUPPORTED_LEGACY]", {
      siteId,
      templateId: site.template_id ?? null
    });
    return NextResponse.json(
      {
        error: "Prompt editing is only supported for template-powered sites.",
        code: "INTEGRATED_TEMPLATE_REQUIRED"
      },
      { status: 409 }
    );
  }

  const parsedDoc = SiteDocumentSchema.safeParse(site.site_document);
  if (!parsedDoc.success) {
    return NextResponse.json({ error: "Invalid site document" }, { status: 400 });
  }

  const document = parsedDoc.data;
  const target = resolveSectionTarget(document, prompt);
  const studioSpec = resolveStudioGenerationSpec({
    studioSpec: document.siteBrief?.studio?.generationSpec,
    siteId,
    businessId: site.business_id,
    businessName: site.business_name ?? document.siteBrief?.businessName ?? "Restaurant",
    industry: site.industry ?? document.siteBrief?.industry ?? "Restaurant",
    description: site.description ?? document.siteBrief?.description ?? "",
    tone: document.siteBrief?.tone ?? document.siteBrief?.studio?.generationSpec?.business.toneStyle ?? "modern",
    templateId: document.templateId,
    primaryColor: document.theme.primary,
    secondaryColor: document.theme.bg,
    fontFamily: document.theme.fontBody,
    logoUrl: document.siteBrief?.logoUrl ?? document.siteBrief?.studio?.generationSpec?.business.logoUrl ?? null,
    contact: {
      email: document.siteBrief?.studio?.generationSpec?.business.email ?? null,
      phone: document.siteBrief?.studio?.generationSpec?.business.phone ?? null,
      address: site.contact_address ?? document.siteBrief?.studio?.generationSpec?.business.address ?? null
    },
    openingHours: document.siteBrief?.studio?.generationSpec?.business.openingHours ?? null,
    socials: document.siteBrief?.studio?.generationSpec?.business.socials ?? {},
    services: Array.isArray(document.siteBrief?.generationBrief?.topServices)
      ? document.siteBrief.generationBrief.topServices
      : [],
    proofAssets: Array.isArray(document.siteBrief?.generationBrief?.proofPoints)
      ? document.siteBrief.generationBrief.proofPoints
      : [],
    uploadedImages: (document.mediaLibrary ?? []).map((image: any) => ({
      src: image.src,
      alt: image.alt,
      width: image.width,
      height: image.height
    })),
    features: {
      includeGallery: document.pages.some((page) => page.sections.some((section) => section.type === "gallery" && section.enabled)),
      includeTestimonials: document.pages.some((page) =>
        page.sections.some((section) => section.type === "testimonials" && section.enabled)
      ),
      includeReservation: document.pages.some((page) =>
        page.sections.some((section) => section.type === "reservation" && section.enabled)
      )
    },
    hasOwnPhotos: Boolean(site.has_own_photos),
    studioSource: document.siteBrief?.studio?.generationSpec?.source ?? "legacy_generation"
  });

  const refinementPlan = classifyStudioRefinementRequest(prompt, target);
  if (hasRecentMatchingRefinement(document, refinementPlan)) {
    return NextResponse.json({
      siteDocument: document,
      refinement: refinementPlan,
      provider: document.siteBrief?.studio?.provider ?? null,
      reused: true
    });
  }

  const studioProvider = createStudioGenerationProvider();
  const shouldUseProvider = refinementPlan.providerAllowed && shouldUseProviderForRefinement(refinementPlan, prompt);

  if (studioProvider.metadata.provider === "v0" && shouldUseProvider) {
    const providerResult = await studioProvider.refineSite({
      spec: studioSpec,
      currentDocument: document,
      refinement: refinementPlan
    });

    if (providerResult.ok && providerResult.siteDocument) {
      const providerUpdatedDocument = appendStudioRefinementToSiteDocument(
        attachStudioMetadataToSiteDocument(
          providerResult.siteDocument,
          studioSpec,
          providerResult.metadata
        ),
        refinementPlan
      );
        const providerValidation = SiteDocumentSchema.safeParse(providerUpdatedDocument);
        if (providerValidation.success) {
          logStudioVariationSnapshot("studio_edit_provider", {
            spec: studioSpec,
            document: providerValidation.data as SiteDocument
          });
        const updateError = await persistDocument(
          admin,
          siteId,
          providerValidation.data,
          providerValidation.data.siteBrief?.tone ?? providerValidation.data.tone ?? null
        );

        if (!updateError) {
          return NextResponse.json({
            siteDocument: providerValidation.data,
            refinement: refinementPlan,
            provider: providerResult.metadata
          });
        }

        return NextResponse.json(
          { error: "Failed to save refinement", message: updateError.message },
          { status: 500 }
        );
      }
    }
  }

  let nextDocument: z.infer<typeof SiteDocumentSchema> | null = null;

  if (refinementPlan.scope === "theme_only") {
    nextDocument = applyThemePromptFallback(document, prompt, studioSpec);
  } else if (refinementPlan.scope === "section" || refinementPlan.scope === "content_only") {
    const targetSection = refinementPlan.target.sectionId
      ? document.pages.flatMap((page) => page.sections).find((section) => section.id === refinementPlan.target.sectionId)
      : refinementPlan.target.sectionType
        ? document.pages.flatMap((page) => page.sections).find((section) => section.type === refinementPlan.target.sectionType)
        : null;

    if (!targetSection) {
      return NextResponse.json(
        { error: "Could not resolve a section from that prompt. Try mentioning hero, gallery, reservations, menu, or contact." },
        { status: 400 }
      );
    }

    const promptKind = resolvePromptKind(prompt);
    nextDocument =
      promptKind.isStyleFocused || !promptKind.isCopyFocused
        ? applySectionVisualFallback(document, targetSection, prompt, studioSpec)
        : document;

    if (shouldUseCopyPatch(refinementPlan, targetSection, prompt)) {
      const intake = toIntake(site, document);
      const openai = getOpenAIClient();
      const policy = getGenerationPolicy(intake.businessType, intake.subtype, intake.ctaIntent);
      const patch =
        targetSection.type === "reservation"
          ? await buildReservationPatch(targetSection, prompt, intake, openai)
          : await buildSectionPatch(targetSection, prompt, intake, policy, openai);

      if (!patch) {
        return NextResponse.json({ error: "Could not apply that edit safely." }, { status: 400 });
      }

      nextDocument = applySectionContentPatch(nextDocument, targetSection.id, patch);
    }
  } else {
    return NextResponse.json(
      {
        error:
          "This edit scope needs the live generation provider. Try a theme, hero, gallery, reservations, or content-focused instruction."
      },
      { status: 409 }
    );
  }

  const finalizedDocument = appendStudioRefinementToSiteDocument(
    attachStudioMetadataToSiteDocument(
      nextDocument,
      studioSpec,
      {
        ...getCurrentStudioProviderMetadata("studio_prompt_edit"),
        reason:
          studioProvider.metadata.provider === "v0" && shouldUseProvider
            ? "Live v0 refinement failed or was unavailable for this scope. Applied the cheaper SiroundChat fallback edit path."
            : "Applied the scoped SiroundChat Studio fallback path to avoid unnecessary heavy regeneration and image work."
      }
    ),
    refinementPlan
  );
  const finalValidation = SiteDocumentSchema.safeParse(finalizedDocument);
  if (!finalValidation.success) {
    return NextResponse.json({ error: "The refinement produced an invalid site document." }, { status: 500 });
  }

  logStudioVariationSnapshot("studio_edit_fallback", {
    spec: studioSpec,
    document: finalValidation.data as SiteDocument
  });

  const saveError = await persistDocument(
    admin,
    siteId,
    finalValidation.data,
    finalValidation.data.siteBrief?.tone ?? finalValidation.data.tone ?? null
  );

  if (saveError) {
    return NextResponse.json(
      { error: "Failed to save refinement", message: saveError.message },
      { status: 500 }
    );
  }

  return NextResponse.json({
    siteDocument: finalValidation.data,
    refinement: refinementPlan,
    provider: finalValidation.data.siteBrief?.studio?.provider ?? null
  });
}

import { BRAND_ARCHETYPES } from "@/lib/builder/generation/v2/archetypes";
import { LAYOUT_DNA_REGISTRY } from "@/lib/builder/generation/v2/layout-dna";
import { buildTheme } from "@/lib/website-builder/editor/theme";
import { SiteDocumentSchema } from "@/lib/website-builder/schema";
import {
  TEMPLATE_ALLOWED_VARIANTS,
  TEMPLATE_DEFAULT_SECTIONS,
  TEMPLATE_META
} from "@/lib/website-builder/templates/registry";
import { resolveThemeFontPair } from "@/lib/website-builder/theme/fonts";
import type {
  ContentStyle,
  SiteDocument,
  SiteImage,
  SitePage,
  SiteSection,
  SiteThemeTokens
} from "@/lib/website-builder/types";
import type {
  StudioGenerationSpec,
  StudioRefinementPlan,
  StudioRefinementScope
} from "@/lib/website-studio/schema";
import { logStudioVariationSnapshot } from "@/lib/website-studio/dev";

export const V0_STUDIO_SPEC_FILE = "siroundchat-studio-spec.json";
export const V0_SITE_DOCUMENT_FILE = "siroundchat-site-document.json";

const DEFAULT_TEMPLATE_ID = "restaurant-editorial";
const RESTAURANT_ARCHETYPE_IDS = new Set(["cozy_family_dining", "premium_fine_dining"]);
const RESTAURANT_LAYOUT_IDS = new Set([
  "split_showcase",
  "editorial_stack",
  "immersive_stack",
  "centered_story"
]);
const RESTAURANT_ARCHETYPES = BRAND_ARCHETYPES.filter((entry) => RESTAURANT_ARCHETYPE_IDS.has(entry.id));
const RESTAURANT_LAYOUTS = LAYOUT_DNA_REGISTRY.filter((entry) => RESTAURANT_LAYOUT_IDS.has(entry.id));
const IMAGE_CHANGE_TERMS = [
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
  "regenerate images",
  "new photo",
  "new photos"
] as const;

export type StudioGenerationControls = {
  generationMode: "initial_generation" | "prompt_edit";
  editMode: "initial" | StudioRefinementScope;
  allowImageGeneration: boolean;
  allowHeavyRegeneration: boolean;
  maxNewImages: number;
  imagePolicy: "reuse_existing" | "generate_missing_only" | "explicit_refresh";
};

const isRecord = (value: unknown): value is Record<string, any> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const normalizeText = (value: unknown) => (typeof value === "string" ? value.trim() : "");

const normalizeHex = (value: unknown) => {
  if (typeof value !== "string") return null;
  const raw = value.trim().replace("#", "");
  if (/^[0-9a-fA-F]{3}$/.test(raw)) {
    return `#${raw
      .split("")
      .map((char) => `${char}${char}`)
      .join("")}`;
  }
  if (/^[0-9a-fA-F]{6}$/.test(raw)) {
    return `#${raw}`;
  }
  return null;
};

const includesAny = (value: string, terms: readonly string[]) =>
  terms.some((term) => value.includes(term));

const countDocumentImages = (document?: SiteDocument | null) => {
  const sectionImages = document?.pages?.flatMap((page) => page.sections.flatMap((section) => section.images ?? [])) ?? [];
  return (document?.mediaLibrary?.length ?? 0) + sectionImages.length;
};

const hasExistingImages = (spec: StudioGenerationSpec, baseDocument?: SiteDocument | null) =>
  spec.business.galleryImages.length > 0 || countDocumentImages(baseDocument) > 0;

const sanitizeCssLength = (value: unknown, fallback?: string) => {
  const normalized = normalizeText(value);
  if (!normalized) return fallback;
  return /^-?\d+(\.\d+)?(px|rem|em|%|ch|vh|vw)$/.test(normalized) ? normalized : fallback;
};

const sanitizeTextAlign = (value: unknown, fallback?: ContentStyle["textAlign"]) => {
  return value === "left" || value === "center" || value === "right" ? value : fallback;
};

const sanitizeTextTransform = (value: unknown, fallback?: ContentStyle["textTransform"]) => {
  return value === "none" || value === "uppercase" || value === "lowercase" || value === "capitalize"
    ? value
    : fallback;
};

const sanitizeFontStyle = (value: unknown, fallback?: ContentStyle["fontStyle"]) => {
  return value === "normal" || value === "italic" ? value : fallback;
};

export const resolveStudioGenerationControls = ({
  spec,
  baseDocument,
  refinement
}: {
  spec: StudioGenerationSpec;
  baseDocument?: SiteDocument | null;
  refinement?: Pick<StudioRefinementPlan, "scope" | "request"> | null;
}): StudioGenerationControls => {
  if (!refinement) {
    const allowImageGeneration = !hasExistingImages(spec, baseDocument);
    return {
      generationMode: "initial_generation",
      editMode: "initial",
      allowImageGeneration,
      allowHeavyRegeneration: true,
      maxNewImages: allowImageGeneration ? 2 : 0,
      imagePolicy: allowImageGeneration ? "generate_missing_only" : "reuse_existing"
    };
  }

  const normalized = refinement.request.toLowerCase();
  const allowImageGeneration = includesAny(normalized, IMAGE_CHANGE_TERMS);
  const allowHeavyRegeneration =
    refinement.scope === "full_site" ||
    refinement.scope === "page" ||
    includesAny(normalized, ["regenerate the site", "redo the site", "reimagine the whole site"]);

  return {
    generationMode: "prompt_edit",
    editMode: refinement.scope,
    allowImageGeneration,
    allowHeavyRegeneration,
    maxNewImages: allowImageGeneration ? 2 : 0,
    imagePolicy: allowImageGeneration ? "explicit_refresh" : "reuse_existing"
  };
};

const isAllowedArchetypeId = (value: string | null | undefined) =>
  Boolean(value && RESTAURANT_ARCHETYPE_IDS.has(value));

const isAllowedLayoutId = (value: string | null | undefined) =>
  Boolean(value && RESTAURANT_LAYOUT_IDS.has(value));

const getArchetypeById = (value: string | null | undefined) =>
  RESTAURANT_ARCHETYPES.find((entry) => entry.id === value);

const getLayoutById = (value: string | null | undefined) =>
  RESTAURANT_LAYOUTS.find((entry) => entry.id === value);

const resolveFallbackArchetype = (spec: StudioGenerationSpec) => {
  const styleMode = spec.theme.styleMode;
  if (styleMode === "premium" || styleMode === "elegant") {
    return getArchetypeById("premium_fine_dining") ?? RESTAURANT_ARCHETYPES[0];
  }
  return getArchetypeById("cozy_family_dining") ?? RESTAURANT_ARCHETYPES[0];
};

const resolveFallbackLayout = (spec: StudioGenerationSpec, archetypeId?: string | null) => {
  if (spec.theme.styleMode === "premium" || spec.theme.styleMode === "elegant") {
    return getLayoutById("immersive_stack") ?? RESTAURANT_LAYOUTS[0];
  }
  if (spec.theme.styleMode === "warm" || spec.theme.styleMode === "casual") {
    return getLayoutById("centered_story") ?? RESTAURANT_LAYOUTS[0];
  }
  const archetype = getArchetypeById(archetypeId);
  const preferred = archetype?.preferredLayoutIds.find((layoutId) => isAllowedLayoutId(layoutId));
  return getLayoutById(preferred ?? null) ?? getLayoutById("editorial_stack") ?? RESTAURANT_LAYOUTS[0];
};

const sanitizeTextToken = (
  baseValue: NonNullable<SiteThemeTokens["textStyles"]>[keyof NonNullable<SiteThemeTokens["textStyles"]>],
  candidateValue: unknown
) => {
  if (!isRecord(candidateValue)) return baseValue;
  return {
    size: normalizeText(candidateValue.size) || baseValue.size,
    weight:
      typeof candidateValue.weight === "number" && Number.isFinite(candidateValue.weight)
        ? candidateValue.weight
        : baseValue.weight,
    lineHeight: normalizeText(candidateValue.lineHeight) || baseValue.lineHeight,
    letterSpacing: normalizeText(candidateValue.letterSpacing) || baseValue.letterSpacing
  };
};

const mergeThemeTextStyles = (
  baseTextStyles: SiteThemeTokens["textStyles"],
  candidateValue: unknown
) => {
  if (!baseTextStyles || !isRecord(candidateValue)) return baseTextStyles;
  return {
    h1: sanitizeTextToken(baseTextStyles.h1, candidateValue.h1),
    h2: sanitizeTextToken(baseTextStyles.h2, candidateValue.h2),
    h3: sanitizeTextToken(baseTextStyles.h3, candidateValue.h3),
    body: sanitizeTextToken(baseTextStyles.body, candidateValue.body),
    caption: sanitizeTextToken(baseTextStyles.caption, candidateValue.caption)
  };
};

const resolveDesignDNA = (spec: StudioGenerationSpec, candidateValue?: unknown) => {
  const baseArchetype =
    getArchetypeById(
      isRecord(candidateValue) && isAllowedArchetypeId(normalizeText(candidateValue.archetypeKey))
        ? normalizeText(candidateValue.archetypeKey)
        : null
    ) ?? resolveFallbackArchetype(spec);
  const baseLayout =
    getLayoutById(
      isRecord(candidateValue) && isAllowedLayoutId(normalizeText(candidateValue.layoutDNA))
        ? normalizeText(candidateValue.layoutDNA)
        : null
    ) ?? resolveFallbackLayout(spec, baseArchetype?.id);

  return {
    variationSeed: spec.siteId ?? spec.businessId,
    layoutStyle: baseLayout?.label ?? spec.theme.styleMode,
    palette: {
      primary: baseArchetype?.palette.primary ?? spec.theme.primary,
      secondary: baseArchetype?.palette.secondary ?? spec.theme.secondary,
      background: baseArchetype?.palette.background ?? spec.theme.background,
      accent: baseArchetype?.palette.accent ?? spec.theme.primary
    },
    fontPair: {
      heading: baseArchetype?.fontPair.heading ?? resolveThemeFontPair(spec.theme.fontFamily).heading,
      body: baseArchetype?.fontPair.body ?? resolveThemeFontPair(spec.theme.fontFamily).body
    },
    variantBias:
      Object.fromEntries(
        Object.entries(baseLayout?.sectionVariantBias ?? {}).map(([key, values]) => [key, values[0]])
      ) ?? {},
    sectionOrder: spec.structure.sections.filter((section) => section.enabled).map((section) => section.id),
    imageryStyle: baseArchetype?.imageTreatment ?? "restaurant-led imagery",
    industryKey: "restaurant",
    archetypeKey: baseArchetype?.id,
    layoutDNA: baseLayout?.id,
    sectionBlueprints: spec.structure.sections
      .filter((section) => section.enabled && section.rendersAs)
      .map((section) => `${section.id}:${section.variant}`),
    conversionGoal: spec.business.ctaGoal
  };
};

const isAllowedTemplateId = (value: string | null | undefined) =>
  Boolean(value && TEMPLATE_META.some((template) => template.id === value));

const resolveTemplateId = (spec: StudioGenerationSpec) => {
  if (isAllowedTemplateId(spec.compatibility.legacyTemplateId)) {
    return spec.compatibility.legacyTemplateId as string;
  }
  return DEFAULT_TEMPLATE_ID;
};

const resolveThemeTokens = (spec: StudioGenerationSpec): SiteThemeTokens => {
  const designDNA = resolveDesignDNA(spec);
  const archetype = getArchetypeById(designDNA.archetypeKey);
  const layout = getLayoutById(designDNA.layoutDNA);
  const theme = buildTheme(
    spec.theme.primary,
    spec.theme.background || spec.theme.secondary,
    spec.theme.fontFamily
  );
  const fontPair = resolveThemeFontPair(spec.theme.fontFamily);
  const isEditorialTypography = /playfair|cormorant|serif/i.test(fontPair.heading);
  const textStyles = theme.textStyles
    ? {
        ...theme.textStyles,
        h1: {
          ...theme.textStyles.h1,
          size:
            layout?.cardDensity === "airy"
              ? isEditorialTypography
                ? "4rem"
                : "3.5rem"
              : isEditorialTypography
                ? "3.5rem"
                : "3.1rem",
          weight: isEditorialTypography ? 600 : 700,
          lineHeight: layout?.alignment === "center" ? "1.02" : "1.08",
          letterSpacing: isEditorialTypography ? "0" : "0.03em"
        },
        h2: {
          ...theme.textStyles.h2,
          size: layout?.cardDensity === "compact" ? "2rem" : "2.35rem",
          weight: isEditorialTypography ? 600 : 650,
          lineHeight: "1.12",
          letterSpacing: isEditorialTypography ? "0" : "0.02em"
        },
        h3: {
          ...theme.textStyles.h3,
          size: layout?.cardDensity === "compact" ? "1.35rem" : "1.5rem",
          letterSpacing: isEditorialTypography ? "0.01em" : "0.03em"
        },
        body: {
          ...theme.textStyles.body,
          size: layout?.cardDensity === "compact" ? "0.98rem" : "1rem",
          lineHeight:
            spec.theme.styleMode === "premium" || spec.theme.styleMode === "elegant" ? "1.75" : "1.68",
          letterSpacing: includesAny(spec.business.toneStyle.toLowerCase(), ["modern", "minimal"])
            ? "0.01em"
            : "0"
        },
        caption: {
          ...theme.textStyles.caption,
          letterSpacing: includesAny(spec.business.toneStyle.toLowerCase(), ["premium", "elegant", "modern"])
            ? "0.08em"
            : "0.04em"
        }
      }
    : undefined;
  return {
    ...theme,
    secondary: spec.theme.secondary,
    bg: spec.theme.background,
    surface: spec.theme.surface,
    text: spec.theme.text,
    muted: spec.theme.muted,
    border: spec.theme.border,
    buttonText: spec.theme.buttonText,
    radius: spec.theme.radius,
    fontHeading: fontPair.heading,
    fontBody: fontPair.body,
    textStyles,
    pageTransitions:
      spec.theme.styleMode === "premium" || spec.theme.styleMode === "elegant"
        ? "fade"
        : layout?.id === "split_showcase"
          ? "slide"
          : theme.pageTransitions
  };
};

const buildSectionStyle = ({
  type,
  theme,
  designDNA
}: {
  type: SiteSection["type"];
  theme: SiteThemeTokens;
  designDNA: NonNullable<SiteDocument["siteBrief"]>["designDNA"];
}): SiteSection["style"] => {
  const archetype = getArchetypeById(designDNA?.archetypeKey);
  const layout = getLayoutById(designDNA?.layoutDNA);
  const base = {
    alignment: (layout?.alignment === "center" ? "center" : "left") as SiteSection["style"]["alignment"],
    spacing:
      (layout?.cardDensity === "compact"
        ? "compact"
        : layout?.spacing ?? "normal") as SiteSection["style"]["spacing"],
    background: { type: "plain" as const },
    buttonStyle: (archetype?.ctaStyle === "outline" ? "outline" : "solid") as SiteSection["style"]["buttonStyle"],
    colorOverride: null as SiteSection["style"]["colorOverride"]
  };

  if (type === "hero") {
    if (layout?.heroVariant === "B" || designDNA?.layoutDNA === "immersive_stack") {
      return {
        ...base,
        alignment: "center",
        spacing: "airy",
        background: {
          type: "image",
          overlay: archetype?.contrast === "high" ? 0.56 : 0.42,
          position: "center",
          size: "cover",
          repeat: "no-repeat"
        },
        colorOverride: { text: "#FFF8F1", bg: theme.primary, primary: theme.secondary },
        buttonStyle: archetype?.ctaStyle === "outline" ? "outline" : "solid"
      };
    }

    if (layout?.heroVariant === "C" || designDNA?.layoutDNA === "editorial_stack") {
      return {
        ...base,
        spacing: "airy",
        background: {
          type: "gradient",
          angle: 135,
          stops: [
            { color: theme.surface, position: 0 },
            { color: theme.bg, position: 100 }
          ]
        }
      };
    }

    return {
      ...base,
      alignment: "center",
      spacing: "airy",
      background: {
        type: "gradient",
        angle: 180,
        stops: [
          { color: `${theme.secondary}26`, position: 0 },
          { color: theme.bg, position: 100 }
        ]
      }
    };
  }

  if (type === "reservation") {
    return {
      ...base,
      alignment: "center",
      spacing: "airy",
      background:
        archetype?.contrast === "high"
          ? {
              type: "gradient",
              angle: 140,
              stops: [
                { color: theme.primary, position: 0 },
                { color: theme.text, position: 100 }
              ]
            }
          : {
              type: "gradient",
              angle: 135,
              stops: [
                { color: `${theme.secondary}33`, position: 0 },
                { color: theme.surface, position: 100 }
              ]
            },
      colorOverride:
        archetype?.contrast === "high"
          ? { bg: theme.primary, text: "#FFF8F1", primary: theme.secondary }
          : null,
      buttonStyle: "solid"
    };
  }

  if (type === "testimonials") {
    return archetype?.contrast === "high"
      ? {
          ...base,
          alignment: "center",
          background: {
            type: "gradient",
            angle: 135,
            stops: [
              { color: theme.primary, position: 0 },
              { color: theme.text, position: 100 }
            ]
          },
          colorOverride: { bg: theme.primary, text: "#FFF8F1", primary: theme.secondary },
          buttonStyle: "outline"
        }
      : {
          ...base,
          background: {
            type: "gradient",
            angle: 180,
            stops: [
              { color: `${theme.secondary}24`, position: 0 },
              { color: theme.bg, position: 100 }
            ]
          }
        };
  }

  if (type === "gallery") {
    return {
      ...base,
      spacing: "airy",
      background:
        designDNA?.layoutDNA === "immersive_stack"
          ? {
              type: "gradient",
              angle: 180,
              stops: [
                { color: theme.surface, position: 0 },
                { color: theme.bg, position: 100 }
              ]
            }
          : { type: "plain" }
    };
  }

  if (type === "about" || type === "services" || type === "contact") {
    if (layout?.cardDensity === "airy") {
      return {
        ...base,
        spacing: "airy",
        background:
          type === "contact"
            ? {
                type: "gradient",
                angle: 180,
                stops: [
                  { color: `${theme.secondary}1f`, position: 0 },
                  { color: theme.bg, position: 100 }
                ]
              }
            : { type: "plain" }
      };
    }
    return base;
  }

  if (type === "footer") {
    return {
      ...base,
      alignment: "center",
      spacing: "normal",
      buttonStyle: "outline"
    };
  }

  return base;
};

const buildSectionContentStyles = ({
  type,
  theme,
  designDNA
}: {
  type: SiteSection["type"];
  theme: SiteThemeTokens;
  designDNA: NonNullable<SiteDocument["siteBrief"]>["designDNA"];
}): Record<string, ContentStyle> | undefined => {
  const layout = getLayoutById(designDNA?.layoutDNA);
  const isEditorialTypography = /playfair|cormorant|serif/i.test(theme.fontHeading ?? "");
  const headingTransform = isEditorialTypography ? "none" : "uppercase";
  const headingLetterSpacing = isEditorialTypography ? "0" : "0.08em";
  const textAlign = layout?.alignment === "center" ? "center" : "left";
  const sharedTitle: ContentStyle = {
    textAlign,
    textTransform: headingTransform,
    letterSpacing: headingLetterSpacing,
    fontFamily: theme.fontHeading,
    maxWidth: layout?.alignment === "center" ? "14ch" : "12ch"
  };
  const sharedBody: ContentStyle = {
    textAlign,
    fontFamily: theme.fontBody,
    maxWidth: layout?.alignment === "center" ? "58ch" : "62ch",
    opacity: 0.92
  };

  switch (type) {
    case "hero":
      return {
        eyebrow: {
          textAlign,
          textTransform: "uppercase",
          letterSpacing: "0.12em",
          fontFamily: theme.fontBody,
          opacity: 0.75
        },
        headline: sharedTitle,
        subheadline: sharedBody,
        ctaLabel: {
          textAlign,
          fontFamily: theme.fontBody,
          fontWeight: 600
        }
      };
    case "about":
    case "services":
    case "gallery":
    case "testimonials":
    case "contact":
      return {
        title: sharedTitle,
        body: sharedBody
      };
    case "reservation":
      return {
        title: { ...sharedTitle, maxWidth: "16ch" },
        body: { ...sharedBody, maxWidth: "48ch" },
        ctaLabel: {
          textAlign,
          fontFamily: theme.fontBody,
          fontWeight: 600
        }
      };
    case "footer":
      return {
        text: {
          textAlign: "center",
          fontFamily: theme.fontBody,
          opacity: 0.78
        }
      };
    default:
      return undefined;
  }
};

const toSiteImage = (
  sectionId: string,
  image: StudioGenerationSpec["business"]["galleryImages"][number],
  index: number
): SiteImage => ({
  slot: `${sectionId}-${index + 1}`,
  src: image.src,
  alt: image.alt,
  width: image.width,
  height: image.height
});

const buildGalleryImages = (sectionId: string, spec: StudioGenerationSpec) =>
  spec.business.galleryImages.map((image, index) => toSiteImage(sectionId, image, index));

const buildSectionContent = (
  section: StudioGenerationSpec["structure"]["sections"][number],
  spec: StudioGenerationSpec
): Record<string, any> => {
  switch (section.rendersAs) {
    case "hero":
      return {
        eyebrow: spec.content.hero.eyebrow ?? undefined,
        headline: spec.content.hero.headline,
        subheadline: spec.content.hero.subheadline,
        ctaLabel: spec.content.hero.primaryCtaLabel,
        ctaHref: spec.content.hero.primaryCtaHref
      };
    case "about":
      return {
        title: spec.content.intro.title,
        body: spec.content.intro.body
      };
    case "services":
      return {
        title: spec.content.menuHighlights.title,
        items: spec.content.menuHighlights.items.map((item) => ({
          title: item.name,
          body:
            [item.description, item.price].filter(Boolean).join(" ") ||
            "Signature dish highlight prepared for this restaurant."
        }))
      };
    case "reservation":
      return {
        title: spec.content.cta.title,
        body: spec.content.cta.body,
        ctaLabel: spec.content.cta.label,
        ctaHref: spec.content.cta.href
      };
    case "gallery":
      return {
        title: spec.business.galleryImages.length ? "Gallery" : "Dining experience"
      };
    case "testimonials":
      return {
        title: "Guest favorites",
        items: spec.content.testimonials.map((item) => ({
          quote: item.quote,
          name: item.name
        }))
      };
    case "contact":
      return {
        title: spec.content.contact.title,
        body: spec.content.contact.body,
        ctaLabel: spec.business.reservation.enabled ? spec.business.reservation.label : "Contact us",
        ctaHref: spec.business.reservation.enabled ? spec.business.reservation.href : "#location-hours",
        phone: spec.content.contact.phone,
        email: spec.content.contact.email,
        address: spec.content.contact.address,
        openingHours: spec.content.contact.openingHours
      };
    case "footer":
      return {
        text: spec.content.footer.text
      };
    default:
      return {};
  }
};

const buildSectionImages = (
  section: StudioGenerationSpec["structure"]["sections"][number],
  spec: StudioGenerationSpec
) => {
  if (section.rendersAs === "gallery") {
    return buildGalleryImages(section.id, spec);
  }
  if (section.rendersAs === "hero" || section.rendersAs === "about") {
    const firstImage = spec.business.galleryImages[0];
    return firstImage ? [toSiteImage(section.id, firstImage, 0)] : undefined;
  }
  return undefined;
};

const resolveVariant = (
  templateId: string,
  type: SiteSection["type"],
  requestedVariant: string | null | undefined
) => {
  const allowed = TEMPLATE_ALLOWED_VARIANTS[templateId]?.[type] ?? TEMPLATE_ALLOWED_VARIANTS[DEFAULT_TEMPLATE_ID]?.[type] ?? ["A"];
  if (requestedVariant && allowed.includes(requestedVariant)) {
    return requestedVariant;
  }
  const templateDefault = TEMPLATE_DEFAULT_SECTIONS[templateId]?.find((section) => section.type === type)?.variant;
  if (templateDefault && allowed.includes(templateDefault)) {
    return templateDefault;
  }
  return allowed[0] ?? "A";
};

const buildBaseSections = (
  spec: StudioGenerationSpec,
  templateId: string,
  theme: SiteThemeTokens,
  designDNA: NonNullable<SiteDocument["siteBrief"]>["designDNA"]
): SiteSection[] => {
  return spec.structure.sections
    .filter((section): section is typeof section & { rendersAs: NonNullable<typeof section.rendersAs> } => Boolean(section.rendersAs))
    .map((section) => {
      const type = section.rendersAs as SiteSection["type"];
      return {
        id: section.id,
        type,
        variant: resolveVariant(templateId, type, section.variant),
        name: section.type
          .replaceAll("_", " ")
          .replace(/\b\w/g, (token) => token.toUpperCase()),
        enabled: section.enabled,
        style: buildSectionStyle({ type, theme, designDNA }),
        content: buildSectionContent(section, spec),
        contentStyles: buildSectionContentStyles({ type, theme, designDNA }),
        images: buildSectionImages(section, spec)
      };
    });
};

const dedupeImages = (images: SiteImage[]) => {
  const seen = new Set<string>();
  return images.filter((image) => {
    const key = `${image.slot}:${image.src}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

export const buildStudioSiteDocumentSkeleton = (spec: StudioGenerationSpec): SiteDocument => {
  const templateId = resolveTemplateId(spec);
  const theme = resolveThemeTokens(spec);
  const designDNA = resolveDesignDNA(spec);
  const sections = buildBaseSections(spec, templateId, theme, designDNA);
  const mediaLibrary = dedupeImages(
    sections.flatMap((section) => section.images ?? []).concat(buildGalleryImages("gallery", spec))
  );

  const document = SiteDocumentSchema.parse({
    templateId,
    tone: spec.business.toneStyle,
    theme,
    seo: {
      title: `${spec.business.name} | ${spec.business.cuisineType ?? "Restaurant"}`,
      description: spec.business.description,
      ogImage: mediaLibrary[0]?.src ?? null
    },
    pages: [
      {
        id: "page-home",
        name: "Home",
        slug: "home",
        order: 0,
        showInMenu: true,
        menuTitle: "Home",
        parentId: null,
        sections
      }
    ],
    siteBrief: {
      businessName: spec.business.name,
      logoUrl: spec.business.logoUrl ?? undefined,
      industry: spec.compatibility.legacyIndustry,
      description: spec.business.description,
      tone: spec.business.toneStyle,
      goals: [spec.business.ctaGoal],
      pages: ["Home"],
      generationBrief: spec.compatibility.generationBrief,
      theme: {
        primary: theme.primary,
        background: theme.bg,
        fontFamily: spec.theme.fontFamily
      },
      designDNA
    },
    mediaLibrary
  });

  logStudioVariationSnapshot("skeleton", { spec, document });
  return document;
};

const extractJsonBlock = (content: string) => {
  const fencedMatch = content.match(/```json\s*([\s\S]*?)```/i) ?? content.match(/```\s*([\s\S]*?)```/i);
  if (fencedMatch?.[1]) {
    return fencedMatch[1].trim();
  }
  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return content.slice(firstBrace, lastBrace + 1);
  }
  return content;
};

export const parseV0SiteDocumentCandidate = (content: string): unknown => {
  const direct = content.trim();
  if (!direct) {
    throw new Error("v0 returned an empty site document file.");
  }
  try {
    return JSON.parse(direct);
  } catch {
    return JSON.parse(extractJsonBlock(direct));
  }
};

const isValidImageSrc = (value: unknown) =>
  typeof value === "string" && (value.startsWith("/") || /^https?:\/\//i.test(value));

const sanitizeImages = (value: unknown): SiteImage[] | undefined => {
  if (!Array.isArray(value)) return undefined;
  const images: Array<SiteImage | null> = value.map((item, index) => {
      if (!isRecord(item) || !isValidImageSrc(item.src)) return null;
      return {
        slot: normalizeText(item.slot) || `image-${index + 1}`,
        src: item.src,
        alt: normalizeText(item.alt) || undefined,
        width: typeof item.width === "number" ? item.width : undefined,
        height: typeof item.height === "number" ? item.height : undefined,
        query: normalizeText(item.query) || undefined
      } satisfies SiteImage;
    });
  const filtered = images.filter((item): item is SiteImage => item !== null);
  return filtered.length ? filtered : undefined;
};

const mergeSectionStyle = (baseStyle: SiteSection["style"], candidateStyle: unknown): SiteSection["style"] => {
  if (!isRecord(candidateStyle)) return baseStyle;
  return {
    ...baseStyle,
    ...candidateStyle,
    background: isRecord(candidateStyle.background)
      ? {
          ...baseStyle.background,
          ...candidateStyle.background
        }
      : baseStyle.background,
    colorOverride:
      candidateStyle.colorOverride === null
        ? null
        : isRecord(candidateStyle.colorOverride)
          ? {
              ...(baseStyle.colorOverride ?? {}),
              ...candidateStyle.colorOverride
            }
          : baseStyle.colorOverride ?? null
  };
};

const sanitizePrimitiveLike = (baseValue: unknown, candidateValue: unknown) => {
  if (typeof baseValue === "string" || baseValue === null) {
    const next = normalizeText(candidateValue);
    return next || baseValue;
  }
  if (typeof baseValue === "number") {
    return typeof candidateValue === "number" && Number.isFinite(candidateValue)
      ? candidateValue
      : baseValue;
  }
  if (typeof baseValue === "boolean") {
    return typeof candidateValue === "boolean" ? candidateValue : baseValue;
  }
  return baseValue;
};

const sanitizePlainJson = (value: unknown, depth = 0): unknown => {
  if (depth > 3) return undefined;
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed || undefined;
    }
    if (typeof value === "number" && !Number.isFinite(value)) {
      return undefined;
    }
    return value;
  }
  if (Array.isArray(value)) {
    const items = value
      .map((item) => sanitizePlainJson(item, depth + 1))
      .filter((item) => item !== undefined)
      .slice(0, 12);
    return items.length ? items : undefined;
  }
  if (isRecord(value)) {
    const entries = Object.entries(value)
      .slice(0, 20)
      .map(([key, item]) => [key, sanitizePlainJson(item, depth + 1)] as const)
      .filter(([, item]) => item !== undefined);
    return entries.length ? Object.fromEntries(entries) : undefined;
  }
  return undefined;
};

const sanitizeContentFieldLike = (baseValue: unknown, candidateValue: unknown): unknown => {
  if (candidateValue === undefined) return baseValue;

  if (
    typeof baseValue === "string" ||
    typeof baseValue === "number" ||
    typeof baseValue === "boolean" ||
    baseValue === null
  ) {
    return sanitizePrimitiveLike(baseValue, candidateValue);
  }

  if (Array.isArray(baseValue)) {
    if (!Array.isArray(candidateValue)) return baseValue;
    if (baseValue.length === 0) {
      const items = candidateValue
        .map((item) => sanitizePlainJson(item))
        .filter((item) => item !== undefined)
        .slice(0, 12);
      return items.length ? items : baseValue;
    }
    const exemplar = baseValue[0];
    const items = candidateValue
      .map((item) => sanitizeContentFieldLike(exemplar, item))
      .filter((item) => item !== undefined)
      .slice(0, 12);
    return items.length ? items : baseValue;
  }

  if (isRecord(baseValue)) {
    if (!isRecord(candidateValue)) return baseValue;
    const baseKeys = Object.keys(baseValue);
    if (baseKeys.length === 0) {
      return sanitizePlainJson(candidateValue) ?? baseValue;
    }
    return Object.fromEntries(
      baseKeys.map((key) => [key, sanitizeContentFieldLike(baseValue[key], candidateValue[key])])
    );
  }

  return baseValue;
};

const mergeSectionContent = (
  baseContent: Record<string, any>,
  candidateContent: unknown
) => {
  if (!isRecord(candidateContent)) return baseContent;
  return Object.fromEntries(
    Object.keys(baseContent).map((key) => [key, sanitizeContentFieldLike(baseContent[key], candidateContent[key])])
  );
};

const sanitizeContentStyle = (
  baseValue: ContentStyle | undefined,
  candidateValue: unknown
): ContentStyle | undefined => {
  if (!baseValue || !isRecord(candidateValue)) return baseValue;
  return {
    color: normalizeHex(candidateValue.color) ?? baseValue.color,
    fontSize: sanitizeCssLength(candidateValue.fontSize, baseValue.fontSize),
    fontWeight:
      typeof candidateValue.fontWeight === "number" && Number.isFinite(candidateValue.fontWeight)
        ? candidateValue.fontWeight
        : baseValue.fontWeight,
    fontStyle: sanitizeFontStyle(candidateValue.fontStyle, baseValue.fontStyle),
    lineHeight: sanitizeCssLength(candidateValue.lineHeight, baseValue.lineHeight),
    letterSpacing: sanitizeCssLength(candidateValue.letterSpacing, baseValue.letterSpacing),
    fontFamily: normalizeText(candidateValue.fontFamily) || baseValue.fontFamily,
    textAlign: sanitizeTextAlign(candidateValue.textAlign, baseValue.textAlign),
    textTransform: sanitizeTextTransform(candidateValue.textTransform, baseValue.textTransform),
    textDecoration:
      candidateValue.textDecoration === "none" ||
      candidateValue.textDecoration === "underline" ||
      candidateValue.textDecoration === "line-through"
        ? candidateValue.textDecoration
        : baseValue.textDecoration,
    maxWidth: sanitizeCssLength(candidateValue.maxWidth, baseValue.maxWidth),
    opacity:
      typeof candidateValue.opacity === "number" && Number.isFinite(candidateValue.opacity)
        ? candidateValue.opacity
        : baseValue.opacity
  };
};

const mergeSectionContentStyles = (
  baseContentStyles: SiteSection["contentStyles"],
  candidateContentStyles: unknown
) => {
  if (!baseContentStyles || !isRecord(candidateContentStyles)) return baseContentStyles;
  const entries = Object.keys(baseContentStyles)
    .map((key) => [key, sanitizeContentStyle(baseContentStyles[key], candidateContentStyles[key])] as const)
    .filter(([, value]) => value !== undefined);
  return entries.length ? (Object.fromEntries(entries) as Record<string, ContentStyle>) : baseContentStyles;
};

const shouldMergeSection = (
  baseSectionId: string,
  scope: StudioRefinementScope | null | undefined,
  sectionId?: string | null
) => {
  if (!scope || !sectionId) return true;
  if (scope === "section" || scope === "content_only") {
    return baseSectionId === sectionId;
  }
  return true;
};

const findCandidateSection = (
  candidateSections: Record<string, any>[],
  baseSection: SiteSection,
  usedIndexes: Set<number>
) => {
  const exactIndex = candidateSections.findIndex(
    (section, index) => !usedIndexes.has(index) && normalizeText(section.id) === baseSection.id
  );
  if (exactIndex >= 0) return exactIndex;
  return candidateSections.findIndex(
    (section, index) => !usedIndexes.has(index) && normalizeText(section.type) === baseSection.type
  );
};

const mergeThemeTokens = (
  spec: StudioGenerationSpec,
  baseTheme: SiteThemeTokens,
  candidateTheme: unknown,
  candidateDesignDNA: unknown
): SiteThemeTokens => {
  const designDNA = resolveDesignDNA(spec, candidateDesignDNA);
  const archetype = getArchetypeById(designDNA.archetypeKey);
  const fontPair = resolveThemeFontPair(
    isRecord(candidateTheme) ? normalizeText(candidateTheme.fontBody || candidateTheme.fontFamily) : spec.theme.fontFamily
  );
  const derivedBase = {
    primary: archetype?.palette.primary ?? baseTheme.primary,
    secondary: archetype?.palette.secondary ?? baseTheme.secondary,
    bg: archetype?.palette.background ?? baseTheme.bg,
    surface: archetype?.palette.surface ?? baseTheme.surface,
    text: archetype?.palette.text ?? baseTheme.text,
    muted: archetype?.palette.muted ?? baseTheme.muted,
    border: archetype?.palette.border ?? baseTheme.border,
    buttonText: archetype?.palette.buttonText ?? baseTheme.buttonText
  };

  if (!isRecord(candidateTheme)) {
    return {
      ...baseTheme,
      ...derivedBase,
      fontHeading: designDNA.fontPair?.heading ?? fontPair.heading ?? baseTheme.fontHeading,
      fontBody: designDNA.fontPair?.body ?? fontPair.body ?? baseTheme.fontBody
    };
  }

  const pageTransition = normalizeText(candidateTheme.pageTransitions);
  return {
    ...baseTheme,
    primary: normalizeHex(candidateTheme.primary) ?? derivedBase.primary,
    secondary: normalizeHex(candidateTheme.secondary) ?? derivedBase.secondary,
    bg:
      normalizeHex(candidateTheme.bg) ??
      normalizeHex(candidateTheme.background) ??
      derivedBase.bg,
    surface: normalizeHex(candidateTheme.surface) ?? derivedBase.surface,
    text: normalizeHex(candidateTheme.text) ?? derivedBase.text,
    muted: normalizeHex(candidateTheme.muted) ?? derivedBase.muted,
    border: normalizeText(candidateTheme.border) || derivedBase.border,
    buttonText: normalizeHex(candidateTheme.buttonText) ?? derivedBase.buttonText,
    radius: candidateTheme.radius === "lg" || candidateTheme.radius === "xl" ? candidateTheme.radius : baseTheme.radius,
    fontHeading: designDNA.fontPair?.heading ?? fontPair.heading ?? baseTheme.fontHeading,
    fontBody: designDNA.fontPair?.body ?? fontPair.body ?? baseTheme.fontBody,
    textStyles: mergeThemeTextStyles(baseTheme.textStyles, candidateTheme.textStyles),
    pageTransitions:
      pageTransition === "none" || pageTransition === "fade" || pageTransition === "slide"
        ? pageTransition
        : baseTheme.pageTransitions
  };
};

const buildVariantBiasFromPages = (pages: SitePage[]) => {
  const entries = pages
    .flatMap((page) => page.sections)
    .filter((section) => section.enabled)
    .map((section) => [section.type, section.variant] as const);
  return Object.fromEntries(entries);
};

const mergeSiteBrief = (
  spec: StudioGenerationSpec,
  baseSiteBrief: SiteDocument["siteBrief"],
  candidateValue: unknown,
  theme: SiteThemeTokens,
  pages: SitePage[]
) => {
  const candidateSiteBrief = isRecord(candidateValue) ? candidateValue : {};
  const designDNA = resolveDesignDNA(spec, candidateSiteBrief.designDNA);
  const layout = getLayoutById(designDNA.layoutDNA);
  return {
    ...(baseSiteBrief ?? {}),
    businessName: normalizeText(candidateSiteBrief.businessName) || baseSiteBrief?.businessName,
    logoUrl: normalizeText(candidateSiteBrief.logoUrl) || baseSiteBrief?.logoUrl,
    industry: baseSiteBrief?.industry,
    description: normalizeText(candidateSiteBrief.description) || baseSiteBrief?.description,
    tone: normalizeText(candidateSiteBrief.tone) || baseSiteBrief?.tone,
    goals: baseSiteBrief?.goals,
    pages: pages.map((page) => page.name),
    generationBrief: baseSiteBrief?.generationBrief,
    theme: {
      primary: theme.primary,
      background: theme.bg,
      fontFamily: theme.fontBody ?? spec.theme.fontFamily
    },
    designDNA: {
      ...designDNA,
      palette: {
        primary: theme.primary,
        secondary: theme.secondary,
        background: theme.bg,
        accent: designDNA.palette?.accent ?? theme.primary
      },
      fontPair: {
        heading: theme.fontHeading ?? designDNA.fontPair?.heading,
        body: theme.fontBody ?? designDNA.fontPair?.body
      },
      variantBias: {
        ...(layout
          ? Object.fromEntries(
              Object.entries(layout.sectionVariantBias ?? {}).map(([key, values]) => [key, values[0]])
            )
          : {}),
        ...(designDNA.variantBias ?? {}),
        ...buildVariantBiasFromPages(pages)
      },
      sectionOrder: pages.flatMap((page) => page.sections.filter((section) => section.enabled).map((section) => section.id)),
      sectionBlueprints: pages.flatMap((page) =>
        page.sections.filter((section) => section.enabled).map((section) => `${section.id}:${section.variant}`)
      )
    }
  };
};

export const normalizeV0SiteDocument = ({
  spec,
  baseDocument,
  candidate,
  refinement
}: {
  spec: StudioGenerationSpec;
  baseDocument: SiteDocument;
  candidate: unknown;
  refinement?: Pick<StudioRefinementPlan, "scope" | "target"> | null;
}): SiteDocument => {
  const candidateRecord = isRecord(candidate) ? candidate : {};
  const candidatePages = Array.isArray(candidateRecord.pages)
    ? candidateRecord.pages.filter(isRecord)
    : [];
  const candidateSections = candidatePages.flatMap((page) =>
    Array.isArray(page.sections) ? page.sections.filter(isRecord) : []
  );
  const usedIndexes = new Set<number>();
  const baseTheme = baseDocument.theme ?? resolveThemeTokens(spec);

  const pages: SitePage[] = baseDocument.pages.map((basePage) => ({
    ...basePage,
    sections: basePage.sections.map((baseSection) => {
      if (
        !shouldMergeSection(
          baseSection.id,
          refinement?.scope ?? null,
          refinement?.target.sectionId ?? null
        )
      ) {
        return baseSection;
      }

      const candidateIndex = findCandidateSection(candidateSections, baseSection, usedIndexes);
      if (candidateIndex < 0) {
        return baseSection;
      }

      usedIndexes.add(candidateIndex);
      const candidateSection = candidateSections[candidateIndex];
      return {
        ...baseSection,
        name: normalizeText(candidateSection.name) || baseSection.name,
        variant: resolveVariant(
          baseDocument.templateId,
          baseSection.type,
          normalizeText(candidateSection.variant) || baseSection.variant
        ),
        style: mergeSectionStyle(baseSection.style, candidateSection.style),
        content: mergeSectionContent(baseSection.content, candidateSection.content),
        contentStyles: mergeSectionContentStyles(baseSection.contentStyles, candidateSection.contentStyles),
        images: sanitizeImages(candidateSection.images) ?? baseSection.images
      };
    })
  }));

  const candidateMediaLibrary = sanitizeImages(candidateRecord.mediaLibrary) ?? [];
  const sectionImages = pages.flatMap((page) => page.sections.flatMap((section) => section.images ?? []));
  const theme = mergeThemeTokens(spec, baseTheme, candidateRecord.theme, candidateRecord.siteBrief?.designDNA);
  const candidateSeo = isRecord(candidateRecord.seo)
    ? {
        title: normalizeText(candidateRecord.seo.title) || baseDocument.seo?.title,
        description:
          normalizeText(candidateRecord.seo.description) || baseDocument.seo?.description,
        ogImage: isValidImageSrc(candidateRecord.seo.ogImage)
          ? candidateRecord.seo.ogImage
          : baseDocument.seo?.ogImage ?? null
      }
    : baseDocument.seo;

  const document = SiteDocumentSchema.parse({
    ...baseDocument,
    tone: baseDocument.tone,
    templateId: baseDocument.templateId,
    theme,
    seo: candidateSeo,
    pages,
    siteBrief: mergeSiteBrief(spec, baseDocument.siteBrief, candidateRecord.siteBrief, theme, pages),
    mediaLibrary: dedupeImages([...(baseDocument.mediaLibrary ?? []), ...candidateMediaLibrary, ...sectionImages])
  });

  logStudioVariationSnapshot("normalized", { spec, document });
  return document;
};

const formatBusinessFacts = (spec: StudioGenerationSpec) => {
  const facts = [
    `Business name: ${spec.business.name}`,
    `Cuisine / concept: ${spec.business.cuisineType ?? "restaurant"}`,
    `Tone: ${spec.business.toneStyle}`,
    `CTA goal: ${spec.business.ctaGoal}`,
    `Reservation enabled: ${spec.business.reservation.enabled ? "yes" : "no"}`,
    `Phone: ${spec.business.phone ?? "not provided"}`,
    `Email: ${spec.business.email ?? "not provided"}`,
    `Address: ${spec.business.address ?? "not provided"}`,
    `Hours: ${spec.business.openingHours ?? "not provided"}`
  ];
  return facts.join("\n");
};

const formatApprovedDesignDirections = () =>
  RESTAURANT_ARCHETYPES.map(
    (entry) =>
      `${entry.id}: ${entry.label} | tone=${entry.tone} | mood=${entry.mood} | layouts=${entry.preferredLayoutIds
        .filter((layoutId) => isAllowedLayoutId(layoutId))
        .join(", ")}`
  ).join("\n");

const formatApprovedLayouts = () =>
  RESTAURANT_LAYOUTS.map(
    (entry) =>
      `${entry.id}: hero=${entry.heroVariant} | spacing=${entry.spacing} | alignment=${entry.alignment} | cardDensity=${entry.cardDensity}`
  ).join("\n");

const formatControls = (controls: StudioGenerationControls) =>
  [
    `Generation mode: ${controls.generationMode}`,
    `Edit mode: ${controls.editMode}`,
    `Allow heavy regeneration: ${controls.allowHeavyRegeneration ? "yes" : "no"}`,
    `Allow image generation: ${controls.allowImageGeneration ? "yes" : "no"}`,
    `Max new images: ${controls.maxNewImages}`,
    `Image policy: ${controls.imagePolicy}`
  ].join("\n");

const formatStarterDirection = (spec: StudioGenerationSpec) => {
  const designDNA = resolveDesignDNA(spec);
  return [
    `Suggested design direction: ${designDNA.archetypeKey ?? spec.theme.styleMode}`,
    `Suggested layout DNA: ${designDNA.layoutDNA ?? "editorial_stack"}`,
    `Suggested typography mood: ${designDNA.fontPair?.heading ?? spec.theme.fontFamily}`,
    `Suggested section blueprint: ${designDNA.sectionBlueprints?.join(" | ") ?? "use enabled sections"}`
  ].join("\n");
};

export const buildV0StudioSystemPrompt = () =>
  [
    "You are generating a restaurant website only inside SiroundChat-owned constraints.",
    "Use the locked siroundchat-studio-spec.json as the product source of truth.",
    "Edit only siroundchat-site-document.json.",
    "Do not add files, pages, sections, apps, raw code editors, or custom code systems.",
    "Do not change section ids, page ids, page slugs, or navigation architecture.",
    "Do not invent random extra navigation labels, unsupported sections, or generic placeholder junk.",
    "You may choose one approved SiroundChat restaurant design direction, one approved layout DNA, approved section variants, approved typography mood, and approved palette treatment inside the allowed schema.",
    "Do not collapse the result back into the same generic editorial restaurant baseline when the business supports a stronger approved direction.",
    "The goal is meaningful visual differentiation across restaurants without breaking the SiroundChat renderer.",
    "Keep the response grounded in the provided business facts. Do not invent customer names, testimonials, addresses, phone numbers, emails, hours, or pricing specifics unless they are present in the locked spec.",
    "Return a valid complete JSON object in siroundchat-site-document.json."
  ].join("\n");

export const buildV0InitialGenerationMessage = (
  spec: StudioGenerationSpec,
  controls: StudioGenerationControls
) =>
  [
    "Generate the first-pass SiroundChat restaurant website by editing only siroundchat-site-document.json.",
    "Allowed work:",
    "- choose one approved restaurant design direction and one approved layout DNA",
    "- refine theme tokens within approved SiroundChat restaurant palette bounds",
    "- select stronger allowed section variants for the existing sections",
    "- adjust section style fields, spacing density, contrast, imagery treatment, reservation emphasis, and visual hierarchy inside the existing structure",
    "- refine typography mood using approved heading/body font pairings and text scale",
    "- improve section copy, CTA emphasis, and section-level storytelling",
    "- choose visibly different hero, gallery, testimonial, intro, and reservation treatments inside supported variants",
    "- use uploaded business/gallery images where relevant",
    "- keep the site premium, modern, restrained, and conversion-focused",
    "",
    "Disallowed work:",
    "- adding or removing pages",
    "- adding or removing sections",
    "- renaming nav architecture",
    "- inventing a palette or layout system outside the approved SiroundChat restaurant design directions",
    "- drifting back to the same neutral restaurant template if a stronger approved direction fits the business",
    "- inventing unsupported flows or code systems",
    "",
    formatBusinessFacts(spec),
    "",
    formatStarterDirection(spec),
    "",
    `Current theme tokens: ${JSON.stringify(spec.theme)}`,
    `Enabled section order: ${spec.structure.sections
      .filter((section) => section.rendersAs)
      .map((section) => `${section.id}:${section.type}:${section.enabled ? "enabled" : "disabled"}`)
      .join(" -> ")}`,
    "",
    `Cost controls:\n${formatControls(controls)}`,
    controls.allowImageGeneration
      ? `If new imagery is genuinely needed, generate at most ${controls.maxNewImages} new hero/gallery assets and reuse them consistently.`
      : "Do not generate new images. Reuse existing business/gallery assets and keep current image slots intact.",
    "",
    `Approved restaurant design directions:\n${formatApprovedDesignDirections()}`,
    "",
    `Approved layout DNA:\n${formatApprovedLayouts()}`,
    "",
    "Make the website launch-ready inside the current SiroundChat renderer."
  ]
    .filter(Boolean)
    .join("\n");

export const buildV0RefinementMessage = ({
  spec,
  refinement,
  sectionId,
  controls
}: {
  spec: StudioGenerationSpec;
  refinement: StudioRefinementPlan;
  sectionId?: string;
  controls: StudioGenerationControls;
}) =>
  [
    "Apply a scoped refinement by editing only siroundchat-site-document.json.",
    `Scope: ${refinement.scope}`,
    `Request: ${refinement.request}`,
    `Allowed operations: ${refinement.allowedOperations.join(", ")}`,
    sectionId ? `Target section id: ${sectionId}` : null,
    refinement.target.pageId ? `Target page id: ${refinement.target.pageId}` : null,
    refinement.target.sectionType ? `Target section type: ${refinement.target.sectionType}` : null,
    "",
    "Only modify the smallest relevant portion of the existing site document.",
    "Do not alter unrelated sections, pages, apps, or custom code.",
    "Do not add unsupported sections or change the locked restaurant-first architecture.",
    "You may still adjust approved design DNA, palette treatment, typography mood, and section variants when the requested scope requires it.",
    controls.allowHeavyRegeneration
      ? "A broader regeneration is allowed only inside the requested scope."
      : "Do not regenerate unrelated sections or perform a full-site rewrite for this edit.",
    controls.allowImageGeneration
      ? `Only generate new imagery if the request explicitly requires it, and cap it at ${controls.maxNewImages} assets.`
      : "Do not generate new images for this edit. Preserve existing imagery and focus on theme, layout treatment, variants, and copy.",
    "",
    formatStarterDirection(spec),
    "",
    `Cost controls:\n${formatControls(controls)}`,
    "",
    formatBusinessFacts(spec)
  ]
    .filter(Boolean)
    .join("\n");

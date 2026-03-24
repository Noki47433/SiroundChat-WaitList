import { colorTokens } from "@/lib/builder/design/tokens";
import type { GenerationSiteDocument } from "@/lib/builder/generation/schemas/site";
import type { StrictSection } from "@/lib/builder/generation/schemas/sections";
import type { SiteDocument, SiteSection, SiteThemeTokens } from "@/lib/website-builder/types";

const spacingToLegacy = (value: "compact" | "normal" | "balanced"): SiteSection["style"]["spacing"] => {
  if (value === "compact") return "compact";
  if (value === "normal") return "normal";
  return "airy";
};

const toTheme = (tokenSetId: keyof typeof colorTokens): SiteThemeTokens => {
  const palette = colorTokens[tokenSetId];
  const isClinic = tokenSetId === "clinic-calm";
  return {
    primary: palette.primary,
    secondary: palette.secondary,
    bg: palette.neutral,
    text: isClinic ? "#1A2B2A" : "#111827",
    muted: isClinic ? "#4F6664" : "#475569",
    surface: "#FFFFFF",
    border: "rgba(15,23,42,0.12)",
    buttonText: "#FFFFFF",
    accent: palette.accent,
    radius: "xl",
    fontHeading: isClinic ? "Georgia, \"Times New Roman\", serif" : "Sora, Inter, system-ui, sans-serif",
    fontBody: "Inter, system-ui, sans-serif",
    textStyles: isClinic
      ? {
          h1: { size: "3.35rem", weight: 600, lineHeight: "1.12", letterSpacing: "-0.01em" },
          h2: { size: "2.55rem", weight: 600, lineHeight: "1.16", letterSpacing: "-0.01em" },
          h3: { size: "1.65rem", weight: 600, lineHeight: "1.25", letterSpacing: "-0.005em" },
          body: { size: "1.05rem", weight: 400, lineHeight: "1.72", letterSpacing: "0" },
          caption: { size: "0.86rem", weight: 500, lineHeight: "1.5", letterSpacing: "0.02em" }
        }
      : undefined,
    pageTransitions: "fade"
  };
};

const toLegacyContent = (section: StrictSection): Record<string, unknown> => {
  switch (section.type) {
    case "hero":
      return {
        headline: section.content.headline,
        subheadline: section.content.subhead,
        ctaLabel: section.content.primaryCta.label,
        ctaHref: section.content.primaryCta.href ?? "#contact",
        ctaAction: section.content.primaryCta.action
      };
    case "about":
      return {
        title: section.content.title,
        body: section.content.body
      };
    case "services":
      return {
        title: section.content.title,
        items: section.content.items
      };
    case "testimonials":
      return {
        title: section.content.title,
        items: section.content.items
      };
    case "gallery":
      return {
        title: section.content.title
      };
    case "pricing":
      return {
        title: section.content.title,
        plans: section.content.plans
      };
    case "faq":
      return {
        title: section.content.title,
        items: section.content.items
      };
    case "cta":
      return {
        title: section.content.title,
        body: section.content.body,
        ctaLabel: section.content.primaryCta.label,
        ctaHref: section.content.primaryCta.href ?? "#contact",
        ctaAction: section.content.primaryCta.action
      };
    case "contact":
      return {
        title: section.content.title,
        body: section.content.body,
        email: section.content.email,
        phone: section.content.phone,
        address: section.content.address
      };
    case "footer":
      return {
        text: section.content.line
      };
    default:
      return {};
  }
};

const toLegacySection = (section: StrictSection): SiteSection => {
  const background =
    section.type === "hero" && section.variant !== "A" && (section.images?.length ?? 0) > 0
      ? {
          type: "image" as const,
          value: section.images?.[0]?.src,
          overlay: 0.5,
          size: "cover" as const,
          position: "center",
          repeat: "no-repeat" as const
        }
      : ({ type: "plain" } as const);

  return {
    id: section.sectionId,
    type: section.type,
    variant: section.variant,
    enabled: section.enabled,
    style: {
      alignment: section.alignmentProfile,
      spacing: spacingToLegacy(section.spacingProfile),
      background,
      buttonStyle: "solid",
      colorOverride: null
    },
    content: toLegacyContent(section),
    images: (section.images ?? []).map((image) => ({
      slot: image.slot,
      src: image.src,
      alt: image.alt,
      width: image.width,
      height: image.height,
      query: image.query
    }))
  };
};

export const toLegacySiteDocument = (doc: GenerationSiteDocument, businessName: string): SiteDocument => {
  const firstPage = doc.pages[0];
  return {
    templateId: doc.templateId,
    tone: doc.toneProfile,
    theme: toTheme(doc.tokenSetId),
    pages: doc.pages.map((page, index) => ({
      id: page.pageId,
      name: page.title,
      slug: page.slug,
      order: index,
      showInMenu: true,
      menuTitle: page.title,
      parentId: null,
      sections: page.sections.map((section) => toLegacySection(section))
    })),
    siteBrief: {
      businessName,
      industry: "",
      tone: doc.toneProfile,
      pages: doc.pages.map((page) => page.title)
    },
    seo: {
      title: `${businessName} | ${firstPage?.title ?? "Home"}`,
      description: `${businessName} website`
    },
    mediaLibrary: doc.pages.flatMap((page) => page.sections.flatMap((section) => section.images ?? []))
  };
};

import {
  STUDIO_SPEC_VERSION,
  StudioRefinementPlanSchema,
  type StudioRefinementPlan,
  type StudioRefinementScope
} from "@/lib/website-studio/schema";

type RefinementContext = {
  pageId?: string | null;
  sectionId?: string | null;
  sectionType?: string | null;
  contentKey?: string | null;
};

const includesAny = (value: string, terms: string[]) => terms.some((term) => value.includes(term));

const SECTION_TERMS = [
  "hero",
  "headline",
  "above the fold",
  "gallery",
  "images",
  "imagery",
  "photos",
  "reservation",
  "reservations",
  "booking",
  "book table",
  "testimonial",
  "testimonials",
  "reviews",
  "social proof",
  "footer",
  "contact",
  "hours",
  "location",
  "address",
  "about",
  "story",
  "menu",
  "signature",
  "dishes"
];

const THEME_TERMS = [
  "color",
  "palette",
  "theme",
  "font",
  "typography",
  "dark",
  "light",
  "style mode",
  "contrast",
  "cleaner",
  "clutter",
  "spacing",
  "density",
  "more elegant",
  "more premium",
  "more modern",
  "more luxurious",
  "warmer",
  "warmer and more welcoming"
];

const scopeFromRequest = (request: string, context: RefinementContext): StudioRefinementScope => {
  const normalized = request.toLowerCase();
  const hasSectionCue = Boolean(context.sectionId || context.sectionType) || includesAny(normalized, SECTION_TERMS);

  if (
    includesAny(normalized, [
      "whole site",
      "entire site",
      "everything",
      "all sections",
      "full site",
      "regenerate site"
    ])
  ) {
    return "full_site";
  }

  if (includesAny(normalized, ["nav", "navigation", "menu item", "navbar"])) {
    return "navbar_only";
  }

  if (includesAny(normalized, ["page", "home", "menu page", "contact page", "about page"])) {
    return "page";
  }

  if (hasSectionCue) {
    return "section";
  }

  if (includesAny(normalized, THEME_TERMS)) {
    return "theme_only";
  }

  return "content_only";
};

const operationsForScope = (scope: StudioRefinementScope): StudioRefinementPlan["allowedOperations"] => {
  switch (scope) {
    case "theme_only":
      return ["update_theme_tokens", "switch_style_mode"];
    case "navbar_only":
      return ["rename_nav_item", "reorder_nav_items"];
    case "content_only":
      return ["update_content_fields"];
    case "section":
      return ["update_content_fields", "show_hide_section", "swap_section_variant", "regenerate_section"];
    case "page":
      return ["update_content_fields", "reorder_sections", "regenerate_page_sections"];
    case "full_site":
      return ["update_content_fields", "update_theme_tokens", "reorder_sections", "regenerate_site"];
    default:
      return ["update_content_fields"];
  }
};

export function classifyStudioRefinementRequest(
  request: string,
  context: RefinementContext = {}
): StudioRefinementPlan {
  const trimmed = request.trim();
  const scope = scopeFromRequest(trimmed, context);
  const plan = {
    version: STUDIO_SPEC_VERSION,
    request: trimmed,
    scope,
    target: {
      pageId: context.pageId ?? null,
      sectionId: context.sectionId ?? null,
      sectionType: context.sectionType ?? null,
      contentKey: context.contentKey ?? null
    },
    allowedOperations: operationsForScope(scope),
    providerAllowed: ["full_site", "page", "section", "content_only", "theme_only"].includes(scope),
    safety: {
      disallowUnknownSections: true,
      disallowRawCodeRewrite: true,
      disallowFreeformCanvas: true
    },
    createdAt: new Date().toISOString()
  };

  return StudioRefinementPlanSchema.parse(plan);
}

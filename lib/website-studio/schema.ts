import { z } from "zod";

export const STUDIO_SPEC_VERSION = 1;

export const StudioVerticalSchema = z.literal("restaurant");

export const StudioStyleModeSchema = z.enum([
  "premium",
  "modern",
  "elegant",
  "casual",
  "minimal",
  "warm",
  "bold"
]);

export const StudioMotionProfileSchema = z.enum(["none", "subtle", "standard"]);

export const StudioCtaGoalSchema = z.enum([
  "reserve_table",
  "call",
  "directions",
  "contact",
  "view_menu"
]);

export const RestaurantAmbianceTagSchema = z.enum([
  "premium",
  "romantic",
  "family",
  "modern",
  "elegant",
  "casual",
  "cozy",
  "lively",
  "minimal",
  "traditional"
]);

export const StudioSectionTypeSchema = z.enum([
  "navbar",
  "hero",
  "intro",
  "signature_dishes",
  "reservation_cta",
  "gallery",
  "testimonials",
  "location_hours",
  "footer"
]);

export const StudioRenderedSectionTypeSchema = z.enum([
  "hero",
  "about",
  "services",
  "reservation",
  "gallery",
  "testimonials",
  "contact",
  "footer"
]);

const HexColorSchema = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/);

export const RestaurantMenuItemSchema = z.object({
  name: z.string().trim().min(1),
  description: z.string().trim().optional(),
  price: z.string().trim().optional(),
  category: z.string().trim().optional(),
  featured: z.boolean().optional()
});

export const StudioImageInputSchema = z.object({
  src: z.string().trim().min(1),
  alt: z.string().trim().optional(),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional()
});

export const RestaurantBusinessInputSchema = z.object({
  name: z.string().trim().min(1),
  category: z.literal("restaurant"),
  description: z.string().trim().min(1),
  cuisineType: z.string().trim().optional(),
  toneStyle: z.string().trim().min(1),
  priceFeel: z.string().trim().optional(),
  diningFeel: z.string().trim().optional(),
  phone: z.string().trim().nullable().optional(),
  email: z.string().trim().nullable().optional(),
  address: z.string().trim().nullable().optional(),
  openingHours: z.string().trim().nullable().optional(),
  reservation: z.object({
    enabled: z.boolean(),
    label: z.string().trim().min(1),
    href: z.string().trim().min(1)
  }),
  ctaGoal: StudioCtaGoalSchema,
  socials: z.record(z.string(), z.string().nullable()).default({}),
  logoUrl: z.string().trim().nullable().optional(),
  galleryImages: z.array(StudioImageInputSchema).default([]),
  primaryColor: HexColorSchema,
  secondaryColor: HexColorSchema,
  menu: z.object({
    source: z.string().trim().nullable().optional(),
    items: z.array(RestaurantMenuItemSchema).default([])
  }),
  signatureDishes: z.array(z.string().trim().min(1)).default([]),
  ambianceTags: z.array(RestaurantAmbianceTagSchema).default([])
});

export const StudioThemeTokensSchema = z.object({
  primary: HexColorSchema,
  secondary: HexColorSchema,
  background: HexColorSchema,
  surface: HexColorSchema,
  text: HexColorSchema,
  muted: HexColorSchema,
  border: HexColorSchema,
  buttonText: HexColorSchema,
  styleMode: StudioStyleModeSchema,
  motionProfile: StudioMotionProfileSchema,
  radius: z.enum(["lg", "xl"]),
  fontFamily: z.string().trim().min(1)
});

export const StudioPageRuleSchema = z.object({
  id: z.string().trim().min(1),
  title: z.string().trim().min(1),
  slug: z.string().trim().min(1),
  architecture: z.enum(["single_page_anchor", "multi_page"]),
  showInNav: z.boolean(),
  order: z.number().int().nonnegative(),
  sectionIds: z.array(z.string().trim().min(1))
});

export const StudioNavbarItemSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  href: z.string().trim().min(1),
  targetSectionId: z.string().trim().min(1).nullable(),
  order: z.number().int().nonnegative(),
  locked: z.boolean()
});

export const StudioSectionRuleSchema = z.object({
  id: z.string().trim().min(1),
  type: StudioSectionTypeSchema,
  rendersAs: StudioRenderedSectionTypeSchema.nullable(),
  required: z.boolean(),
  enabled: z.boolean(),
  order: z.number().int().nonnegative(),
  variant: z.string().trim().min(1),
  constraints: z.array(z.string().trim().min(1)).default([])
});

export const StudioStructureSchema = z.object({
  architecture: z.enum(["single_page_restaurant", "multi_page_restaurant"]),
  pages: z.array(StudioPageRuleSchema).min(1),
  navbar: z.array(StudioNavbarItemSchema).min(1),
  sections: z.array(StudioSectionRuleSchema).min(1),
  allowedPages: z.array(z.enum(["Home", "Menu", "Reservations", "About", "Contact"])),
  allowedSectionTypes: z.array(StudioSectionTypeSchema),
  disallowUnknownSections: z.literal(true),
  disallowFreeformCanvas: z.literal(true)
});

export const StudioContentSchema = z.object({
  hero: z.object({
    eyebrow: z.string().trim().optional(),
    headline: z.string().trim().min(1),
    subheadline: z.string().trim().min(1),
    primaryCtaLabel: z.string().trim().min(1),
    primaryCtaHref: z.string().trim().min(1)
  }),
  intro: z.object({
    title: z.string().trim().min(1),
    body: z.string().trim().min(1)
  }),
  menuHighlights: z.object({
    title: z.string().trim().min(1),
    items: z.array(RestaurantMenuItemSchema)
  }),
  testimonials: z.array(
    z.object({
      quote: z.string().trim().min(1),
      name: z.string().trim().min(1)
    })
  ),
  gallery: z.array(StudioImageInputSchema),
  cta: z.object({
    title: z.string().trim().min(1),
    body: z.string().trim().min(1),
    label: z.string().trim().min(1),
    href: z.string().trim().min(1)
  }),
  contact: z.object({
    title: z.string().trim().min(1),
    body: z.string().trim().min(1),
    phone: z.string().trim().nullable(),
    email: z.string().trim().nullable(),
    address: z.string().trim().nullable(),
    openingHours: z.string().trim().nullable()
  }),
  footer: z.object({
    text: z.string().trim().min(1)
  })
});

export const StudioProviderMetadataSchema = z.object({
  provider: z.enum(["siroundchat-current", "siroundchat-mock", "v0"]),
  status: z.enum(["active", "mock", "planned", "unavailable"]),
  mode: z.enum(["current-pipeline", "mock-local", "v0-adapter-stub", "v0-sdk-live"]),
  configured: z.boolean(),
  model: z.string().trim().nullable().optional(),
  pipeline: z.string().trim().nullable().optional(),
  reason: z.string().trim().nullable().optional(),
  requestFingerprint: z.string().trim().nullable().optional(),
  resultSource: z.enum(["fresh", "reused_inflight", "reused_recent"]).nullable().optional(),
  requestKind: z
    .enum(["initial_generation", "site_refinement", "section_regeneration"])
    .nullable()
    .optional(),
  responseMode: z.enum(["sync", "async", "experimental_stream"]).nullable().optional(),
  chatId: z.string().trim().nullable().optional(),
  versionId: z.string().trim().nullable().optional(),
  webUrl: z.string().trim().nullable().optional(),
  demoUrl: z.string().trim().nullable().optional(),
  screenshotUrl: z.string().trim().nullable().optional(),
  fileNames: z.array(z.string().trim().min(1)).optional()
});

export const StudioGenerationRulesSchema = z.object({
  promptConstraints: z.array(z.string().trim().min(1)),
  themePolicy: z.array(z.string().trim().min(1)),
  navPolicy: z.array(z.string().trim().min(1)),
  pagePolicy: z.array(z.string().trim().min(1)),
  refinementPolicy: z.array(z.string().trim().min(1))
});

export const StudioGenerationSpecSchema = z.object({
  version: z.literal(STUDIO_SPEC_VERSION),
  vertical: StudioVerticalSchema,
  source: z.enum(["prompt_studio", "guided_setup", "legacy_generation", "api"]),
  sourcePrompt: z.string().trim().min(1),
  businessId: z.string().trim().min(1),
  siteId: z.string().trim().min(1).nullable(),
  business: RestaurantBusinessInputSchema,
  theme: StudioThemeTokensSchema,
  structure: StudioStructureSchema,
  content: StudioContentSchema,
  rules: StudioGenerationRulesSchema,
  compatibility: z.object({
    legacyIndustry: z.string().trim().min(1),
    legacyTemplateId: z.string().trim().nullable(),
    pagesMode: z.enum(["one", "multi"]),
    generationBrief: z.record(z.string(), z.unknown())
  }),
  createdAt: z.string().trim().min(1)
});

export const StudioRefinementScopeSchema = z.enum([
  "full_site",
  "page",
  "section",
  "content_only",
  "theme_only",
  "navbar_only"
]);

export const StudioRefinementPlanSchema = z.object({
  version: z.literal(STUDIO_SPEC_VERSION),
  request: z.string().trim().min(1),
  scope: StudioRefinementScopeSchema,
  target: z.object({
    pageId: z.string().trim().nullable().optional(),
    sectionId: z.string().trim().nullable().optional(),
    sectionType: z.string().trim().nullable().optional(),
    contentKey: z.string().trim().nullable().optional()
  }),
  allowedOperations: z.array(
    z.enum([
      "update_content_fields",
      "update_theme_tokens",
      "switch_style_mode",
      "rename_nav_item",
      "reorder_nav_items",
      "show_hide_section",
      "reorder_sections",
      "swap_section_variant",
      "regenerate_section",
      "regenerate_page_sections",
      "regenerate_site"
    ])
  ),
  providerAllowed: z.boolean(),
  safety: z.object({
    disallowUnknownSections: z.literal(true),
    disallowRawCodeRewrite: z.literal(true),
    disallowFreeformCanvas: z.literal(true)
  }),
  createdAt: z.string().trim().min(1)
});

export const StudioSiteBriefMetadataSchema = z.object({
  version: z.literal(STUDIO_SPEC_VERSION),
  vertical: StudioVerticalSchema,
  generationSpec: StudioGenerationSpecSchema,
  provider: StudioProviderMetadataSchema,
  refinements: z.array(StudioRefinementPlanSchema).default([]),
  storedAt: z.string().trim().min(1)
});

export type StudioVertical = z.infer<typeof StudioVerticalSchema>;
export type StudioStyleMode = z.infer<typeof StudioStyleModeSchema>;
export type StudioCtaGoal = z.infer<typeof StudioCtaGoalSchema>;
export type StudioSectionType = z.infer<typeof StudioSectionTypeSchema>;
export type StudioRenderedSectionType = z.infer<typeof StudioRenderedSectionTypeSchema>;
export type RestaurantBusinessInput = z.infer<typeof RestaurantBusinessInputSchema>;
export type StudioThemeTokens = z.infer<typeof StudioThemeTokensSchema>;
export type StudioGenerationSpec = z.infer<typeof StudioGenerationSpecSchema>;
export type StudioProviderMetadata = z.infer<typeof StudioProviderMetadataSchema>;
export type StudioRefinementScope = z.infer<typeof StudioRefinementScopeSchema>;
export type StudioRefinementPlan = z.infer<typeof StudioRefinementPlanSchema>;
export type StudioSiteBriefMetadata = z.infer<typeof StudioSiteBriefMetadataSchema>;

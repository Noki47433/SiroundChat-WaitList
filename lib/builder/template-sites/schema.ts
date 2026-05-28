import { z } from "zod";
import type { EvasionTemplateData } from "@/components/templates/evasion/data";
import type { EssenceTemplateData } from "@/components/templates/essence/data";
import type { HouslyTemplateData } from "@/components/templates/hously/data";
import type { foodTruckData } from "@/components/templates/food-truck/data";
import { THEME_STYLE_IDS } from "@/lib/builder/template-sites/themes";

export const IntegratedTemplateIdSchema = z.enum([
  "evasion",
  "essence",
  "hously",
  "food-truck"
]);

export const ThemeStyleIdSchema = z.enum(THEME_STYLE_IDS);

export type IntegratedTemplateId = z.infer<typeof IntegratedTemplateIdSchema>;
export type ThemeStyleId = z.infer<typeof ThemeStyleIdSchema>;
export type FoodTruckTemplateData = typeof foodTruckData;

export type IntegratedTemplateDataMap = {
  evasion: EvasionTemplateData;
  essence: EssenceTemplateData;
  hously: HouslyTemplateData;
  "food-truck": FoodTruckTemplateData;
};

export type IntegratedTemplateData<TTemplate extends IntegratedTemplateId = IntegratedTemplateId> =
  IntegratedTemplateDataMap[TTemplate];

export const ResolvedTemplateImageSchema = z.object({
  url: z.string().url(),
  alt: z.string().trim().min(1),
  source: z.enum(["pexels", "v0", "template", "upload"]),
  photographer: z.string().trim().min(1).optional(),
  sourceUrl: z.string().url().optional()
});

export type ResolvedTemplateImage = z.infer<typeof ResolvedTemplateImageSchema>;

export const TemplateImageSetSchema = z.object({
  hero: ResolvedTemplateImageSchema.nullable().optional(),
  story: ResolvedTemplateImageSchema.nullable().optional(),
  location: ResolvedTemplateImageSchema.nullable().optional(),
  highlights: z.array(ResolvedTemplateImageSchema).max(4).default([]),
  dishes: z.array(ResolvedTemplateImageSchema).max(4).default([]),
  gallery: z.array(ResolvedTemplateImageSchema).max(6).default([])
});

export type TemplateImageSet = z.infer<typeof TemplateImageSetSchema>;

export const RestaurantContentItemSchema = z.object({
  title: z.string().trim().min(1),
  subtitle: z.string().trim().min(1).optional(),
  description: z.string().trim().min(1),
  price: z.string().trim().min(1).optional(),
  note: z.string().trim().min(1).optional(),
  season: z.string().trim().min(1).optional(),
  technique: z.string().trim().min(1).optional(),
  awards: z.array(z.string().trim().min(1)).max(3).optional()
});

export const RestaurantMenuCategorySchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  items: z.array(RestaurantContentItemSchema).min(1).max(6)
});

export const RestaurantTemplateContentSchema = z.object({
  business: z.object({
    name: z.string().trim().min(1),
    cuisine: z.string().trim().min(1),
    concept: z.string().trim().min(1),
    vibe: z.string().trim().min(1),
    locationLabel: z.string().trim().min(1),
    shortWordmark: z.string().trim().min(1).max(18)
  }),
  hero: z.object({
    eyebrow: z.string().trim().min(1),
    headline: z.string().trim().min(1),
    subheadline: z.string().trim().min(1),
    primaryCtaLabel: z.string().trim().min(1),
    primaryCtaHref: z.string().trim().min(1),
    secondaryCtaLabel: z.string().trim().min(1),
    secondaryCtaHref: z.string().trim().min(1)
  }),
  story: z.object({
    heading: z.string().trim().min(1),
    description: z.string().trim().min(1),
    paragraphs: z.array(z.string().trim().min(1)).min(2).max(3),
    principles: z
      .array(
        z.object({
          title: z.string().trim().min(1),
          description: z.string().trim().min(1)
        })
      )
      .min(3)
      .max(4)
  }),
  highlights: z.object({
    heading: z.string().trim().min(1),
    description: z.string().trim().min(1),
    items: z.array(RestaurantContentItemSchema).min(3).max(6)
  }),
  experience: z.object({
    heading: z.string().trim().min(1),
    description: z.string().trim().min(1),
    items: z
      .array(
        z.object({
          title: z.string().trim().min(1),
          description: z.string().trim().min(1),
          note: z.string().trim().min(1).optional()
        })
      )
      .min(3)
      .max(4)
  }),
  dishes: z.object({
    heading: z.string().trim().min(1),
    note: z.string().trim().min(1),
    items: z.array(RestaurantContentItemSchema).min(3).max(6)
  }),
  faq: z.object({
    heading: z.string().trim().min(1),
    items: z
      .array(
        z.object({
          question: z.string().trim().min(1),
          answer: z.string().trim().min(1)
        })
      )
      .min(3)
      .max(6)
  }),
  menu: z
    .object({
      heading: z.string().trim().min(1),
      subheading: z.string().trim().min(1),
      promoEyebrow: z.string().trim().min(1),
      promoTitle: z.string().trim().min(1),
      promoBody: z.string().trim().min(1),
      categories: z.array(RestaurantMenuCategorySchema).min(3).max(4)
    })
    .optional(),
  reservation: z.object({
    eyebrow: z.string().trim().min(1),
    heading: z.string().trim().min(1),
    description: z.string().trim().min(1),
    primaryLabel: z.string().trim().min(1),
    primaryHref: z.string().trim().min(1),
    secondaryLabel: z.string().trim().min(1).optional(),
    secondaryHref: z.string().trim().min(1).optional()
  }),
  contact: z.object({
    heading: z.string().trim().min(1),
    description: z.string().trim().min(1),
    addressLines: z.array(z.string().trim().min(1)).min(2).max(4),
    phone: z.string().trim().min(1),
    email: z.string().trim().min(1),
    hours: z.array(z.string().trim().min(1)).min(1).max(4),
    socialLabel: z.string().trim().min(1),
    socialHref: z.string().trim().min(1)
  }),
  footer: z.object({
    description: z.string().trim().min(1),
    legalText: z.string().trim().min(1),
    links: z
      .array(
        z.object({
          label: z.string().trim().min(1),
          href: z.string().trim().min(1)
        })
      )
      .min(3)
      .max(5)
  }),
  imageBriefs: z.object({
    hero: z.object({
      query: z.string().trim().min(1),
      alt: z.string().trim().min(1)
    }),
    story: z
      .object({
        query: z.string().trim().min(1),
        alt: z.string().trim().min(1)
      })
      .optional(),
    location: z
      .object({
        query: z.string().trim().min(1),
        alt: z.string().trim().min(1)
      })
      .optional(),
    highlights: z
      .array(
        z.object({
          query: z.string().trim().min(1),
          alt: z.string().trim().min(1)
        })
      )
      .max(4)
      .default([]),
    dishes: z
      .array(
        z.object({
          query: z.string().trim().min(1),
          alt: z.string().trim().min(1)
        })
      )
      .max(4)
      .default([]),
    gallery: z
      .array(
        z.object({
          query: z.string().trim().min(1),
          alt: z.string().trim().min(1)
        })
      )
      .max(6)
      .default([])
  })
});

export type RestaurantTemplateContent = z.infer<typeof RestaurantTemplateContentSchema>;

export const TemplateSelectionResultSchema = z.object({
  template: IntegratedTemplateIdSchema,
  reason: z.string().trim().min(1),
  matchedKeywords: z.array(z.string().trim().min(1)).default([]),
  scores: z.record(IntegratedTemplateIdSchema, z.number().int())
});

export type TemplateSelectionResult = z.infer<typeof TemplateSelectionResultSchema>;

export const TemplateImagePolicySchema = z.object({
  allowPexelsSearch: z.boolean(),
  allowV0ImageGeneration: z.boolean(),
  maxPexelsImages: z.number().int().nonnegative(),
  maxGeneratedImages: z.number().int().nonnegative(),
  imageMode: z.enum(["pexels_first", "template_only"]),
  imageBudgetMode: z.enum(["lean", "premium_hero"]),
  usedV0HeroGeneration: z.boolean().default(false)
});

export type TemplateImagePolicy = z.infer<typeof TemplateImagePolicySchema>;

export const IntegratedTemplateThemeSchema = z.object({
  primaryColor: z.string().regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/),
  secondaryColor: z.string().regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/),
  mode: z.enum(["dark", "light"])
});

export type IntegratedTemplateTheme = z.infer<typeof IntegratedTemplateThemeSchema>;

const OptionalHexColorSchema = z
  .string()
  .regex(/^#(?:[0-9a-fA-F]{3}){1,2}$/)
  .optional();

export const IntegratedTemplateEditorSettingsSchema = z.object({
  colors: z
    .object({
      primaryColor: OptionalHexColorSchema,
      secondaryColor: OptionalHexColorSchema,
      textColor: OptionalHexColorSchema,
      heroTextColor: OptionalHexColorSchema
    })
    .optional(),
  typography: z
    .object({
      heroSize: z.enum(["sm", "md", "lg"]).optional(),
      bodySize: z.enum(["sm", "md", "lg"]).optional(),
      alignment: z.enum(["default", "left", "center"]).optional()
    })
    .optional(),
  layout: z
    .object({
      spacing: z.enum(["compact", "default", "relaxed"]).optional(),
      sectionVisibility: z.record(z.string(), z.boolean()).optional(),
      sectionStyles: z
        .record(
          z.string(),
          z.object({
            textColor: OptionalHexColorSchema,
            backgroundColor: OptionalHexColorSchema
          })
        )
        .optional()
    })
    .optional()
});

export type IntegratedTemplateEditorSettings = z.infer<
  typeof IntegratedTemplateEditorSettingsSchema
>;

// ─── Multi-page support ───────────────────────────────────────────────────────

export const NavigationItemSchema = z.object({
  id: z.string().trim().min(1),
  label: z.string().trim().min(1),
  href: z.string().trim().min(1),
  kind: z.enum(["home", "anchor", "page", "external"]),
  pageId: z.string().optional(),
  order: z.number().int().min(0),
  enabled: z.boolean()
});
export type NavigationItem = z.infer<typeof NavigationItemSchema>;

export const INTEGRATED_PAGE_BLOCK_KINDS = [
  "hero",
  "text",
  "menu_grid",
  "service_cards",
  "gallery_grid",
  "faq_list",
  "cta",
  "contact",
  "property_cards",
  "car_cards",
  "room_cards"
] as const;
export type IntegratedPageBlockKind = (typeof INTEGRATED_PAGE_BLOCK_KINDS)[number];

export const IntegratedPageBlockSchema = z.object({
  id: z.string().trim().min(1),
  kind: z.enum([
    "hero", "text", "menu_grid", "service_cards", "gallery_grid",
    "faq_list", "cta", "contact", "property_cards", "car_cards", "room_cards"
  ]),
  content: z.record(z.string(), z.unknown()),
  enabled: z.boolean().default(true)
});
export type IntegratedPageBlock = z.infer<typeof IntegratedPageBlockSchema>;

export const INTEGRATED_PAGE_KINDS = [
  "menu",
  "services",
  "pricing",
  "gallery",
  "faq",
  "property_listings",
  "car_inventory",
  "rooms",
  "custom"
] as const;
export type IntegratedPageKind = (typeof INTEGRATED_PAGE_KINDS)[number];

export const IntegratedTemplatePageSchema = z.object({
  id: z.string().trim().min(1),
  slug: z.string().trim().min(1).regex(/^[a-z0-9-]+$/, "Slug must be lowercase with hyphens only"),
  title: z.string().trim().min(1),
  kind: z.enum(["menu", "services", "pricing", "gallery", "faq", "property_listings", "car_inventory", "rooms", "custom"]),
  metaDescription: z.string().trim().optional(),
  status: z.enum(["draft", "published"]).default("draft"),
  blocks: z.array(IntegratedPageBlockSchema).max(12),
  source: z.enum(["ai_generated", "manual"]).default("ai_generated"),
  createdAt: z.string().trim().min(1),
  updatedAt: z.string().trim().min(1)
});
export type IntegratedTemplatePage = z.infer<typeof IntegratedTemplatePageSchema>;

// ─────────────────────────────────────────────────────────────────────────────

export const IntegratedTemplateSiteDocumentSchema = z.object({
  kind: z.literal("integrated_template"),
  version: z.literal(1),
  template: IntegratedTemplateIdSchema,
  theme: IntegratedTemplateThemeSchema.optional(),
  editorSettings: IntegratedTemplateEditorSettingsSchema.optional(),
  meta: z.object({
    businessName: z.string().trim().min(1),
    industry: z.string().trim().min(1),
    themeStyle: ThemeStyleIdSchema.optional(),
    sourcePrompt: z.string().trim().min(1),
    rawPrompt: z.string().trim().min(1).optional(),
    enhancedPrompt: z.string().trim().min(1).optional(),
    selection: TemplateSelectionResultSchema,
    imagePolicy: TemplateImagePolicySchema,
    seo: z.object({
      title: z.string().trim().min(1),
      description: z.string().trim().min(1),
      ogImage: z.string().url().optional()
    }),
    generatedAt: z.string().trim().min(1),
    updatedAt: z.string().trim().min(1)
  }),
  content: RestaurantTemplateContentSchema,
  images: TemplateImageSetSchema,
  data: z.unknown(),
  additionalPages: z.array(IntegratedTemplatePageSchema).optional().default([]),
  navigationItems: z.array(NavigationItemSchema).optional()
});

export type IntegratedTemplateSiteDocument = z.infer<typeof IntegratedTemplateSiteDocumentSchema>;

export const parseIntegratedTemplateSiteDocument = (value: unknown) => {
  const parsed = IntegratedTemplateSiteDocumentSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
};

export const isIntegratedTemplateSiteDocument = (
  value: unknown
): value is IntegratedTemplateSiteDocument => Boolean(parseIntegratedTemplateSiteDocument(value));

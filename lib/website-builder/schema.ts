import { z } from "zod";
import { TEMPLATE_ALLOWED_VARIANTS, TEMPLATE_META } from "@/lib/website-builder/templates/registry";

const TemplateIdSchema = z.string().refine(
  (value) => TEMPLATE_META.some((template) => template.id === value),
  "Invalid templateId"
);

const DEFAULT_CHAT_PROMPT_TEXT = "Have questions or want to make a reservation? Use our chatbot →";
const DEFAULT_CHAT_PROMPT_CTA = "Open chat";

const SectionTypeSchema = z.enum([
  "hero",
  "services",
  "about",
  "gallery",
  "testimonials",
  "pricing",
  "cta",
  "faq",
  "contact",
  "reservation",
  "footer",
  "newsletter",
  "blog-index",
  "blog-post",
  "store-listing",
  "store-product",
  "store-cart",
  "custom",
  "app-embed"
]);

const ThemeSchema = z.object({
  primary: z.string().min(1),
  secondary: z.string().min(1),
  bg: z.string().min(1),
  text: z.string().min(1),
  muted: z.string().min(1),
  surface: z.string().min(1),
  border: z.string().min(1),
  buttonText: z.string().min(1),
  accent: z.string().optional(),
  radius: z.enum(["lg", "xl"]).optional(),
  fontHeading: z.string().optional(),
  fontBody: z.string().optional(),
  textStyles: z
    .object({
      h1: z.object({
        size: z.string().min(1),
        weight: z.number(),
        lineHeight: z.string().min(1),
        letterSpacing: z.string().optional()
      }),
      h2: z.object({
        size: z.string().min(1),
        weight: z.number(),
        lineHeight: z.string().min(1),
        letterSpacing: z.string().optional()
      }),
      h3: z.object({
        size: z.string().min(1),
        weight: z.number(),
        lineHeight: z.string().min(1),
        letterSpacing: z.string().optional()
      }),
      body: z.object({
        size: z.string().min(1),
        weight: z.number(),
        lineHeight: z.string().min(1),
        letterSpacing: z.string().optional()
      }),
      caption: z.object({
        size: z.string().min(1),
        weight: z.number(),
        lineHeight: z.string().min(1),
        letterSpacing: z.string().optional()
      })
    })
    .optional(),
  pageTransitions: z.enum(["none", "fade", "slide"]).optional()
});

const ContentStyleSchema = z.object({
  color: z.string().optional(),
  fontSize: z.string().optional(),
  fontWeight: z.number().optional(),
  fontStyle: z.enum(["normal", "italic"]).optional(),
  lineHeight: z.string().optional(),
  letterSpacing: z.string().optional(),
  fontFamily: z.string().optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  textTransform: z.enum(["none", "uppercase", "lowercase", "capitalize"]).optional(),
  textDecoration: z.enum(["none", "underline", "line-through"]).optional(),
  maxWidth: z.string().optional(),
  opacity: z.number().optional()
});

const ElementStyleSchema = z.object({
  color: z.string().optional(),
  fontSize: z.string().optional(),
  fontWeight: z.number().optional(),
  fontStyle: z.enum(["normal", "italic"]).optional(),
  lineHeight: z.string().optional(),
  letterSpacing: z.string().optional(),
  fontFamily: z.string().optional(),
  textAlign: z.enum(["left", "center", "right"]).optional(),
  textTransform: z.enum(["none", "uppercase", "lowercase", "capitalize"]).optional(),
  textDecoration: z.enum(["none", "underline", "line-through"]).optional(),
  maxWidth: z.string().optional(),
  opacity: z.number().optional(),
  background: z.string().optional(),
  padding: z.string().optional(),
  borderColor: z.string().optional(),
  borderWidth: z.string().optional(),
  borderRadius: z.string().optional(),
  boxShadow: z.string().optional()
});

const ElementFrameSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number(),
  height: z.number()
});

const BackgroundSchema = z.union([
  z.object({
    type: z.literal("plain")
  }),
  z.object({
    type: z.literal("gradient"),
    value: z.string().optional(),
    angle: z.number().optional(),
    stops: z
      .array(
        z.object({
          color: z.string().min(1),
          position: z.number().min(0).max(100)
        })
      )
      .optional()
  }),
  z.object({
    type: z.literal("image"),
    value: z.string().optional(),
    overlay: z.number().min(0).max(1).optional(),
    size: z.enum(["cover", "contain"]).optional(),
    position: z.string().optional(),
    repeat: z.enum(["no-repeat", "repeat"]).optional()
  })
]);

const SectionStyleSchema = z.object({
  alignment: z.enum(["left", "center"]),
  spacing: z.enum(["compact", "normal", "airy"]),
  layoutMode: z.enum(["flow", "freeform"]).optional(),
  background: BackgroundSchema,
  buttonStyle: z.enum(["solid", "outline"]),
  colorOverride: z
    .object({
      primary: z.string().optional(),
      bg: z.string().optional(),
      text: z.string().optional()
    })
    .nullable()
    .optional()
});

const SiteImageSchema = z.object({
  slot: z.string().min(1),
  src: z.string().url(),
  alt: z.string().optional(),
  credit: z
    .object({
      provider: z.enum(["pexels", "unsplash", "openai"]),
      photographer: z.string().optional(),
      sourceUrl: z.string().optional()
    })
    .optional(),
  query: z.string().optional()
});

const SiteSectionSchema = z.object({
  id: z.string().min(1),
  type: SectionTypeSchema,
  variant: z.string().min(1),
  name: z.string().optional(),
  enabled: z.boolean(),
  style: SectionStyleSchema,
  content: z.record(z.string(), z.any()),
  elements: z
    .array(
      z.discriminatedUnion("type", [
        z.object({
          id: z.string().min(1),
          type: z.literal("text"),
          text: z.string().min(1),
          textStyle: z.enum(["h1", "h2", "h3", "body", "caption"]),
          align: z.enum(["left", "center"]).optional(),
          style: ElementStyleSchema.optional(),
          frame: ElementFrameSchema.optional()
        }),
        z.object({
          id: z.string().min(1),
          type: z.literal("image"),
          src: z.string().url(),
          alt: z.string().optional(),
          caption: z.string().optional(),
          style: ElementStyleSchema.optional(),
          frame: ElementFrameSchema.optional()
        }),
        z.object({
          id: z.string().min(1),
          type: z.literal("button"),
          label: z.string().min(1),
          href: z.string().min(1),
          variant: z.enum(["primary", "outline"]).optional(),
          align: z.enum(["left", "center"]).optional(),
          style: ElementStyleSchema.optional(),
          frame: ElementFrameSchema.optional()
        }),
        z.object({
          id: z.string().min(1),
          type: z.literal("spacer"),
          height: z.number().optional(),
          style: ElementStyleSchema.optional(),
          frame: ElementFrameSchema.optional()
        }),
        z.object({
          id: z.string().min(1),
          type: z.literal("divider"),
          thickness: z.number().optional(),
          color: z.string().optional(),
          style: ElementStyleSchema.optional(),
          frame: ElementFrameSchema.optional()
        })
      ])
    )
    .optional(),
  contentStyles: z.record(z.string(), ContentStyleSchema).optional(),
  images: z.array(SiteImageSchema).optional()
});

const SitePageSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  slug: z.string().min(1),
  showInMenu: z.boolean().optional(),
  menuTitle: z.string().optional(),
  parentId: z.string().nullable().optional(),
  order: z.number().optional(),
  isSystem: z.boolean().optional(),
  systemGroup: z.string().optional(),
  sections: z.array(SiteSectionSchema).min(1)
});

const SiteBriefSchema = z
  .object({
    businessName: z.string().optional(),
    industry: z.string().optional(),
    description: z.string().optional(),
    tone: z.string().optional(),
    goals: z.array(z.string()).optional(),
    pages: z.array(z.string()).optional(),
    theme: z
      .object({
        primary: z.string().optional(),
        background: z.string().optional(),
        fontFamily: z.string().optional()
      })
      .optional(),
    designDNA: z
      .object({
        variationSeed: z.string().optional(),
        layoutStyle: z.string().optional(),
        palette: z
          .object({
            primary: z.string().optional(),
            secondary: z.string().optional(),
            background: z.string().optional(),
            accent: z.string().optional()
          })
          .optional(),
        fontPair: z
          .object({
            heading: z.string().optional(),
            body: z.string().optional()
          })
          .optional(),
        variantBias: z.record(z.string(), z.string()).optional(),
        sectionOrder: z.array(z.string()).optional(),
        imageryStyle: z.string().optional()
      })
      .optional()
  })
  .optional();

const RequiredContentKeys: Record<string, string[]> = {
  hero: ["headline", "subheadline", "ctaLabel", "ctaHref"],
  services: ["title", "items"],
  about: ["title", "body"],
  gallery: ["title"],
  testimonials: ["title", "items"],
  pricing: ["title", "plans"],
  cta: ["title", "body", "ctaLabel", "ctaHref"],
  faq: ["title", "items"],
  contact: ["title", "body"],
  reservation: ["title", "body"],
  footer: ["text"],
  newsletter: ["title", "body", "ctaLabel"],
  "blog-index": ["title"],
  "blog-post": ["title", "body"],
  "store-listing": ["title"],
  "store-product": ["title", "body"],
  "store-cart": ["title"]
};

export const SiteDocumentSchema = z
  .object({
    templateId: TemplateIdSchema,
    tone: z.string().min(1),
    theme: ThemeSchema,
    seo: z
      .object({
        title: z.string().optional(),
        description: z.string().optional(),
        ogImage: z.string().nullable().optional()
      })
      .optional(),
    pages: z.array(SitePageSchema).min(1),
    apps: z
      .array(
        z.object({
          id: z.enum(["live-chat", "newsletter", "analytics", "booking-widget"]),
          name: z.string(),
          installedAt: z.string(),
          enabled: z.boolean(),
          config: z.record(z.string(), z.any()).optional()
        })
      )
      .optional(),
    siteBrief: SiteBriefSchema,
    savedSections: z.array(SiteSectionSchema).optional(),
    mediaLibrary: z.array(SiteImageSchema).optional(),
    chat_prompt_topbar_enabled: z.boolean().optional().default(false),
    chat_prompt_topbar_text: z.string().trim().max(120).optional().default(DEFAULT_CHAT_PROMPT_TEXT),
    chat_prompt_topbar_cta: z.string().trim().max(30).optional().default(DEFAULT_CHAT_PROMPT_CTA),
    chat_launcher_glow_enabled: z.boolean().optional().default(false),
    customCode: z
      .object({
        head: z.string().nullable().optional(),
        body: z.string().nullable().optional()
      })
      .optional()
  })
  .superRefine((value, ctx) => {
    const allowedVariants = TEMPLATE_ALLOWED_VARIANTS[value.templateId];
    if (!allowedVariants) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["templateId"],
        message: "Template does not support variants"
      });
      return;
    }

    value.pages.forEach((page, pageIndex) => {
      page.sections.forEach((section, sectionIndex) => {
        const validVariants = allowedVariants[section.type] ?? [];
        if (!validVariants.includes(section.variant)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ["pages", pageIndex, "sections", sectionIndex, "variant"],
            message: `Variant ${section.variant} not allowed for ${section.type}`
          });
        }

        const requiredKeys = RequiredContentKeys[section.type] ?? [];
        if (!section.elements?.length) {
          requiredKeys.forEach((key) => {
            if (section.content?.[key] === undefined || section.content?.[key] === null) {
              ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["pages", pageIndex, "sections", sectionIndex, "content", key],
                message: `Missing ${key} for ${section.type}`
              });
            }
          });
        }
      });
    });
  });

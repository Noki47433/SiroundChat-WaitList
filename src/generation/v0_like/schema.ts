import { z } from "zod";
import {
  PRIMARY_GOALS,
  SECTION_TYPES,
  SITE_TYPES,
  THEME_ACCENTS,
  THEME_FONTS,
  THEME_MODES,
  TONES,
  VERTICALS
} from "@/src/generation/v0_like/types";

const StartsWithSlashOrHttpsSchema = z
  .string()
  .refine((value) => value.startsWith("/") || value.startsWith("https://"), {
    message: "Must start with '/' or 'https://'"
  });

const KebabIdSchema = z
  .string()
  .min(3)
  .max(48)
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Must be kebab-case");

const LinkSchema = z
  .object({
    label: z.string().min(1).max(20),
    href: z.string().min(1)
  })
  .strict();

export const MediaItemSchema = z
  .object({
    role: z.enum(["hero", "background", "product", "gallery", "avatar", "logo", "icon"]),
    source: z.enum(["user", "placeholder"]),
    aspectRatio: z.enum(["16:9", "1:1", "4:3"]),
    src: z.string(),
    alt: z.string().min(1).max(120)
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.source === "placeholder" && value.src !== "") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["src"],
        message: "media.src must be empty string when media.source is 'placeholder'"
      });
      return;
    }

    if (value.source === "user" && !(value.src.startsWith("/") || value.src.startsWith("https://"))) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["src"],
        message: "media.src must start with '/' or 'https://' for user media"
      });
    }
  });

export const SectionCtaSchema = z
  .object({
    intent: z.enum(["primary", "secondary"]),
    label: z.string().min(1).max(20),
    href: StartsWithSlashOrHttpsSchema,
    style: z.enum(["primary", "secondary", "ghost"])
  })
  .strict();

const HeaderSectionSchema = z
  .object({
    id: KebabIdSchema,
    type: z.literal("header"),
    variant: z.literal("simple"),
    props: z
      .object({
        sticky: z.boolean()
      })
      .strict(),
    copy: z
      .object({
        links: z
          .array(
            z
              .object({
                label: z.string().min(1).max(18),
                href: z.string().min(1)
              })
              .strict()
          )
          .max(6)
      })
      .strict(),
    media: z.array(MediaItemSchema),
    ctas: z.array(SectionCtaSchema)
  })
  .strict();

const HeroSectionSchema = z
  .object({
    id: KebabIdSchema,
    type: z.literal("hero"),
    variant: z.enum(["split", "centered"]),
    props: z
      .object({
        hasMockup: z.boolean()
      })
      .strict(),
    copy: z
      .object({
        headline: z.string().min(8).max(60),
        subheadline: z.string().min(20).max(160),
        badge: z.string().max(24),
        primaryCtaLabel: z.string().min(1).max(20),
        secondaryCtaLabel: z.string().max(20)
      })
      .strict(),
    media: z.array(MediaItemSchema),
    ctas: z.array(SectionCtaSchema)
  })
  .strict();

const LogosSectionSchema = z
  .object({
    id: KebabIdSchema,
    type: z.literal("logos"),
    variant: z.literal("grid"),
    props: z
      .object({
        columns: z.union([z.literal(3), z.literal(4), z.literal(5)])
      })
      .strict(),
    copy: z
      .object({
        label: z.string().max(40)
      })
      .strict(),
    media: z.array(MediaItemSchema).min(3).max(8),
    ctas: z.array(SectionCtaSchema)
  })
  .strict()
  .superRefine((value, ctx) => {
    value.media.forEach((item, index) => {
      if (item.role !== "logo") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["media", index, "role"],
          message: "logos section media role must be 'logo'"
        });
      }
    });
  });

const FeaturesSectionSchema = z
  .object({
    id: KebabIdSchema,
    type: z.literal("features"),
    variant: z.enum(["grid3", "grid4"]),
    props: z
      .object({
        columns: z.union([z.literal(3), z.literal(4)])
      })
      .strict(),
    copy: z
      .object({
        title: z.string().min(4).max(40),
        items: z
          .array(
            z
              .object({
                title: z.string().min(4).max(32),
                description: z.string().min(20).max(120)
              })
              .strict()
          )
          .min(3)
          .max(8)
      })
      .strict(),
    media: z.array(MediaItemSchema),
    ctas: z.array(SectionCtaSchema)
  })
  .strict();

const FeatureSpotlightItemSchema = z
  .object({
    eyebrow: z.string().max(24),
    title: z.string().min(4).max(40),
    description: z.string().min(20).max(160),
    bullets: z.array(z.string().min(4).max(60)).min(2).max(4)
  })
  .strict();

const FeatureSpotlightSectionSchema = z
  .object({
    id: KebabIdSchema,
    type: z.literal("feature_spotlight"),
    variant: z.literal("alternating"),
    props: z
      .object({
        items: z.union([z.literal(2), z.literal(3)])
      })
      .strict(),
    copy: z
      .object({
        items: z.array(FeatureSpotlightItemSchema).min(2).max(3)
      })
      .strict(),
    media: z.array(MediaItemSchema),
    ctas: z.array(SectionCtaSchema)
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.copy.items.length !== value.props.items) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["copy", "items"],
        message: "feature_spotlight copy.items length must match props.items"
      });
    }
  });

const MetricsSectionSchema = z
  .object({
    id: KebabIdSchema,
    type: z.literal("metrics"),
    variant: z.literal("row"),
    props: z.object({}).strict(),
    copy: z
      .object({
        items: z
          .array(
            z
              .object({
                value: z.string().min(1).max(12),
                label: z.string().min(4).max(28)
              })
              .strict()
          )
          .min(3)
          .max(5)
      })
      .strict(),
    media: z.array(MediaItemSchema),
    ctas: z.array(SectionCtaSchema)
  })
  .strict();

const TestimonialsSectionSchema = z
  .object({
    id: KebabIdSchema,
    type: z.literal("testimonials"),
    variant: z.literal("cards"),
    props: z
      .object({
        count: z.union([z.literal(2), z.literal(3), z.literal(4)])
      })
      .strict(),
    copy: z
      .object({
        items: z
          .array(
            z
              .object({
                quote: z.string().min(40).max(220),
                name: z.string().min(2).max(32),
                title: z.string().max(48)
              })
              .strict()
          )
          .min(2)
          .max(4)
      })
      .strict(),
    media: z.array(MediaItemSchema),
    ctas: z.array(SectionCtaSchema)
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.copy.items.length !== value.props.count) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["copy", "items"],
        message: "testimonials copy.items length must match props.count"
      });
    }
  });

const PricingSectionSchema = z
  .object({
    id: KebabIdSchema,
    type: z.literal("pricing"),
    variant: z.literal("cards"),
    props: z
      .object({
        plans: z.union([z.literal(2), z.literal(3)])
      })
      .strict(),
    copy: z
      .object({
        title: z.string().min(4).max(40),
        plans: z
          .array(
            z
              .object({
                name: z.string().min(2).max(20),
                price: z.string().max(16),
                description: z.string().min(10).max(80),
                features: z.array(z.string().min(4).max(60)).min(3).max(8),
                ctaLabel: z.string().min(1).max(20)
              })
              .strict()
          )
          .min(2)
          .max(3)
      })
      .strict(),
    media: z.array(MediaItemSchema),
    ctas: z.array(SectionCtaSchema)
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.copy.plans.length !== value.props.plans) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["copy", "plans"],
        message: "pricing copy.plans length must match props.plans"
      });
    }
  });

const FaqSectionSchema = z
  .object({
    id: KebabIdSchema,
    type: z.literal("faq"),
    variant: z.literal("accordion"),
    props: z
      .object({
        items: z.union([
          z.literal(4),
          z.literal(5),
          z.literal(6),
          z.literal(7),
          z.literal(8)
        ])
      })
      .strict(),
    copy: z
      .object({
        items: z
          .array(
            z
              .object({
                q: z.string().min(8).max(80),
                a: z.string().min(20).max(220)
              })
              .strict()
          )
          .min(4)
          .max(8)
      })
      .strict(),
    media: z.array(MediaItemSchema),
    ctas: z.array(SectionCtaSchema)
  })
  .strict()
  .superRefine((value, ctx) => {
    if (value.copy.items.length !== value.props.items) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["copy", "items"],
        message: "faq copy.items length must match props.items"
      });
    }
  });

const CtaBannerSectionSchema = z
  .object({
    id: KebabIdSchema,
    type: z.literal("cta_banner"),
    variant: z.literal("simple"),
    props: z.object({}).strict(),
    copy: z
      .object({
        title: z.string().min(6).max(50),
        subtitle: z.string().min(20).max(140),
        ctaLabel: z.string().min(1).max(20)
      })
      .strict(),
    media: z.array(MediaItemSchema),
    ctas: z.array(SectionCtaSchema)
  })
  .strict();

const ContactSectionSchema = z
  .object({
    id: KebabIdSchema,
    type: z.literal("contact"),
    variant: z.literal("simple"),
    props: z
      .object({
        fields: z.union([
          z.tuple([z.literal("name"), z.literal("email"), z.literal("message")]),
          z.tuple([z.literal("email")])
        ])
      })
      .strict(),
    copy: z
      .object({
        title: z.string().min(4).max(40),
        subtitle: z.string().min(10).max(140),
        submitLabel: z.string().min(1).max(20)
      })
      .strict(),
    media: z.array(MediaItemSchema),
    ctas: z.array(SectionCtaSchema)
  })
  .strict();

const FooterSectionSchema = z
  .object({
    id: KebabIdSchema,
    type: z.literal("footer"),
    variant: z.literal("simple"),
    props: z.object({}).strict(),
    copy: z
      .object({
        columns: z
          .array(
            z
              .object({
                title: z.string().min(2).max(20),
                links: z.array(z.object({ label: z.string().min(2).max(20), href: z.string().min(1) }).strict())
              })
              .strict()
          )
          .min(2)
          .max(4)
      })
      .strict(),
    media: z.array(MediaItemSchema),
    ctas: z.array(SectionCtaSchema)
  })
  .strict();

export const WebsitePlanSectionSchema = z.discriminatedUnion("type", [
  HeaderSectionSchema,
  HeroSectionSchema,
  LogosSectionSchema,
  FeaturesSectionSchema,
  FeatureSpotlightSectionSchema,
  MetricsSectionSchema,
  TestimonialsSectionSchema,
  PricingSectionSchema,
  FaqSectionSchema,
  CtaBannerSectionSchema,
  ContactSectionSchema,
  FooterSectionSchema
]);

export const WebsitePlanSchema = z
  .object({
    version: z.literal("1.0"),
    meta: z
      .object({
        locale: z.enum(["en-GB", "sq-AL"]),
        vertical: z.enum(VERTICALS),
        siteType: z.enum(SITE_TYPES),
        primaryGoal: z.enum(PRIMARY_GOALS),
        brandName: z.string().min(1).max(48),
        logoUrl: z.string().url().optional(),
        pageTitle: z.string().min(1).max(60),
        pageDescription: z.string().min(1).max(160)
      })
      .strict(),
    theme: z
      .object({
        mode: z.enum(THEME_MODES),
        tone: z.enum(TONES),
        density: z.enum(["airy", "normal", "dense"]),
        radius: z.enum(["sm", "md", "lg"]),
        accent: z.enum(THEME_ACCENTS),
        font: z.enum(THEME_FONTS)
      })
      .strict(),
    cta: z
      .object({
        primary: z
          .object({
            label: z.string().min(1).max(20),
            href: StartsWithSlashOrHttpsSchema,
            style: z.enum(["primary", "secondary"])
          })
          .strict(),
        secondary: z
          .object({
            label: z.string().max(20),
            href: StartsWithSlashOrHttpsSchema,
            style: z.enum(["secondary", "ghost"])
          })
          .strict()
      })
      .strict(),
    sections: z.array(WebsitePlanSectionSchema).min(4).max(12)
  })
  .strict()
  .superRefine((value, ctx) => {
    value.sections.forEach((section, index) => {
      if (!SECTION_TYPES.includes(section.type)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sections", index, "type"],
          message: "Unknown section type"
        });
      }
    });
  });

export type WebsitePlan = z.infer<typeof WebsitePlanSchema>;
export type WebsitePlanSection = z.infer<typeof WebsitePlanSectionSchema>;

export type WebsitePlanValidationError = {
  path: string;
  message: string;
};

export function validateWebsitePlan(
  plan: unknown
): { ok: true; value: WebsitePlan } | { ok: false; errors: WebsitePlanValidationError[] } {
  const parsed = WebsitePlanSchema.safeParse(plan);
  if (parsed.success) {
    return { ok: true, value: parsed.data };
  }

  return {
    ok: false,
    errors: parsed.error.issues.map((issue) => ({
      path: issue.path.length ? issue.path.join(".") : "root",
      message: issue.message
    }))
  };
}

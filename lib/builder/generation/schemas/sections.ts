import { z } from "zod";
import { SPACING_PROFILE_IDS, TOKEN_SET_IDS } from "@/lib/builder/design/tokens";

export const SectionTypeSchema = z.enum([
  "hero",
  "about",
  "services",
  "testimonials",
  "gallery",
  "pricing",
  "faq",
  "cta",
  "contact",
  "footer"
]);

export const HeroVariantSchema = z.enum(["A", "B", "C", "D"]);
export const AboutVariantSchema = z.enum(["A", "B", "C"]);
export const ServicesVariantSchema = z.enum(["A", "B", "C"]);
export const TestimonialsVariantSchema = z.enum(["A", "B", "C"]);
export const GalleryVariantSchema = z.enum(["A", "B", "C"]);
export const PricingVariantSchema = z.enum(["A", "B", "C"]);
export const FaqVariantSchema = z.enum(["A", "B"]);
export const CtaVariantSchema = z.enum(["A", "B", "C"]);
export const ContactVariantSchema = z.enum(["A", "B", "C"]);
export const FooterVariantSchema = z.enum(["A", "B"]);

export const CtaActionSchema = z.enum(["contact", "call", "quote", "reserve", "buy", "demo"]);
const UrlSchema = z.string().trim().max(200).optional();
const ShortTextSchema = (max: number) => z.string().trim().min(1).max(max);

const CtaObjectSchema = z
  .object({
    label: ShortTextSchema(24),
    href: UrlSchema,
    action: CtaActionSchema
  })
  .strict();

const ImageHintSchema = z
  .object({
    slotId: z.string().trim().min(1).max(40),
    query: z.string().trim().min(2).max(140),
    alt: z.string().trim().min(2).max(120)
  })
  .strict();

const HeroContentSchema = z
  .object({
    headline: ShortTextSchema(60),
    subhead: ShortTextSchema(160),
    primaryCta: CtaObjectSchema,
    secondaryCta: CtaObjectSchema.optional(),
    image: ImageHintSchema.optional()
  })
  .strict();

const AboutContentSchema = z
  .object({
    title: ShortTextSchema(56),
    body: ShortTextSchema(260)
  })
  .strict();

const ServicesContentSchema = z
  .object({
    title: ShortTextSchema(56),
    items: z
      .array(
        z
          .object({
            title: ShortTextSchema(40),
            body: ShortTextSchema(140)
          })
          .strict()
      )
      .min(2)
      .max(6)
  })
  .strict();

const TestimonialsContentSchema = z
  .object({
    title: ShortTextSchema(56),
    items: z
      .array(
        z
          .object({
            quote: ShortTextSchema(220),
            name: ShortTextSchema(48),
            role: ShortTextSchema(48).optional()
          })
          .strict()
      )
      .min(1)
      .max(4)
  })
  .strict();

const GalleryContentSchema = z
  .object({
    title: ShortTextSchema(56),
    items: z
      .array(
        z
          .object({
            slotId: z.string().trim().min(1).max(40),
            query: z.string().trim().min(2).max(140),
            alt: z.string().trim().min(2).max(120),
            caption: z.string().trim().max(90).optional()
          })
          .strict()
      )
      .min(1)
      .max(6)
  })
  .strict();

const PricingContentSchema = z
  .object({
    title: ShortTextSchema(56),
    plans: z
      .array(
        z
          .object({
            name: ShortTextSchema(32),
            price: ShortTextSchema(32),
            description: ShortTextSchema(140)
          })
          .strict()
      )
      .min(1)
      .max(4)
  })
  .strict();

const FaqContentSchema = z
  .object({
    title: ShortTextSchema(56),
    items: z
      .array(
        z
          .object({
            question: ShortTextSchema(110),
            answer: ShortTextSchema(240)
          })
          .strict()
      )
      .min(1)
      .max(8)
  })
  .strict();

const CtaContentSchema = z
  .object({
    title: ShortTextSchema(70),
    body: ShortTextSchema(170),
    primaryCta: CtaObjectSchema,
    secondaryCta: CtaObjectSchema.optional()
  })
  .strict();

const ContactContentSchema = z
  .object({
    title: ShortTextSchema(56),
    body: ShortTextSchema(170),
    email: z.string().email().optional(),
    phone: z.string().trim().max(30).optional(),
    address: z.string().trim().max(120).optional()
  })
  .strict();

const FooterContentSchema = z
  .object({
    line: z.string().trim().min(1).max(80)
  })
  .strict();

export const SectionVariantEnumByType = {
  hero: HeroVariantSchema,
  about: AboutVariantSchema,
  services: ServicesVariantSchema,
  testimonials: TestimonialsVariantSchema,
  gallery: GalleryVariantSchema,
  pricing: PricingVariantSchema,
  faq: FaqVariantSchema,
  cta: CtaVariantSchema,
  contact: ContactVariantSchema,
  footer: FooterVariantSchema
} as const;

export const SectionContentSchemaByType = {
  hero: HeroContentSchema,
  about: AboutContentSchema,
  services: ServicesContentSchema,
  testimonials: TestimonialsContentSchema,
  gallery: GalleryContentSchema,
  pricing: PricingContentSchema,
  faq: FaqContentSchema,
  cta: CtaContentSchema,
  contact: ContactContentSchema,
  footer: FooterContentSchema
} as const;

const BaseSectionSchema = z
  .object({
    sectionId: z.string().trim().min(1).max(80),
    enabled: z.boolean(),
    spacingProfile: z.enum(SPACING_PROFILE_IDS),
    alignmentProfile: z.enum(["left", "center"]),
    tokenSetId: z.enum(TOKEN_SET_IDS),
    images: z
      .array(
        z
          .object({
            slot: z.string().trim().min(1).max(40),
            src: z.string().url(),
            alt: z.string().trim().min(2).max(120),
            width: z.number().int().positive().optional(),
            height: z.number().int().positive().optional(),
            query: z.string().trim().max(160).optional()
          })
          .strict()
      )
      .optional()
  })
  .strict();

export const HeroSectionSchema = BaseSectionSchema.extend({
  type: z.literal("hero"),
  variant: HeroVariantSchema,
  content: HeroContentSchema
}).strict();

export const AboutSectionSchema = BaseSectionSchema.extend({
  type: z.literal("about"),
  variant: AboutVariantSchema,
  content: AboutContentSchema
}).strict();

export const ServicesSectionSchema = BaseSectionSchema.extend({
  type: z.literal("services"),
  variant: ServicesVariantSchema,
  content: ServicesContentSchema
}).strict();

export const TestimonialsSectionSchema = BaseSectionSchema.extend({
  type: z.literal("testimonials"),
  variant: TestimonialsVariantSchema,
  content: TestimonialsContentSchema
}).strict();

export const GallerySectionSchema = BaseSectionSchema.extend({
  type: z.literal("gallery"),
  variant: GalleryVariantSchema,
  content: GalleryContentSchema
}).strict();

export const PricingSectionSchema = BaseSectionSchema.extend({
  type: z.literal("pricing"),
  variant: PricingVariantSchema,
  content: PricingContentSchema
}).strict();

export const FaqSectionSchema = BaseSectionSchema.extend({
  type: z.literal("faq"),
  variant: FaqVariantSchema,
  content: FaqContentSchema
}).strict();

export const CtaSectionSchema = BaseSectionSchema.extend({
  type: z.literal("cta"),
  variant: CtaVariantSchema,
  content: CtaContentSchema
}).strict();

export const ContactSectionSchema = BaseSectionSchema.extend({
  type: z.literal("contact"),
  variant: ContactVariantSchema,
  content: ContactContentSchema
}).strict();

export const FooterSectionSchema = BaseSectionSchema.extend({
  type: z.literal("footer"),
  variant: FooterVariantSchema,
  content: FooterContentSchema
}).strict();

export const StrictSectionSchema = z.discriminatedUnion("type", [
  HeroSectionSchema,
  AboutSectionSchema,
  ServicesSectionSchema,
  TestimonialsSectionSchema,
  GallerySectionSchema,
  PricingSectionSchema,
  FaqSectionSchema,
  CtaSectionSchema,
  ContactSectionSchema,
  FooterSectionSchema
]);

export const SkeletonSectionSchema = z.discriminatedUnion("type", [
  HeroSectionSchema.extend({ content: z.null() }),
  AboutSectionSchema.extend({ content: z.null() }),
  ServicesSectionSchema.extend({ content: z.null() }),
  TestimonialsSectionSchema.extend({ content: z.null() }),
  GallerySectionSchema.extend({ content: z.null() }),
  PricingSectionSchema.extend({ content: z.null() }),
  FaqSectionSchema.extend({ content: z.null() }),
  CtaSectionSchema.extend({ content: z.null() }),
  ContactSectionSchema.extend({ content: z.null() }),
  FooterSectionSchema.extend({ content: z.null() })
]);

export type SectionType = z.infer<typeof SectionTypeSchema>;
export type StrictSection = z.infer<typeof StrictSectionSchema>;
export type SkeletonSection = z.infer<typeof SkeletonSectionSchema>;

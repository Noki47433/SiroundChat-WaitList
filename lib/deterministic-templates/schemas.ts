import { z } from "zod";
import {
  DENTAL_PRIMARY_CTA_LABEL,
  MOTION_LEVELS,
  REAL_ESTATE_PRIMARY_CTA_LABEL,
  RESTAURANT_PRIMARY_CTA_LABELS,
  SECONDARY_CTA_LABELS,
  SERVICE_NICHES,
  SERVICE_PRIMARY_CTA_LABELS
} from "@/lib/deterministic-templates/contracts";

export type JsonSchema = Record<string, unknown>;

const UrlSchema = z.string().trim().min(1).max(2048);
const HexSchema = z.string().regex(/^#[0-9A-Fa-f]{6}$/);
const MotionLevelSchema = z.enum(MOTION_LEVELS);
const ServiceNicheSchema = z.enum(SERVICE_NICHES);

const BaseBrandSchema = z
  .object({
    business_name: z.string().trim().min(1).max(60),
    city: z.string().trim().min(1).max(40),
    accent_hex: HexSchema
  })
  .strict();

const BaseImageSchema = z
  .object({
    src: UrlSchema,
    alt: z.string().trim().min(1).max(125)
  })
  .strict();

const RestaurantHeroImageSchema = BaseImageSchema.extend({
  crop_desktop: z.literal("16:9"),
  crop_mobile: z.literal("4:5")
}).strict();

const RestaurantSchema = z
  .object({
    template: z.literal("restaurant"),
    motion_level: MotionLevelSchema,
    brand: BaseBrandSchema,
    header: z
      .object({
        nav_items: z
          .array(z.enum(["Menu", "About", "Gallery", "Contact", "Catering"]))
          .min(4)
          .max(5),
        primary_cta_label: z.enum(["Reserve a table", "Order now", "Call now"]),
        primary_cta_url: UrlSchema
      })
      .strict(),
    hero: z
      .object({
        headline: z.string().trim().min(1).max(42),
        subhead: z.string().trim().min(1).max(140),
        primary_cta_label: z.enum(RESTAURANT_PRIMARY_CTA_LABELS),
        primary_cta_url: UrlSchema,
        secondary_cta_label: z.literal(SECONDARY_CTA_LABELS.restaurant),
        secondary_cta_url: UrlSchema,
        hero_image: RestaurantHeroImageSchema
      })
      .strict(),
    proof: z
      .object({
        items: z.array(z.string().trim().min(1).max(18)).min(1).max(3)
      })
      .strict(),
    signature: z
      .object({
        items: z
          .array(
            z
              .object({
                title: z.string().trim().min(1).max(28),
                desc: z.string().trim().min(1).max(90),
                price: z.string().trim().min(1).max(8).optional(),
                image: BaseImageSchema.extend({
                  crop: z.enum(["1:1", "4:3"])
                }).strict()
              })
              .strict()
          )
          .min(3)
          .max(6)
      })
      .strict(),
    menu: z
      .object({
        variant: z.enum(["categories", "pdf"]),
        menu_url: UrlSchema
      })
      .strict(),
    story: z
      .object({
        paragraph: z.string().trim().min(1).max(320)
      })
      .strict(),
    logistics: z
      .object({
        variant: z.enum(["map_hours_contact", "hours_address_transit"]),
        address: z.string().trim().min(1).max(120),
        hours: z.array(z.string().trim().min(1).max(40)).min(3).max(14),
        phone: z.string().trim().min(1).max(30),
        map_url: UrlSchema.optional(),
        policies: z.array(z.string().trim().min(1).max(60)).min(0).max(5)
      })
      .strict(),
    reviews: z
      .object({
        items: z
          .array(
            z
              .object({
                quote: z.string().trim().min(1).max(140),
                name: z.string().trim().min(1).max(24)
              })
              .strict()
          )
          .min(0)
          .max(6)
      })
      .strict(),
    newsletter: z
      .object({
        headline: z.string().trim().min(1).max(32),
        subhead: z.string().trim().min(1).max(110)
      })
      .strict(),
    footer: z
      .object({
        email: z.string().trim().min(1).max(80),
        instagram_url: UrlSchema,
        micro_legal: z.string().trim().min(1).max(120).optional()
      })
      .strict()
  })
  .strict();

const DentalHeroImageSchema = BaseImageSchema.extend({
  crop_desktop: z.literal("16:9"),
  crop_mobile: z.literal("3:4")
}).strict();

const DentalSchema = z
  .object({
    template: z.literal("dental"),
    motion_level: MotionLevelSchema,
    brand: BaseBrandSchema,
    header: z
      .object({
        phone: z.string().trim().min(1).max(30),
        location: z.string().trim().min(1).max(120),
        primary_cta_label: z.literal(DENTAL_PRIMARY_CTA_LABEL),
        primary_cta_url: UrlSchema
      })
      .strict(),
    hero: z
      .object({
        headline: z.string().trim().min(1).max(52),
        subhead: z.string().trim().min(1).max(180),
        primary_cta_label: z.literal(DENTAL_PRIMARY_CTA_LABEL),
        primary_cta_url: UrlSchema,
        secondary_cta_label: z.literal(SECONDARY_CTA_LABELS.dental),
        secondary_cta_url: UrlSchema,
        hero_image: DentalHeroImageSchema
      })
      .strict(),
    trust: z
      .object({
        variant: z.enum(["rating_badges", "anxiety_points"]),
        rating_label: z.string().trim().min(1).max(32).optional(),
        differentiators: z.array(z.string().trim().min(1).max(70)).min(2).max(4)
      })
      .strict(),
    services: z
      .object({
        categories: z
          .array(
            z
              .object({
                title: z.string().trim().min(1).max(28),
                description: z.string().trim().min(1).max(110)
              })
              .strict()
          )
          .min(3)
          .max(10)
      })
      .strict(),
    why_us: z
      .object({
        items: z.array(z.string().trim().min(1).max(120)).min(3).max(6)
      })
      .strict(),
    team: z
      .object({
        providers: z
          .array(
            z
              .object({
                name: z.string().trim().min(1).max(48),
                bio: z.string().trim().min(1).max(220),
                credentials: z.string().trim().min(1).max(80),
                image: BaseImageSchema.extend({
                  crop: z.literal("1:1")
                }).strict()
              })
              .strict()
          )
          .min(1)
          .max(8)
      })
      .strict(),
    pricing: z
      .object({
        variant: z.enum(["insurance_list", "price_bands"]),
        items: z
          .array(
            z
              .object({
                title: z.string().trim().min(1).max(60),
                detail: z.string().trim().min(1).max(160)
              })
              .strict()
          )
          .min(1)
          .max(12)
      })
      .strict(),
    reviews: z
      .object({
        items: z
          .array(
            z
              .object({
                quote: z.string().trim().min(1).max(160),
                name: z.string().trim().min(1).max(40)
              })
              .strict()
          )
          .min(0)
          .max(8)
      })
      .strict(),
    faq: z
      .object({
        items: z
          .array(
            z
              .object({
                question: z.string().trim().min(1).max(80),
                answer: z.string().trim().min(1).max(240)
              })
              .strict()
          )
          .min(2)
          .max(10)
      })
      .strict(),
    contact: z
      .object({
        hours: z.array(z.string().trim().min(1).max(40)).min(3).max(14),
        address: z.string().trim().min(1).max(120),
        phone: z.string().trim().min(1).max(30),
        map_url: UrlSchema.optional(),
        booking_cta_label: z.literal(DENTAL_PRIMARY_CTA_LABEL),
        booking_cta_url: UrlSchema,
        emergency_note: z.string().trim().min(1).max(140)
      })
      .strict(),
    footer: z
      .object({
        legal_url: UrlSchema,
        privacy_url: UrlSchema,
        accessibility_statement_url: UrlSchema
      })
      .strict()
  })
  .strict();

const ServiceHeroImageSchema = BaseImageSchema.extend({
  crop_desktop: z.literal("16:9"),
  crop_mobile: z.literal("4:5")
}).strict();

const ServiceSchema = z
  .object({
    template: z.literal("service"),
    service_niche: ServiceNicheSchema,
    motion_level: MotionLevelSchema,
    brand: BaseBrandSchema,
    header: z
      .object({
        nav_items: z.tuple([
          z.literal("Services"),
          z.literal("Prices"),
          z.literal("Gallery"),
          z.literal("Contact")
        ]),
        primary_cta_label: z.enum(SERVICE_PRIMARY_CTA_LABELS),
        primary_cta_url: UrlSchema
      })
      .strict(),
    hero: z
      .object({
        headline: z.string().trim().min(1).max(36),
        tagline: z.string().trim().min(1).max(100),
        primary_cta_label: z.enum(SERVICE_PRIMARY_CTA_LABELS),
        primary_cta_url: UrlSchema,
        hero_image: ServiceHeroImageSchema
      })
      .strict(),
    services: z
      .object({
        items: z
          .array(
            z
              .object({
                title: z.string().trim().min(1).max(24),
                description: z.string().trim().min(1).max(80)
              })
              .strict()
          )
          .min(3)
          .max(14)
      })
      .strict(),
    pricing: z
      .object({
        variant: z.enum(["list", "starting_at"]),
        items: z
          .array(
            z
              .object({
                label: z.string().trim().min(1).max(24),
                amount: z.string().trim().min(1).max(12),
                detail: z.string().trim().min(1).max(80).optional()
              })
              .strict()
          )
          .min(1)
          .max(16)
      })
      .strict(),
    staff: z
      .object({
        enabled: z.boolean(),
        members: z
          .array(
            z
              .object({
                name: z.string().trim().min(1).max(48),
                role: z.string().trim().min(1).max(48),
                image: BaseImageSchema.extend({
                  crop: z.literal("1:1")
                }).strict()
              })
              .strict()
          )
          .min(0)
          .max(10)
      })
      .strict(),
    gallery: z
      .object({
        variant: z.enum(["masonry", "before_after"]),
        consent_for_before_after: z.boolean().optional(),
        items: z
          .array(
            z
              .object({
                src: UrlSchema,
                alt: z.string().trim().min(1).max(125),
                crop: z.enum(["1:1", "4:5"]),
                before_src: UrlSchema.optional(),
                after_src: UrlSchema.optional()
              })
              .strict()
          )
          .min(0)
          .max(24)
      })
      .strict(),
    reviews: z
      .object({
        items: z
          .array(
            z
              .object({
                quote: z.string().trim().min(1).max(120),
                name: z.string().trim().min(1).max(40)
              })
              .strict()
          )
          .min(0)
          .max(10),
        fallback_hygiene_bullets: z.array(z.string().trim().min(1).max(80)).min(0).max(3)
      })
      .strict(),
    contact: z
      .object({
        hours: z.array(z.string().trim().min(1).max(40)).min(3).max(14),
        address: z.string().trim().min(1).max(120),
        phone: z.string().trim().min(1).max(30),
        booking_cta_label: z.enum(SERVICE_PRIMARY_CTA_LABELS),
        booking_cta_url: UrlSchema
      })
      .strict(),
    footer: z
      .object({
        instagram_url: UrlSchema,
        email: z.string().trim().min(1).max(80).optional()
      })
      .strict()
  })
  .strict();

const RealEstateHeroImageSchema = BaseImageSchema.extend({
  crop_desktop: z.literal("21:9"),
  crop_mobile: z.literal("4:5")
}).strict();

const RealEstateSchema = z
  .object({
    template: z.literal("real_estate"),
    motion_level: MotionLevelSchema,
    brand: BaseBrandSchema,
    header: z
      .object({
        phone: z.string().trim().min(1).max(30),
        nav_items: z
          .array(
            z.enum(["Vision", "Residences", "Amenities", "Neighborhood", "Floorplans", "Press", "Team", "Contact"])
          )
          .min(6)
          .max(8),
        primary_cta_label: z.literal(REAL_ESTATE_PRIMARY_CTA_LABEL),
        primary_cta_url: UrlSchema
      })
      .strict(),
    hero: z
      .object({
        headline: z.string().trim().min(1).max(48),
        subhead: z.string().trim().min(1).max(200),
        status_badge: z.string().trim().min(1).max(24),
        primary_cta_label: z.literal(REAL_ESTATE_PRIMARY_CTA_LABEL),
        primary_cta_url: UrlSchema,
        secondary_cta_label: z.literal(SECONDARY_CTA_LABELS.real_estate).optional(),
        secondary_cta_url: UrlSchema.optional(),
        hero_image: RealEstateHeroImageSchema
      })
      .strict(),
    vision: z
      .object({
        paragraph: z.string().trim().min(1).max(520)
      })
      .strict(),
    residences: z
      .object({
        variant: z.enum(["property_cards", "floorplan_cards"]),
        items: z
          .array(
            z
              .object({
                title: z.string().trim().min(1).max(60),
                summary: z.string().trim().min(1).max(180),
                image: BaseImageSchema.extend({
                  crop: z.literal("4:3")
                }).strict(),
                cta_label: z.string().trim().min(1).max(20),
                cta_url: UrlSchema
              })
              .strict()
          )
          .min(1)
          .max(20)
      })
      .strict(),
    amenities: z
      .object({
        items: z
          .array(
            z
              .object({
                title: z.string().trim().min(1).max(50),
                description: z.string().trim().min(1).max(110)
              })
              .strict()
          )
          .min(3)
          .max(16)
      })
      .strict(),
    neighborhood: z
      .object({
        variant: z.enum(["map_highlights", "distance_chips"]),
        image: BaseImageSchema.extend({
          crop: z.literal("16:9")
        }).strict(),
        highlights: z.array(z.string().trim().min(1).max(90)).min(2).max(12)
      })
      .strict(),
    floorplans: z
      .object({
        downloads: z
          .array(
            z
              .object({
                label: z.string().trim().min(1).max(60),
                url: UrlSchema
              })
              .strict()
          )
          .min(1)
          .max(20)
      })
      .strict(),
    press: z
      .object({
        items: z
          .array(
            z
              .object({
                outlet: z.string().trim().min(1).max(40),
                title: z.string().trim().min(1).max(120),
                url: UrlSchema
              })
              .strict()
          )
          .min(0)
          .max(12)
      })
      .strict(),
    team: z
      .object({
        members: z
          .array(
            z
              .object({
                name: z.string().trim().min(1).max(48),
                role: z.string().trim().min(1).max(64)
              })
              .strict()
          )
          .min(0)
          .max(12)
      })
      .strict(),
    contact: z
      .object({
        address: z.string().trim().min(1).max(160),
        phone: z.string().trim().min(1).max(30),
        inquire_cta_label: z.literal(REAL_ESTATE_PRIMARY_CTA_LABEL),
        inquire_cta_url: UrlSchema,
        legal_teaser: z.string().trim().min(1).max(240),
        map_mode: z.enum(["static", "interactive"]),
        start_without_audio: z.boolean().optional(),
        keyboard_navigation_url: UrlSchema.optional()
      })
      .strict(),
    footer: z
      .object({
        legal_url: UrlSchema,
        privacy_url: UrlSchema,
        downloads_url: UrlSchema
      })
      .strict()
  })
  .strict();

export const DeterministicZodSchemas = {
  restaurant: RestaurantSchema,
  dental: DentalSchema,
  service: ServiceSchema,
  real_estate: RealEstateSchema
} as const;

export type RestaurantPayload = z.infer<typeof RestaurantSchema>;
export type DentalPayload = z.infer<typeof DentalSchema>;
export type ServicePayload = z.infer<typeof ServiceSchema>;
export type RealEstatePayload = z.infer<typeof RealEstateSchema>;

export type DeterministicPayload =
  | RestaurantPayload
  | DentalPayload
  | ServicePayload
  | RealEstatePayload;

export const RESTAURANT_JSON_SCHEMA: JsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: [
    "template",
    "motion_level",
    "brand",
    "header",
    "hero",
    "proof",
    "signature",
    "menu",
    "story",
    "logistics",
    "reviews",
    "newsletter",
    "footer"
  ],
  properties: {
    template: { const: "restaurant" },
    motion_level: { type: "string", enum: ["none", "minimal"] },
    brand: {
      type: "object",
      additionalProperties: false,
      required: ["business_name", "city", "accent_hex"],
      properties: {
        business_name: { type: "string", maxLength: 60 },
        city: { type: "string", maxLength: 40 },
        accent_hex: { type: "string", pattern: "^#[0-9A-Fa-f]{6}$" }
      }
    },
    header: {
      type: "object",
      additionalProperties: false,
      required: ["nav_items", "primary_cta_label", "primary_cta_url"],
      properties: {
        nav_items: {
          type: "array",
          minItems: 4,
          maxItems: 5,
          items: { type: "string", enum: ["Menu", "About", "Gallery", "Contact", "Catering"] }
        },
        primary_cta_label: { type: "string", enum: ["Reserve a table", "Order now", "Call now"] },
        primary_cta_url: { type: "string", maxLength: 2048 }
      }
    },
    hero: {
      type: "object",
      additionalProperties: false,
      required: [
        "headline",
        "subhead",
        "primary_cta_label",
        "primary_cta_url",
        "secondary_cta_label",
        "secondary_cta_url",
        "hero_image"
      ],
      properties: {
        headline: { type: "string", maxLength: 42 },
        subhead: { type: "string", maxLength: 140 },
        primary_cta_label: { type: "string", enum: ["Reserve a table", "Order now"] },
        primary_cta_url: { type: "string", maxLength: 2048 },
        secondary_cta_label: { const: "View menu" },
        secondary_cta_url: { type: "string", maxLength: 2048 },
        hero_image: {
          type: "object",
          additionalProperties: false,
          required: ["src", "alt", "crop_desktop", "crop_mobile"],
          properties: {
            src: { type: "string", maxLength: 2048 },
            alt: { type: "string", maxLength: 125 },
            crop_desktop: { const: "16:9" },
            crop_mobile: { const: "4:5" }
          }
        }
      }
    }
  }
};

export const DENTAL_JSON_SCHEMA: JsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: [
    "template",
    "motion_level",
    "brand",
    "header",
    "hero",
    "trust",
    "services",
    "why_us",
    "team",
    "pricing",
    "reviews",
    "faq",
    "contact",
    "footer"
  ],
  properties: {
    template: { const: "dental" },
    motion_level: { type: "string", enum: ["none", "minimal"] },
    brand: { type: "object" },
    header: { type: "object" },
    hero: { type: "object" },
    trust: { type: "object" },
    services: { type: "object" },
    why_us: { type: "object" },
    team: { type: "object" },
    pricing: { type: "object" },
    reviews: { type: "object" },
    faq: { type: "object" },
    contact: { type: "object" },
    footer: { type: "object" }
  }
};

export const SERVICE_JSON_SCHEMA: JsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: [
    "template",
    "service_niche",
    "motion_level",
    "brand",
    "header",
    "hero",
    "services",
    "pricing",
    "staff",
    "gallery",
    "reviews",
    "contact",
    "footer"
  ],
  properties: {
    template: { const: "service" },
    service_niche: { type: "string", enum: ["barbershop", "beauty_salon", "nail_salon"] },
    motion_level: { type: "string", enum: ["none", "minimal"] },
    brand: { type: "object" },
    header: { type: "object" },
    hero: { type: "object" },
    services: { type: "object" },
    pricing: { type: "object" },
    staff: { type: "object" },
    gallery: { type: "object" },
    reviews: { type: "object" },
    contact: { type: "object" },
    footer: { type: "object" }
  }
};

export const REAL_ESTATE_JSON_SCHEMA: JsonSchema = {
  $schema: "https://json-schema.org/draft/2020-12/schema",
  type: "object",
  additionalProperties: false,
  required: [
    "template",
    "motion_level",
    "brand",
    "header",
    "hero",
    "vision",
    "residences",
    "amenities",
    "neighborhood",
    "floorplans",
    "press",
    "team",
    "contact",
    "footer"
  ],
  properties: {
    template: { const: "real_estate" },
    motion_level: { type: "string", enum: ["none", "minimal"] },
    brand: { type: "object" },
    header: { type: "object" },
    hero: { type: "object" },
    vision: { type: "object" },
    residences: { type: "object" },
    amenities: { type: "object" },
    neighborhood: { type: "object" },
    floorplans: { type: "object" },
    press: { type: "object" },
    team: { type: "object" },
    contact: { type: "object" },
    footer: { type: "object" }
  }
};

export const DeterministicJsonSchemas = {
  restaurant: RESTAURANT_JSON_SCHEMA,
  dental: DENTAL_JSON_SCHEMA,
  service: SERVICE_JSON_SCHEMA,
  real_estate: REAL_ESTATE_JSON_SCHEMA
} as const;

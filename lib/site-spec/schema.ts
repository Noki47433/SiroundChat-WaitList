/**
 * Site Spec v1 — the production contract between AI intent and rendered HTML.
 *
 *   AI intent → Site Spec / edit operations → validation → deterministic renderer
 *
 * Nothing downstream of this file accepts a spec that has not been through
 * `SiteSpecSchema`. The renderer is written on the assumption that a spec it is
 * handed is already valid, so this schema is the only place where "is this
 * safe / complete / coherent?" is decided.
 *
 * Two rules shape the whole design:
 *
 *  1. **No executable payloads.** There is no field anywhere that carries HTML,
 *     CSS, JavaScript or a font name. Geometry is numbers, style is enums,
 *     links are parsed URLs restricted to safe schemes.
 *  2. **No duplicated operational truth.** Prices, durations, hours, addresses
 *     and team names are never stored here. Sections declare which canonical
 *     rows they show; the resolver substitutes live values at render time.
 */
import { z } from "zod";

import {
  ART_TREATMENTS,
  ASPECT_RATIOS,
  BOOKING_PRESENTATIONS,
  CONTACT_PRESENTATIONS,
  CTA_SHAPES,
  DENSITIES,
  EYEBROW_STYLES,
  FACT_REFS_REQUIRING_ID,
  FONT_STACK_IDS,
  FOOTER_PRESENTATIONS,
  GALLERY_PRESENTATIONS,
  GALLERY_TILE_COUNT,
  HERO_VARIANTS,
  HOURS_PRESENTATIONS,
  MAX_ENQUIRY_FIELDS,
  MAX_GALLERY_ITEMS,
  MAX_NAV_ITEMS,
  MAX_REVIEWS,
  MAX_SECTIONS,
  MAX_SOCIAL_LINKS,
  NAV_POSITIONS,
  NAV_SHAPES,
  REVIEWS_PRESENTATIONS,
  SECTION_LAYOUTS,
  SERVICES_PRESENTATIONS,
  STORY_PRESENTATIONS,
  TEAM_PRESENTATIONS,
  TOKEN_BOUNDS
} from "@/lib/site-spec/vocabulary";

// ─────────────────────────────────────────────────────────────────────────────
// Primitives
// ─────────────────────────────────────────────────────────────────────────────

/** A section id: stable, url-safe, and usable as a scroll anchor. */
export const SectionIdSchema = z
  .string()
  .trim()
  .min(1)
  .max(48)
  .regex(/^[a-z][a-z0-9-]*$/, "section ids are lowercase kebab-case and start with a letter");

const bounded = (key: keyof typeof TOKEN_BOUNDS) =>
  z.number().finite().min(TOKEN_BOUNDS[key].min).max(TOKEN_BOUNDS[key].max);

/** `#rgb`, `#rrggbb`, `#rrggbbaa` only. No `rgb()`, no named colours, no `var()`. */
export const ColorSchema = z
  .string()
  .trim()
  .regex(/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/, "expected a hex colour");

/**
 * Owner- or AI-authored presentation copy. Length-capped so a spec cannot be
 * used to smuggle a document into a heading. Newlines are allowed (the hero
 * headline uses them as deliberate line breaks) but control characters are not.
 */
const copy = (max: number) =>
  z
    .string()
    .max(max)
    .refine((v) => !/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/.test(v), "control characters are not allowed");

export const ShortTextSchema = copy(120).transform((v) => v.trim());
export const HeadlineSchema = copy(180);
export const BodyTextSchema = copy(1200);

/**
 * A reference to a canonical business fact. This — not a string — is how a
 * price or an address gets onto a page.
 */
export const FactRefSchema = z
  .object({
    ref: z.enum([
      "business.name",
      "business.description",
      "location.address",
      "location.phone",
      "location.name",
      "service.name",
      "service.price",
      "service.duration",
      "team.name",
      "team.role"
    ]),
    id: z.string().uuid().optional()
  })
  .superRefine((value, ctx) => {
    const needsId = FACT_REFS_REQUIRING_ID.includes(value.ref);
    if (needsId && !value.id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${value.ref} requires an id` });
    }
    if (!needsId && value.id) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: `${value.ref} does not take an id` });
    }
  });

export type FactRef = z.infer<typeof FactRefSchema>;

/** Either authored presentation copy, or a binding to canonical truth. */
export const SpecTextSchema = z.union([ShortTextSchema, FactRefSchema]);
export type SpecText = z.infer<typeof SpecTextSchema>;

/** Only `https:` survives. `javascript:`, `data:` and bare `http:` are rejected. */
export const SafeUrlSchema = z
  .string()
  .trim()
  .max(2048)
  .superRefine((value, ctx) => {
    let parsed: URL;
    try {
      parsed = new URL(value);
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "not a valid absolute URL" });
      return;
    }
    if (parsed.protocol !== "https:") {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "only https URLs are allowed" });
    }
  });

// ─────────────────────────────────────────────────────────────────────────────
// Media
// ─────────────────────────────────────────────────────────────────────────────

/**
 * How an image slot is filled.
 *
 *  - `asset`     an owner-owned row in `builder_site_assets`. Pinned: it is
 *                addressed by id, so an unrelated edit elsewhere in the spec
 *                cannot dislodge it.
 *  - `generated` deterministic art drawn from the spec's own art direction.
 *                Same spec, same index, same picture — no network, no model.
 *
 * There is deliberately no `{ url }` variant: an arbitrary image URL in a spec
 * is exactly the "baked into markup" problem the audit found.
 */
export const MediaRefSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("asset"),
    assetId: z.string().uuid(),
    alt: ShortTextSchema,
    /** Kept so a deleted or unreadable asset can still draw something. */
    fallbackSeed: z.number().int().min(0).max(64).default(0)
  }),
  z.object({
    kind: z.literal("generated"),
    seed: z.number().int().min(0).max(64),
    alt: ShortTextSchema.optional()
  })
]);
export type MediaRef = z.infer<typeof MediaRefSchema>;

export const FramingSchema = z
  .object({
    ratio: z.enum(ASPECT_RATIOS).optional(),
    caption: ShortTextSchema.optional()
  })
  .default({});

// ─────────────────────────────────────────────────────────────────────────────
// Calls to action
// ─────────────────────────────────────────────────────────────────────────────

export const CtaTargetSchema = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("booking") }),
  z.object({ kind: z.literal("enquiry") }),
  z.object({ kind: z.literal("section"), sectionId: SectionIdSchema }),
  z.object({ kind: z.literal("phone") }),
  z.object({ kind: z.literal("email") }),
  z.object({ kind: z.literal("directions") }),
  z.object({ kind: z.literal("external"), url: SafeUrlSchema })
]);
export type CtaTarget = z.infer<typeof CtaTargetSchema>;

export const CtaSchema = z.object({
  label: ShortTextSchema.pipe(z.string().min(1)),
  target: CtaTargetSchema
});
export type Cta = z.infer<typeof CtaSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Design
// ─────────────────────────────────────────────────────────────────────────────

export const PaletteSchema = z.object({
  background: ColorSchema,
  ink: ColorSchema,
  muted: ColorSchema,
  accent: ColorSchema,
  /** Text drawn *on* the accent. Contrast against `accent` is checked below. */
  accentInk: ColorSchema,
  line: ColorSchema,
  soft: ColorSchema,
  panel: ColorSchema
});
export type Palette = z.infer<typeof PaletteSchema>;

export const GeometrySchema = z.object({
  radius: bounded("radius"),
  radiusLg: bounded("radiusLg"),
  sectionPad: bounded("sectionPad"),
  sectionPadX: bounded("sectionPadX"),
  gap: bounded("gap"),
  colGap: bounded("colGap"),
  rule: bounded("rule")
});

export const TypographySchema = z.object({
  body: z.enum(FONT_STACK_IDS),
  display: z.enum(FONT_STACK_IDS),
  displayWeight: bounded("displayWeight"),
  heroWeight: bounded("heroWeight"),
  tracking: bounded("tracking"),
  measure: bounded("measure")
});

export const HeroMetricsSchema = z.object({
  height: bounded("heroHeight"),
  mobileHeight: bounded("heroMobileHeight"),
  measure: bounded("heroMeasure")
});

/**
 * One entry in the site's art sequence. Every generated image on the site draws
 * from this sequence by index, which is why no two sections repeat the same
 * picture and why the whole site shares one light source.
 */
export const ArtStopSchema = z.object({
  angle: z.number().int().min(0).max(359),
  stops: z
    .array(z.object({ color: ColorSchema, at: z.number().min(0).max(100) }))
    .min(2)
    .max(4),
  /**
   * Soft radial masses laid over the gradient. These are what give a generated
   * image a light source and a tonal centre instead of a flat wash.
   */
  forms: z
    .array(
      z.object({
        x: z.number().min(0).max(100),
        y: z.number().min(0).max(100),
        sizeX: z.number().min(10).max(90),
        sizeY: z.number().min(10).max(90),
        color: ColorSchema
      })
    )
    .max(3)
    .default([])
});

export type ArtStop = z.infer<typeof ArtStopSchema>;

export const ArtDirectionSchema = z.object({
  treatment: z.enum(ART_TREATMENTS),
  sequence: z.array(ArtStopSchema).min(1).max(12)
});
export type ArtDirection = z.infer<typeof ArtDirectionSchema>;

export const ChromeSchema = z.object({
  nav: z.enum(NAV_SHAPES),
  navPosition: z.enum(NAV_POSITIONS),
  cta: z.enum(CTA_SHAPES),
  eyebrow: z.enum(EYEBROW_STYLES)
});

export const DesignSchema = z.object({
  density: z.enum(DENSITIES).default("regular"),
  palette: PaletteSchema,
  geometry: GeometrySchema,
  typography: TypographySchema,
  hero: HeroMetricsSchema,
  chrome: ChromeSchema,
  art: ArtDirectionSchema
});
export type Design = z.infer<typeof DesignSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Content selection — how a section names the canonical rows it displays
// ─────────────────────────────────────────────────────────────────────────────

/**
 * `all` follows the business: a service added in Business appears on the site
 * without an edit. An explicit id list is a deliberate curation choice, and ids
 * that no longer exist are dropped at resolve time rather than failing render.
 */
export const SelectionSchema = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("all"), limit: z.number().int().min(1).max(24).optional() }),
  z.object({ mode: z.literal("include"), ids: z.array(z.string().uuid()).min(1).max(24) })
]);
export type Selection = z.infer<typeof SelectionSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Sections
// ─────────────────────────────────────────────────────────────────────────────

const HeadingSchema = z
  .object({
    eyebrow: SpecTextSchema.optional(),
    title: z.union([HeadlineSchema, FactRefSchema]).optional(),
    sub: z.union([BodyTextSchema, FactRefSchema]).optional()
  })
  .default({});

const sectionBase = {
  id: SectionIdSchema,
  heading: HeadingSchema
};

/**
 * Sections placed by `layout`. The hero and the booking strip are deliberately
 * absent: both are full-bleed bands the renderer composes from their own
 * variant, so a `layout` on them would be a field with no effect.
 */
const laidOut = {
  ...sectionBase,
  layout: z.enum(SECTION_LAYOUTS).default("stack")
};

export const HeroSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("hero"),
  variant: z.enum(HERO_VARIANTS),
  eyebrow: SpecTextSchema.optional(),
  headline: HeadlineSchema,
  body: z.union([BodyTextSchema, FactRefSchema]).optional(),
  primaryCta: CtaSchema,
  secondaryCta: CtaSchema.optional(),
  media: MediaRefSchema,
  accentRule: z.boolean().default(false),
  bandCaption: ShortTextSchema.optional()
});

export const BookingStripSectionSchema = z.object({
  ...sectionBase,
  type: z.literal("bookingStrip"),
  headline: ShortTextSchema,
  sub: ShortTextSchema.optional(),
  cta: CtaSchema
});

export const ServicesSectionSchema = z.object({
  ...laidOut,
  type: z.literal("services"),
  presentation: z.enum(SERVICES_PRESENTATIONS),
  selection: SelectionSchema.default({ mode: "all" }),
  showPrices: z.boolean().default(true),
  showDurations: z.boolean().default(true),
  showDescriptions: z.boolean().default(true),
  withImages: z.boolean().default(false)
});

export const GallerySectionSchema = z.object({
  ...laidOut,
  type: z.literal("gallery"),
  presentation: z.enum(GALLERY_PRESENTATIONS),
  items: z.array(MediaRefSchema).max(MAX_GALLERY_ITEMS).default([]),
  captions: z.array(ShortTextSchema).max(MAX_GALLERY_ITEMS).default([]),
  framing: FramingSchema
});

export const StorySectionSchema = z.object({
  ...laidOut,
  type: z.literal("story"),
  presentation: z.enum(STORY_PRESENTATIONS),
  body: BodyTextSchema.optional(),
  quote: copy(400).optional(),
  attribution: ShortTextSchema.optional(),
  stats: z
    .array(z.object({ value: ShortTextSchema, label: ShortTextSchema }))
    .max(4)
    .default([])
});

export const TeamSectionSchema = z.object({
  ...laidOut,
  type: z.literal("team"),
  presentation: z.enum(TEAM_PRESENTATIONS),
  selection: SelectionSchema.default({ mode: "all" }),
  showRoles: z.boolean().default(true),
  /** Optional per-member portrait override, keyed by team member id. */
  portraits: z.record(z.string().uuid(), MediaRefSchema).default({}),
  ratio: z.enum(ASPECT_RATIOS).default("3/4")
});

export const HoursSectionSchema = z.object({
  ...laidOut,
  type: z.literal("hours"),
  presentation: z.enum(HOURS_PRESENTATIONS),
  note: ShortTextSchema.optional(),
  noteStyle: z.enum(["info", "rule"]).default("info"),
  /** Show the business's real upcoming exceptions (closures, special hours). */
  showExceptions: z.boolean().default(true)
});

export const BookingSectionSchema = z.object({
  ...laidOut,
  type: z.literal("booking"),
  presentation: z.enum(BOOKING_PRESENTATIONS),
  cta: CtaSchema
});

/**
 * An enquiry form has to actually reach somebody, so its fields are the ones
 * the existing site-submissions endpoint accepts — not free-form names that
 * would render a box nobody receives. Which fields appear, and what they are
 * called on the page, stay spec-owned.
 */
export const ENQUIRY_FIELD_NAMES = ["name", "email", "phone", "message"] as const;

export const EnquirySectionSchema = z
  .object({
    ...laidOut,
    type: z.literal("enquiry"),
    presentation: z.enum(BOOKING_PRESENTATIONS),
    fields: z
      .array(
        z.object({
          name: z.enum(ENQUIRY_FIELD_NAMES),
          label: ShortTextSchema,
          placeholder: ShortTextSchema.optional(),
          required: z.boolean().default(false)
        })
      )
      .min(1)
      .max(MAX_ENQUIRY_FIELDS),
    cta: CtaSchema
  })
  .superRefine((section, ctx) => {
    const names = section.fields.map((field) => field.name);
    if (new Set(names).size !== names.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["fields"], message: "duplicate field" });
    }
    for (const required of ["name", "message"] as const) {
      if (!names.includes(required)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fields"],
          message: `an enquiry form needs a "${required}" field`
        });
      }
    }
    if (!names.includes("email") && !names.includes("phone")) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["fields"],
        message: 'an enquiry form needs an "email" or a "phone" field to reply to'
      });
    }
  });

/**
 * Reviews are owner-supplied or connected, never drafted. The audit found the
 * previous generator fabricating testimonials under an explicit prompt
 * contract; the `empty` presentation exists so a site can carry the section
 * honestly before any real review has been connected.
 */
export const ReviewsSectionSchema = z.object({
  ...laidOut,
  type: z.literal("reviews"),
  presentation: z.enum(REVIEWS_PRESENTATIONS),
  items: z
    .array(
      z.object({
        quote: copy(600),
        author: ShortTextSchema,
        source: z.enum(["owner_entered", "google", "facebook"]),
        rating: z.number().int().min(1).max(5).optional()
      })
    )
    .max(MAX_REVIEWS)
    .default([])
});

export const ContactSectionSchema = z.object({
  ...laidOut,
  type: z.literal("contact"),
  presentation: z.enum(CONTACT_PRESENTATIONS),
  showMap: z.boolean().default(true),
  showSocials: z.boolean().default(true),
  cta: CtaSchema.optional()
});

export const SectionSchema = z.discriminatedUnion("type", [
  HeroSectionSchema,
  BookingStripSectionSchema,
  ServicesSectionSchema,
  GallerySectionSchema,
  StorySectionSchema,
  TeamSectionSchema,
  HoursSectionSchema,
  BookingSectionSchema,
  EnquirySectionSchema,
  ReviewsSectionSchema,
  ContactSectionSchema
]);
export type Section = z.infer<typeof SectionSchema>;
export type SectionOfType<T extends Section["type"]> = Extract<Section, { type: T }>;

// ─────────────────────────────────────────────────────────────────────────────
// Terminology, navigation, footer
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The words this business uses. A photography studio says "Enquire" and "Work";
 * a barbershop says "Book" and "Services". Both go through the same renderer —
 * the difference lives here, not in a branch.
 */
export const TerminologySchema = z.object({
  primaryAction: ShortTextSchema.pipe(z.string().min(1)),
  services: ShortTextSchema.pipe(z.string().min(1)),
  team: ShortTextSchema.pipe(z.string().min(1)),
  gallery: ShortTextSchema.pipe(z.string().min(1)),
  hours: ShortTextSchema.pipe(z.string().min(1)),
  story: ShortTextSchema.pipe(z.string().min(1)),
  reviews: ShortTextSchema.pipe(z.string().min(1)),
  contact: ShortTextSchema.pipe(z.string().min(1))
});
export type Terminology = z.infer<typeof TerminologySchema>;

export const NavSchema = z.object({
  /** Sections to surface, in order. Validated to exist and be navigable. */
  items: z.array(SectionIdSchema).max(MAX_NAV_ITEMS).default([]),
  cta: CtaSchema
});

export const FooterSchema = z.object({
  presentation: z.enum(FOOTER_PRESENTATIONS),
  ctaHeadline: ShortTextSchema.optional(),
  note: ShortTextSchema.optional()
});

export const SocialLinkSchema = z.object({
  label: ShortTextSchema.pipe(z.string().min(1)),
  url: SafeUrlSchema
});

// ─────────────────────────────────────────────────────────────────────────────
// The spec
// ─────────────────────────────────────────────────────────────────────────────

export const SiteSpecSchema = z
  .object({
    kind: z.literal("site_spec"),
    version: z.literal(1),
    meta: z.object({
      businessId: z.string().uuid(),
      /** Presentation-only display name. Empty means "use the canonical name". */
      brandName: ShortTextSchema.optional(),
      /** 1–3 characters drawn in the brand mark. */
      brandMark: z.string().trim().min(1).max(3).optional(),
      locale: z
        .string()
        .trim()
        .regex(/^[a-z]{2}(-[A-Z]{2})?$/, "expected a BCP-47 language tag like `en` or `en-GB`")
        .default("en"),
      seo: z.object({
        title: copy(70).pipe(z.string().min(1)),
        description: copy(180).pipe(z.string().min(1))
      }),
      generatedAt: z.string().datetime({ offset: true }),
      updatedAt: z.string().datetime({ offset: true })
    }),
    design: DesignSchema,
    terminology: TerminologySchema,
    nav: NavSchema,
    sections: z.array(SectionSchema).min(1).max(MAX_SECTIONS),
    footer: FooterSchema,
    socials: z.array(SocialLinkSchema).max(MAX_SOCIAL_LINKS).default([])
  })
  .superRefine((spec, ctx) => {
    // ── section ids are unique ────────────────────────────────────────────
    const seen = new Set<string>();
    for (const [index, section] of spec.sections.entries()) {
      if (seen.has(section.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sections", index, "id"],
          message: `duplicate section id "${section.id}"`
        });
      }
      seen.add(section.id);
    }

    // ── ordering: exactly one hero, and it opens the page ─────────────────
    const heroes = spec.sections.filter((section) => section.type === "hero");
    if (heroes.length !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sections"],
        message: `a site has exactly one hero section, found ${heroes.length}`
      });
    } else if (spec.sections[0]?.type !== "hero") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["sections", 0],
        message: "the hero must be the first section"
      });
    }

    // ── at most one of each singleton section type ────────────────────────
    const singletons = ["bookingStrip", "hours", "contact", "booking", "enquiry"] as const;
    for (const type of singletons) {
      const count = spec.sections.filter((section) => section.type === type).length;
      if (count > 1) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["sections"],
          message: `only one "${type}" section is allowed, found ${count}`
        });
      }
    }

    // ── every internal CTA resolves ───────────────────────────────────────
    const hasEnquiry = spec.sections.some((section) => section.type === "enquiry");
    const checkTarget = (target: CtaTarget, path: (string | number)[]) => {
      if (target.kind === "section" && !seen.has(target.sectionId)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path,
          message: `CTA targets unknown section "${target.sectionId}"`
        });
      }
      if (target.kind === "enquiry" && !hasEnquiry) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path,
          message: "CTA targets the enquiry form, but the site has no enquiry section"
        });
      }
    };

    checkTarget(spec.nav.cta.target, ["nav", "cta", "target"]);
    for (const [index, section] of spec.sections.entries()) {
      const base = ["sections", index];
      if ("primaryCta" in section && section.primaryCta) {
        checkTarget(section.primaryCta.target, [...base, "primaryCta", "target"]);
      }
      if ("secondaryCta" in section && section.secondaryCta) {
        checkTarget(section.secondaryCta.target, [...base, "secondaryCta", "target"]);
      }
      if ("cta" in section && section.cta) {
        checkTarget(section.cta.target, [...base, "cta", "target"]);
      }
    }

    // ── nav items point at real, linkable sections ────────────────────────
    for (const [index, id] of spec.nav.items.entries()) {
      const section = spec.sections.find((candidate) => candidate.id === id);
      if (!section) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["nav", "items", index],
          message: `nav item points at unknown section "${id}"`
        });
      } else if (section.type === "hero" || section.type === "bookingStrip") {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["nav", "items", index],
          message: `"${section.type}" sections are not navigable`
        });
      }
    }

    // ── unsupported combinations ──────────────────────────────────────────
    for (const [index, section] of spec.sections.entries()) {
      const path = ["sections", index];

      // A gallery has to fill its grid exactly; the grid is defined by the
      // presentation, so a short items list would render visible holes.
      if (section.type === "gallery") {
        const required = GALLERY_TILE_COUNT[section.presentation];
        if (section.items.length !== required) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [...path, "items"],
            message: `the "${section.presentation}" gallery needs exactly ${required} items, found ${section.items.length}`
          });
        }
        if (section.captions.length && section.captions.length !== section.items.length) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: [...path, "captions"],
            message: "captions must be empty or one per item"
          });
        }
      }

      // `flush` removes horizontal padding, which only some compositions are
      // built to survive. Anything else would run text into the viewport edge.
      if ("layout" in section && section.layout === "flush" && !FLUSH_SAFE.has(section.type)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...path, "layout"],
          message: `"flush" is not supported for "${section.type}" sections`
        });
      }

      // A `list` reviews section with nothing in it is the fabrication trap the
      // audit found. Say so explicitly with the `empty` presentation instead.
      if (section.type === "reviews" && section.presentation === "list" && !section.items.length) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: [...path, "items"],
          message: 'a "list" reviews section needs at least one real review — use "empty" instead'
        });
      }

    }

    // ── accent text has to be readable on the accent ──────────────────────
    const ratio = contrastRatio(spec.design.palette.accent, spec.design.palette.accentInk);
    if (ratio < 3) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["design", "palette", "accentInk"],
        message: `accentInk needs at least 3:1 contrast against accent (got ${ratio.toFixed(2)}:1)`
      });
    }
    const bodyRatio = contrastRatio(spec.design.palette.background, spec.design.palette.ink);
    if (bodyRatio < 4.5) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["design", "palette", "ink"],
        message: `body text needs at least 4.5:1 contrast against the background (got ${bodyRatio.toFixed(2)}:1)`
      });
    }
  });

export type SiteSpec = z.infer<typeof SiteSpecSchema>;

/**
 * Section types whose compositions are built to run edge to edge — and which
 * the responsive fixtures actually cover at that width. Widening this set is a
 * deliberate decision that needs a fixture behind it.
 */
const FLUSH_SAFE = new Set<Section["type"]>(["contact"]);

// ─────────────────────────────────────────────────────────────────────────────
// Contrast (WCAG relative luminance)
// ─────────────────────────────────────────────────────────────────────────────

const hexToRgb = (hex: string): [number, number, number] => {
  const raw = hex.slice(1);
  const full =
    raw.length === 3
      ? raw
          .split("")
          .map((c) => c + c)
          .join("")
      : raw.slice(0, 6);
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16)
  ];
};

const relativeLuminance = (hex: string) => {
  const channel = (value: number) => {
    const c = value / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  };
  const [r, g, b] = hexToRgb(hex);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

export const contrastRatio = (a: string, b: string) => {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
};

// ─────────────────────────────────────────────────────────────────────────────
// Entry points
// ─────────────────────────────────────────────────────────────────────────────

export type SiteSpecValidation =
  | { ok: true; spec: SiteSpec }
  | { ok: false; issues: Array<{ path: string; message: string }> };

/**
 * The one gate. Everything that persists or renders a spec calls this and
 * handles the failure branch — nothing downstream re-checks, and nothing
 * downstream is allowed to guess.
 */
export const validateSiteSpec = (value: unknown): SiteSpecValidation => {
  const parsed = SiteSpecSchema.safeParse(value);
  if (parsed.success) return { ok: true, spec: parsed.data };
  return {
    ok: false,
    issues: parsed.error.issues.map((issue) => ({
      path: issue.path.join("."),
      message: issue.message
    }))
  };
};

/** Convenience for read paths that treat an unparseable spec as "not a spec". */
export const parseSiteSpec = (value: unknown): SiteSpec | null => {
  const result = validateSiteSpec(value);
  return result.ok ? result.spec : null;
};

/**
 * Cheap discriminator for the public site route, which has to tell a Site Spec
 * apart from the two legacy document formats before doing any real work.
 */
export const isSiteSpecDocument = (value: unknown): boolean =>
  Boolean(
    value &&
      typeof value === "object" &&
      (value as { kind?: unknown }).kind === "site_spec" &&
      (value as { version?: unknown }).version === 1
  );

/**
 * Site Spec vocabulary — the closed set of choices a website can express.
 *
 * Every value here is a *presentation* choice. None of them names an industry,
 * a trade or a business. A barbershop and a photography studio differ because
 * their specs pick different values from these lists, never because the
 * renderer branches on what they sell.
 *
 * Adding a value here is a deliberate product decision: it must be supported by
 * the renderer and covered by the responsive fixtures.
 */

// ─────────────────────────────────────────────────────────────────────────────
// Sections
// ─────────────────────────────────────────────────────────────────────────────

/** Every block the renderer knows how to draw. Order in a spec is free. */
export const SECTION_TYPES = [
  "hero",
  "bookingStrip",
  "services",
  "gallery",
  "story",
  "team",
  "hours",
  "booking",
  "enquiry",
  "reviews",
  "contact"
] as const;
export type SectionType = (typeof SECTION_TYPES)[number];

/**
 * How a section places its heading against its body. This is the single
 * biggest reason two sites stop looking like the same page repeated.
 */
export const SECTION_LAYOUTS = [
  "stack", // heading above body
  "split", // sticky label column beside the body
  "wide", // heading above a body that uses the full measure
  "centered", // centred heading and body
  "edge", // oversized heading beside the body
  "flush" // edge-to-edge, no horizontal padding
] as const;
export type SectionLayout = (typeof SECTION_LAYOUTS)[number];

/** Presentations are per section type — a services `pres` is not a gallery `pres`. */
export const HERO_VARIANTS = ["full", "split", "editorial"] as const;
export type HeroVariant = (typeof HERO_VARIANTS)[number];

export const SERVICES_PRESENTATIONS = ["rows", "cards", "editorial", "packages"] as const;
export type ServicesPresentation = (typeof SERVICES_PRESENTATIONS)[number];

export const GALLERY_PRESENTATIONS = ["mosaic", "portfolio", "filmstrip", "duo"] as const;
export type GalleryPresentation = (typeof GALLERY_PRESENTATIONS)[number];

/** Tile counts are fixed per presentation so a grid never renders a hole. */
export const GALLERY_TILE_COUNT: Record<GalleryPresentation, number> = {
  mosaic: 6,
  portfolio: 5,
  filmstrip: 4,
  duo: 2
};

export const STORY_PRESENTATIONS = ["pullquote", "column"] as const;
export type StoryPresentation = (typeof STORY_PRESENTATIONS)[number];

export const TEAM_PRESENTATIONS = ["overlay", "editorial", "plain"] as const;
export type TeamPresentation = (typeof TEAM_PRESENTATIONS)[number];

export const HOURS_PRESENTATIONS = ["strip", "card", "cols"] as const;
export type HoursPresentation = (typeof HOURS_PRESENTATIONS)[number];

export const BOOKING_PRESENTATIONS = ["panel", "plain", "invert"] as const;
export type BookingPresentation = (typeof BOOKING_PRESENTATIONS)[number];

export const REVIEWS_PRESENTATIONS = ["list", "empty"] as const;
export type ReviewsPresentation = (typeof REVIEWS_PRESENTATIONS)[number];

export const CONTACT_PRESENTATIONS = ["panel", "center", "stack", "split"] as const;
export type ContactPresentation = (typeof CONTACT_PRESENTATIONS)[number];

export const FOOTER_PRESENTATIONS = ["brand", "cta", "editorial", "minimal"] as const;
export type FooterPresentation = (typeof FOOTER_PRESENTATIONS)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Chrome
// ─────────────────────────────────────────────────────────────────────────────

export const NAV_SHAPES = ["pill", "square", "soft", "rule"] as const;
export type NavShape = (typeof NAV_SHAPES)[number];

export const NAV_POSITIONS = ["edge", "center"] as const;
export type NavPosition = (typeof NAV_POSITIONS)[number];

export const CTA_SHAPES = ["pill", "square", "rule"] as const;
export type CtaShape = (typeof CTA_SHAPES)[number];

export const EYEBROW_STYLES = ["caps", "serif", "mono", "rule"] as const;
export type EyebrowStyle = (typeof EYEBROW_STYLES)[number];

/** Global rhythm multiplier. `spacious` is the prototype's "premium" modifier. */
export const DENSITIES = ["compact", "regular", "spacious"] as const;
export type Density = (typeof DENSITIES)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Art direction
// ─────────────────────────────────────────────────────────────────────────────

/**
 * How photography is graded. Each treatment carries its own contrast curve,
 * grain weight, vignette shape and colour temperature — see the renderer CSS.
 */
export const ART_TREATMENTS = ["cinematic", "clean", "editorial", "photographic"] as const;
export type ArtTreatment = (typeof ART_TREATMENTS)[number];

/** Image aspect ratios, as an enum so the renderer never receives free CSS. */
export const ASPECT_RATIOS = ["1/1", "3/4", "4/3", "4/5", "3/2", "16/9", "21/9"] as const;
export type AspectRatio = (typeof ASPECT_RATIOS)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Typography
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Font stacks are ids, never raw font strings. This is both a safety boundary
 * (no arbitrary text reaches a `font-family` declaration) and a reliability one
 * (every stack is known to have a working fallback on every platform).
 */
export const FONT_STACKS = {
  system:
    "-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,'Helvetica Neue',Arial,sans-serif",
  "system-display":
    "-apple-system,BlinkMacSystemFont,'SF Pro Display','Segoe UI',Roboto,Arial,sans-serif",
  grotesk: "'Helvetica Neue',Helvetica,Inter,Arial,sans-serif",
  humanist: "Optima,Candara,'Gill Sans','Trebuchet MS',sans-serif",
  serif: "Georgia,'Times New Roman',Times,serif",
  "serif-display": "'Iowan Old Style','Palatino Linotype',Palatino,Georgia,serif",
  mono: "ui-monospace,SFMono-Regular,Menlo,Consolas,monospace"
} as const;

export type FontStackId = keyof typeof FONT_STACKS;
export const FONT_STACK_IDS = Object.keys(FONT_STACKS) as [FontStackId, ...FontStackId[]];

// ─────────────────────────────────────────────────────────────────────────────
// Call-to-action targets
// ─────────────────────────────────────────────────────────────────────────────

export const CTA_TARGET_KINDS = [
  "booking", // open the booking flow for this business
  "enquiry", // scroll to / open the enquiry form
  "section", // scroll to another section in this spec
  "phone", // tel: the canonical business phone
  "email", // mailto: the canonical business email
  "directions", // map link for the canonical location
  "external" // an explicit, validated https URL
] as const;
export type CtaTargetKind = (typeof CTA_TARGET_KINDS)[number];

// ─────────────────────────────────────────────────────────────────────────────
// Business-fact references
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The only paths through which canonical operational truth can enter a page.
 * A spec may not contain a copy of a price, a duration or an address; it holds
 * one of these references and the resolver substitutes the live value.
 */
export const FACT_REFS = [
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
] as const;
export type FactRefKind = (typeof FACT_REFS)[number];

/** Refs that address a specific row and therefore require an `id`. */
export const FACT_REFS_REQUIRING_ID: readonly FactRefKind[] = [
  "service.name",
  "service.price",
  "service.duration",
  "team.name",
  "team.role"
];

// ─────────────────────────────────────────────────────────────────────────────
// Numeric bounds
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Design tokens are stored as numbers and given their unit by the serializer,
 * so a token can never carry a CSS payload. These bounds keep a valid spec
 * inside the range the renderer and the responsive fixtures actually cover.
 */
export const TOKEN_BOUNDS = {
  radius: { min: 0, max: 40 },
  radiusLg: { min: 0, max: 48 },
  sectionPad: { min: 24, max: 120 },
  sectionPadX: { min: 12, max: 96 },
  gap: { min: 8, max: 64 },
  colGap: { min: 12, max: 120 },
  rule: { min: 0, max: 4 },
  measure: { min: 32, max: 78 },
  tracking: { min: -0.08, max: 0.08 },
  displayWeight: { min: 300, max: 900 },
  heroWeight: { min: 300, max: 900 },
  heroHeight: { min: 320, max: 820 },
  heroMobileHeight: { min: 280, max: 720 },
  heroMeasure: { min: 280, max: 1000 }
} as const;

export const MAX_SECTIONS = 14;
export const MAX_GALLERY_ITEMS = 12;
export const MAX_REVIEWS = 12;
export const MAX_ENQUIRY_FIELDS = 8;
export const MAX_SOCIAL_LINKS = 6;
export const MAX_NAV_ITEMS = 4;

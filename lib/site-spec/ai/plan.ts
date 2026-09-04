/**
 * The Site Plan — what the model is actually allowed to return.
 *
 * The model does not write a Site Spec. It writes a *plan*: design decisions and
 * copy. Everything structural — art sequences, call-to-action wiring, content
 * bindings, gallery tile counts, derived geometry — is assembled from the plan
 * by deterministic code below.
 *
 * That split matters for three reasons:
 *
 *  · **It is the difference between a design decision and a document.** The model
 *    is good at "this should feel dark and confident, headline reads like this".
 *    It is bad at emitting twenty-four gradient stops consistently, and there is
 *    no reason to let it try.
 *  · **Whole classes of failure become impossible.** There is no field here for a
 *    URL, an image address, a price, a duration, an opening time or a CSS value,
 *    so no amount of model creativity can produce one.
 *  · **It fits schema-constrained decoding.** The plan is flat, closed and fully
 *    required — the shape strict structured output actually supports. The rich
 *    Site Spec schema, with its refinements and unions, is not.
 */
import { z } from "zod";

import {
  ART_TREATMENTS,
  CTA_SHAPES,
  DENSITIES,
  EYEBROW_STYLES,
  FONT_STACK_IDS,
  FOOTER_PRESENTATIONS,
  GALLERY_TILE_COUNT,
  HERO_VARIANTS,
  NAV_POSITIONS,
  NAV_SHAPES,
  SECTION_LAYOUTS,
  TOKEN_BOUNDS,
  type GalleryPresentation
} from "@/lib/site-spec/vocabulary";
import { deriveArtDirection } from "@/lib/site-spec/art-derive";
import { validateSiteSpec, type Section, type SiteSpec } from "@/lib/site-spec/schema";
import type { GenerationBrief } from "@/lib/site-spec/brief";

// ─────────────────────────────────────────────────────────────────────────────
// The plan
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Section types the model may compose with. `hero` is absent because the hero is
 * described separately and always present; `enquiry` and `booking` are here but
 * the assembler only keeps whichever one the business can actually honour.
 */
export const PLANNABLE_SECTION_TYPES = [
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

const nullableText = z.string().nullable();

/**
 * Every field is required and nullable rather than optional: that is the shape
 * strict schema-constrained decoding supports, and it removes "the model just
 * didn't emit that key" as a failure mode.
 */
export const SitePlanSchema = z.object({
  brandMark: z.string().describe("One or two letters for the brand mark, e.g. 'PF'."),
  seoTitle: z.string().describe("Under 70 characters."),
  seoDescription: z.string().describe("Under 180 characters."),

  design: z.object({
    background: z.string().describe("Page background as #rrggbb."),
    ink: z.string().describe("Body text colour as #rrggbb. Must be readable on the background."),
    muted: z.string().describe("Secondary text colour as #rrggbb."),
    accent: z.string().describe("Accent colour as #rrggbb."),
    accentInk: z.string().describe("Text drawn ON the accent as #rrggbb. Must be readable on it."),
    line: z.string().describe("Hairline/border colour as #rrggbb."),
    soft: z.string().describe("Subtle surface colour as #rrggbb."),
    panel: z.string().describe("Panel surface colour as #rrggbb."),

    treatment: z.enum(ART_TREATMENTS),
    density: z.enum(DENSITIES),
    nav: z.enum(NAV_SHAPES),
    navPosition: z.enum(NAV_POSITIONS),
    ctaShape: z.enum(CTA_SHAPES),
    eyebrow: z.enum(EYEBROW_STYLES),

    bodyFont: z.enum(FONT_STACK_IDS),
    displayFont: z.enum(FONT_STACK_IDS),
    displayWeight: z.number().describe("300–900."),
    heroWeight: z.number().describe("300–900."),
    tracking: z.number().describe("Letter spacing in em, between -0.06 and 0.02."),
    measure: z.number().describe("Body line length in characters, 40–60."),

    radius: z.number().describe("Corner rounding in px, 0–24."),
    sectionPad: z.number().describe("Vertical section padding in px, 40–90."),
    gap: z.number().describe("Small gap in px, 16–40."),
    colGap: z.number().describe("Column gap in px, 24–80."),
    heroHeight: z.number().describe("Hero height in px, 420–700.")
  }),

  terminology: z.object({
    primaryAction: z.string(),
    services: z.string(),
    team: z.string(),
    gallery: z.string(),
    hours: z.string(),
    story: z.string(),
    reviews: z.string(),
    contact: z.string()
  }),

  hero: z.object({
    variant: z.enum(HERO_VARIANTS),
    eyebrow: nullableText,
    headline: z.string().describe("May contain one newline for a deliberate line break."),
    body: nullableText,
    primaryCtaLabel: z.string(),
    secondaryCtaLabel: nullableText,
    accentRule: z.boolean(),
    bandCaption: nullableText.describe("Only used by the editorial hero.")
  }),

  sections: z.array(
    z.object({
      type: z.enum(PLANNABLE_SECTION_TYPES),
      id: z.string().describe("Lowercase kebab-case, unique, e.g. 'services'."),
      layout: z.enum(SECTION_LAYOUTS),
      presentation: z.string().describe("A presentation supported by this section type."),
      eyebrow: nullableText,
      title: nullableText,
      sub: nullableText,
      ctaLabel: nullableText,
      storyBody: nullableText,
      storyQuote: nullableText,
      storyAttribution: nullableText,
      hoursNote: nullableText,
      stripHeadline: nullableText,
      stripSub: nullableText,
      galleryCaptions: z.array(z.string())
    })
  ),

  footerPresentation: z.enum(FOOTER_PRESENTATIONS),
  footerCtaHeadline: nullableText,
  navItems: z.array(z.string()).describe("Up to four section ids, in order.")
});

export type SitePlan = z.infer<typeof SitePlanSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Assembly
// ─────────────────────────────────────────────────────────────────────────────

const clampTo = (key: keyof typeof TOKEN_BOUNDS, value: number, fallback: number): number => {
  const bounds = TOKEN_BOUNDS[key];
  if (!Number.isFinite(value)) return fallback;
  return Math.min(bounds.max, Math.max(bounds.min, value));
};

const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const colour = (value: string, fallback: string): string =>
  HEX.test((value ?? "").trim()) ? value.trim() : fallback;

const slug = (value: string, fallback: string): string => {
  const cleaned = (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return /^[a-z][a-z0-9-]*$/.test(cleaned) ? cleaned.slice(0, 48) : fallback;
};

const text = (value: string | null | undefined, max: number): string | undefined => {
  const trimmed = (value ?? "").trim();
  if (!trimmed) return undefined;
  return trimmed.slice(0, max);
};

/** Presentations each section type accepts, with the fallback used on a bad value. */
const PRESENTATIONS: Record<string, { allowed: readonly string[]; fallback: string }> = {
  services: { allowed: ["rows", "cards", "editorial", "packages"], fallback: "rows" },
  gallery: { allowed: ["mosaic", "portfolio", "filmstrip", "duo"], fallback: "mosaic" },
  story: { allowed: ["pullquote", "column"], fallback: "column" },
  team: { allowed: ["overlay", "editorial", "plain"], fallback: "overlay" },
  hours: { allowed: ["strip", "card", "cols"], fallback: "card" },
  booking: { allowed: ["panel", "plain", "invert"], fallback: "panel" },
  enquiry: { allowed: ["panel", "plain", "invert"], fallback: "panel" },
  reviews: { allowed: ["list", "empty"], fallback: "empty" },
  contact: { allowed: ["panel", "center", "stack", "split"], fallback: "split" }
};

/** Only `contact` is proven edge-to-edge at every fixture width. */
const FLUSH_SAFE = new Set(["contact"]);


/**
 * A palette has to be coherent, not merely well-formed.
 *
 * Falling back one colour at a time can pair a defaulted white background with a
 * near-white ink the model did supply — well-formed, and unreadable. So the four
 * structural colours stand or fall together, and the four supporting ones are
 * derived from them when unusable rather than defaulted independently.
 */
const SAFE_PALETTE = {
  background: "#FFFFFF",
  ink: "#141414",
  accent: "#1F1F1F",
  accentInk: "#FFFFFF"
} as const;

const isHex = (value: string) => HEX.test((value ?? "").trim());

const resolvePalette = (design: SitePlan["design"]) => {
  const structural = [design.background, design.ink, design.accent, design.accentInk];
  const structuralOk = structural.every(isHex);

  const background = structuralOk ? design.background.trim() : SAFE_PALETTE.background;
  const ink = structuralOk ? design.ink.trim() : SAFE_PALETTE.ink;
  const accent = structuralOk ? design.accent.trim() : SAFE_PALETTE.accent;
  const accentInk = structuralOk ? design.accentInk.trim() : SAFE_PALETTE.accentInk;

  // Supporting colours sit between the ink and the ground, so they can always be
  // derived from a coherent pair.
  return {
    background,
    ink,
    accent,
    accentInk,
    muted: colour(design.muted, blend(ink, background, 0.45)),
    line: colour(design.line, blend(ink, background, 0.88)),
    soft: colour(design.soft, blend(background, ink, 0.05)),
    panel: colour(design.panel, blend(background, ink, 0.09))
  };
};

/** Mix two hex colours. Used only for derived palette entries. */
const blend = (from: string, to: string, t: number): string => {
  const parse = (hex: string): [number, number, number] => {
    const raw = hex.replace("#", "");
    const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw.slice(0, 6);
    return [
      parseInt(full.slice(0, 2), 16),
      parseInt(full.slice(2, 4), 16),
      parseInt(full.slice(4, 6), 16)
    ];
  };
  const a = parse(from);
  const b = parse(to);
  return (
    "#" +
    a
      .map((channel, index) =>
        Math.round(channel + (b[index] - channel) * t)
          .toString(16)
          .padStart(2, "0")
      )
      .join("")
      .toUpperCase()
  );
};

export type AssembleInput = {
  plan: SitePlan;
  brief: GenerationBrief;
  /** Passed in rather than read from the clock, so assembly stays deterministic. */
  now: string;
};

export type AssembleResult =
  | { ok: true; spec: SiteSpec }
  | { ok: false; issues: Array<{ path: string; message: string }> };

/**
 * Turn a plan into a validated Site Spec.
 *
 * Deterministic and total: obvious out-of-range values are clamped rather than
 * bounced back to the model, because "the radius was 400" is not a decision
 * worth a round trip. Anything still incoherent after assembly is returned as
 * validation issues for a bounded repair attempt.
 */
export const assembleSpecFromPlan = ({ plan, brief, now }: AssembleInput): AssembleResult => {
  const palette = resolvePalette(plan.design);

  const radius = clampTo("radius", plan.design.radius, 8);
  const sectionPad = clampTo("sectionPad", plan.design.sectionPad, 56);

  // Only the business's real capability decides which action is honest, never
  // the model: a "Book" button with no booking engine behind it is a lie.
  const canBook = brief.shape.bookingAvailable;

  const planned = plan.sections.filter((section) => {
    if (section.type === "booking" && !canBook) return false;
    if (section.type === "bookingStrip" && !canBook) return false;
    // Sections whose content the business does not have are dropped here rather
    // than rendering as an empty heading.
    if (section.type === "services" && brief.shape.serviceCount === 0) return false;
    if (section.type === "team" && brief.shape.teamCount === 0) return false;
    if (section.type === "hours" && !brief.shape.hasHours) return false;
    if (section.type === "contact" && !brief.shape.hasLocation) return false;
    return true;
  });

  // Exactly one of booking / enquiry survives, and there is always one route to
  // get in touch.
  const deduped: typeof planned = [];
  const seenTypes = new Set<string>();
  const singletons = new Set(["bookingStrip", "hours", "contact", "booking", "enquiry"]);
  for (const section of planned) {
    if (singletons.has(section.type) && seenTypes.has(section.type)) continue;
    if (section.type === "booking" && seenTypes.has("enquiry")) continue;
    if (section.type === "enquiry" && seenTypes.has("booking")) continue;
    seenTypes.add(section.type);
    deduped.push(section);
  }
  if (!seenTypes.has("booking") && !seenTypes.has("enquiry")) {
    deduped.push({
      type: canBook ? "booking" : "enquiry",
      id: canBook ? "booking" : "enquiry",
      layout: "wide",
      presentation: "panel",
      eyebrow: null,
      title: canBook ? "Book an appointment" : "Get in touch",
      sub: null,
      ctaLabel: plan.hero.primaryCtaLabel,
      storyBody: null,
      storyQuote: null,
      storyAttribution: null,
      hoursNote: null,
      stripHeadline: null,
      stripSub: null,
      galleryCaptions: []
    });
    seenTypes.add(canBook ? "booking" : "enquiry");
  }

  const usedIds = new Set<string>(["hero"]);
  const sections: Section[] = [];

  // ── hero ────────────────────────────────────────────────────────────────
  const actionTarget = seenTypes.has("booking")
    ? ({ kind: "booking" } as const)
    : ({ kind: "enquiry" } as const);

  const heroSection = {
    id: "hero",
    type: "hero" as const,
    heading: {},
    variant: plan.hero.variant,
    eyebrow: text(plan.hero.eyebrow, 120),
    headline: text(plan.hero.headline, 180) ?? brief.brandName,
    body: text(plan.hero.body, 1200),
    primaryCta: {
      label: text(plan.hero.primaryCtaLabel, 120) ?? plan.terminology.primaryAction ?? "Get in touch",
      target: actionTarget
    },
    secondaryCta: undefined as undefined | { label: string; target: { kind: "section"; sectionId: string } },
    media: { kind: "generated" as const, seed: 0 },
    accentRule: Boolean(plan.hero.accentRule),
    bandCaption: plan.hero.variant === "editorial" ? text(plan.hero.bandCaption, 120) : undefined
  };

  // ── the rest ────────────────────────────────────────────────────────────
  for (const planned of deduped) {
    const id = (() => {
      const candidate = slug(planned.id, planned.type.toLowerCase());
      if (!usedIds.has(candidate)) return candidate;
      let n = 2;
      while (usedIds.has(`${candidate}-${n}`)) n += 1;
      return `${candidate}-${n}`;
    })();
    usedIds.add(id);

    const rules = PRESENTATIONS[planned.type];
    const presentation = rules
      ? rules.allowed.includes(planned.presentation)
        ? planned.presentation
        : rules.fallback
      : undefined;

    const layout =
      planned.layout === "flush" && !FLUSH_SAFE.has(planned.type) ? "stack" : planned.layout;

    const heading = {
      eyebrow: text(planned.eyebrow, 120),
      title: text(planned.title, 180),
      sub: text(planned.sub, 1200)
    };

    switch (planned.type) {
      case "bookingStrip":
        sections.push({
          id,
          type: "bookingStrip",
          heading,
          headline: text(planned.stripHeadline, 120) ?? text(planned.title, 120) ?? "Book in under a minute",
          sub: text(planned.stripSub, 120),
          cta: { label: text(planned.ctaLabel, 120) ?? plan.terminology.primaryAction, target: actionTarget }
        } as Section);
        break;

      case "services":
        sections.push({
          id,
          type: "services",
          layout,
          heading,
          presentation: presentation as never,
          selection: { mode: "all" },
          showPrices: true,
          showDurations: true,
          showDescriptions: presentation !== "rows",
          withImages: presentation === "cards" && brief.shape.ownedImageCount > 0
        } as Section);
        break;

      case "gallery": {
        const tiles = GALLERY_TILE_COUNT[presentation as GalleryPresentation] ?? 6;
        const captions = planned.galleryCaptions
          .map((caption) => text(caption, 120) ?? "")
          .slice(0, tiles);
        sections.push({
          id,
          type: "gallery",
          layout,
          heading,
          presentation: presentation as never,
          // Generated art by default; real assets are bound afterwards.
          items: Array.from({ length: tiles }, (_, index) => ({
            kind: "generated" as const,
            seed: index + 1
          })),
          captions: captions.length === tiles && captions.every(Boolean) ? captions : [],
          framing: {}
        } as Section);
        break;
      }

      case "story":
        sections.push({
          id,
          type: "story",
          layout,
          heading,
          presentation: presentation as never,
          body: text(planned.storyBody, 1200),
          quote: text(planned.storyQuote, 400),
          attribution: text(planned.storyAttribution, 120),
          stats: []
        } as Section);
        break;

      case "team":
        sections.push({
          id,
          type: "team",
          layout,
          heading,
          presentation: presentation as never,
          selection: { mode: "all" },
          showRoles: true,
          portraits: {},
          ratio: "3/4"
        } as Section);
        break;

      case "hours":
        sections.push({
          id,
          type: "hours",
          layout,
          heading,
          presentation: presentation as never,
          note: text(planned.hoursNote, 120),
          noteStyle: "info",
          showExceptions: true
        } as Section);
        break;

      case "booking":
        sections.push({
          id,
          type: "booking",
          layout,
          heading,
          presentation: presentation as never,
          cta: { label: text(planned.ctaLabel, 120) ?? plan.terminology.primaryAction, target: { kind: "booking" } }
        } as Section);
        break;

      case "enquiry":
        sections.push({
          id,
          type: "enquiry",
          layout,
          heading,
          presentation: presentation as never,
          fields: [
            { name: "name", label: "Your name", required: true },
            { name: "email", label: "Email", required: true },
            { name: "message", label: "What can we help with?", required: true }
          ],
          cta: { label: text(planned.ctaLabel, 120) ?? "Send enquiry", target: { kind: "enquiry" } }
        } as Section);
        break;

      case "reviews":
        // Never a populated list from generation: Stage 1's honest empty state
        // stands until real reviews are connected.
        sections.push({
          id,
          type: "reviews",
          layout,
          heading,
          presentation: "empty",
          items: []
        } as Section);
        break;

      case "contact":
        sections.push({
          id,
          type: "contact",
          layout,
          heading,
          presentation: presentation as never,
          showMap: true,
          showSocials: true,
          cta: { label: "Get directions", target: { kind: "directions" } }
        } as Section);
        break;

      default:
        break;
    }
  }

  // The hero's secondary action points at whatever the page actually shows.
  const secondaryTarget = sections.find((section) =>
    ["gallery", "services", "story"].includes(section.type)
  );
  if (secondaryTarget && plan.hero.secondaryCtaLabel) {
    heroSection.secondaryCta = {
      label: text(plan.hero.secondaryCtaLabel, 120)!,
      target: { kind: "section", sectionId: secondaryTarget.id }
    };
  }

  const navigable = new Set(
    sections
      .filter((section) => section.type !== "bookingStrip")
      .map((section) => section.id)
  );
  const navItems = plan.navItems
    .map((item) => slug(item, ""))
    .filter((item) => navigable.has(item))
    .slice(0, 4);

  const spec = {
    kind: "site_spec" as const,
    version: 1 as const,
    meta: {
      businessId: brief.businessId,
      brandName: brief.brandName,
      brandMark: (plan.brandMark ?? "").trim().slice(0, 3) || undefined,
      locale: brief.locale,
      seo: {
        title: text(plan.seoTitle, 70) ?? brief.brandName,
        description: text(plan.seoDescription, 180) ?? `${brief.brandName}.`
      },
      generatedAt: now,
      updatedAt: now
    },
    design: {
      density: plan.design.density,
      palette,
      geometry: {
        radius,
        radiusLg: clampTo("radiusLg", radius * 1.35, 12),
        sectionPad,
        sectionPadX: clampTo("sectionPadX", sectionPad * 0.68, 36),
        gap: clampTo("gap", plan.design.gap, 26),
        colGap: clampTo("colGap", plan.design.colGap, 52),
        rule: 1
      },
      typography: {
        body: plan.design.bodyFont,
        display: plan.design.displayFont,
        displayWeight: clampTo("displayWeight", plan.design.displayWeight, 600),
        heroWeight: clampTo("heroWeight", plan.design.heroWeight, 640),
        tracking: clampTo("tracking", plan.design.tracking, -0.03),
        measure: clampTo("measure", plan.design.measure, 50)
      },
      hero: {
        height: clampTo("heroHeight", plan.design.heroHeight, 560),
        mobileHeight: clampTo("heroMobileHeight", plan.design.heroHeight * 0.86, 480),
        measure: clampTo("heroMeasure", plan.design.heroHeight * 1.1, 620)
      },
      chrome: {
        nav: plan.design.nav,
        navPosition: plan.design.navPosition,
        cta: plan.design.ctaShape,
        eyebrow: plan.design.eyebrow
      },
      art: deriveArtDirection(palette, plan.design.treatment)
    },
    terminology: {
      primaryAction: text(plan.terminology.primaryAction, 120) ?? (canBook ? "Book" : "Enquire"),
      services: text(plan.terminology.services, 120) ?? "Services",
      team: text(plan.terminology.team, 120) ?? "Team",
      gallery: text(plan.terminology.gallery, 120) ?? "Work",
      hours: text(plan.terminology.hours, 120) ?? "Hours",
      story: text(plan.terminology.story, 120) ?? "About",
      reviews: text(plan.terminology.reviews, 120) ?? "Reviews",
      contact: text(plan.terminology.contact, 120) ?? "Visit"
    },
    nav: {
      items: navItems,
      cta: { label: text(plan.terminology.primaryAction, 120) ?? "Get in touch", target: actionTarget }
    },
    sections: [heroSection as Section, ...sections],
    footer: {
      presentation: plan.footerPresentation,
      ctaHeadline: text(plan.footerCtaHeadline, 120)
    },
    socials: []
  };

  const validated = validateSiteSpec(spec);
  if (!validated.ok) return { ok: false, issues: validated.issues };
  return { ok: true, spec: validated.spec };
};

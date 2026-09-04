/**
 * Structured edit operations — the only way a Site Spec ever changes.
 *
 * The audit's root cause #3 was that an AI edit regenerated the whole document.
 * Stage 2 replaces that with a narrow, typed, auditable operation list:
 *
 *   user message → SiteSpecOp[] → authorize → applyOps → validate → new version
 *
 * Three properties this file exists to guarantee:
 *
 *  1. **Constrained targets.** There is no JSON-Patch path, no field name and no
 *     selector supplied by a model. Every operation names its target through a
 *     closed union, so "what can this edit possibly touch?" is answerable by
 *     reading the type rather than by trusting the caller.
 *  2. **Purity.** `applyOps` is a pure function of (spec, ops). No clock, no
 *     randomness, no I/O. The same spec and the same ops always produce the same
 *     result, which is what makes an edit reviewable and Undo trustworthy.
 *  3. **Atomicity.** A batch either yields one valid spec or fails whole. There
 *     is no path that persists a half-applied edit.
 *
 * What operations deliberately CANNOT do: write a price, a duration, an opening
 * time, a team member, an address, a URL, CSS, HTML or script. Operational truth
 * belongs to Business (see `authorize.ts`); presentation belongs here.
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
  MAX_NAV_ITEMS,
  NAV_POSITIONS,
  NAV_SHAPES,
  SECTION_LAYOUTS
} from "@/lib/site-spec/vocabulary";
import {
  ColorSchema,
  SectionIdSchema,
  SectionSchema,
  ShortTextSchema,
  validateSiteSpec,
  type Section,
  type SiteSpec
} from "@/lib/site-spec/schema";

// ─────────────────────────────────────────────────────────────────────────────
// Copy targets
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Every place on a site whose words can be edited. A model picks one of these;
 * it never supplies a path. Anything not listed here is not editable copy —
 * which is how prices, hours and team names stay out of reach by construction.
 */
export const CopyTargetSchema = z.discriminatedUnion("field", [
  z.object({ field: z.literal("hero.eyebrow") }),
  z.object({ field: z.literal("hero.headline") }),
  z.object({ field: z.literal("hero.body") }),
  z.object({ field: z.literal("hero.primaryCta") }),
  z.object({ field: z.literal("hero.secondaryCta") }),
  z.object({ field: z.literal("hero.bandCaption") }),
  z.object({ field: z.literal("section.eyebrow"), sectionId: SectionIdSchema }),
  z.object({ field: z.literal("section.title"), sectionId: SectionIdSchema }),
  z.object({ field: z.literal("section.sub"), sectionId: SectionIdSchema }),
  z.object({ field: z.literal("section.cta"), sectionId: SectionIdSchema }),
  z.object({ field: z.literal("story.body"), sectionId: SectionIdSchema }),
  z.object({ field: z.literal("story.quote"), sectionId: SectionIdSchema }),
  z.object({ field: z.literal("story.attribution"), sectionId: SectionIdSchema }),
  z.object({ field: z.literal("hours.note"), sectionId: SectionIdSchema }),
  z.object({ field: z.literal("bookingStrip.headline"), sectionId: SectionIdSchema }),
  z.object({ field: z.literal("bookingStrip.sub"), sectionId: SectionIdSchema }),
  z.object({ field: z.literal("gallery.caption"), sectionId: SectionIdSchema, index: z.number().int().min(0).max(11) }),
  z.object({ field: z.literal("footer.ctaHeadline") }),
  z.object({ field: z.literal("nav.cta") }),
  z.object({ field: z.literal("seo.title") }),
  z.object({ field: z.literal("seo.description") })
]);
export type CopyTarget = z.infer<typeof CopyTargetSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Design tokens
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The bounded design tokens an edit may move. Values are re-checked by the
 * Stage 1 validator after the batch applies, so a token can only ever land
 * inside the range the renderer and the responsive fixtures cover.
 */
export const TOKEN_PATHS = [
  "density",
  "chrome.nav",
  "chrome.navPosition",
  "chrome.cta",
  "chrome.eyebrow",
  "art.treatment",
  "palette.background",
  "palette.ink",
  "palette.muted",
  "palette.accent",
  "palette.accentInk",
  "palette.line",
  "palette.soft",
  "palette.panel",
  "geometry.radius",
  "geometry.radiusLg",
  "geometry.sectionPad",
  "geometry.sectionPadX",
  "geometry.gap",
  "geometry.colGap",
  "geometry.rule",
  "typography.body",
  "typography.display",
  "typography.displayWeight",
  "typography.heroWeight",
  "typography.tracking",
  "typography.measure",
  "hero.height",
  "hero.mobileHeight",
  "hero.measure"
] as const;
export type TokenPath = (typeof TOKEN_PATHS)[number];

/** Which token paths take which kind of value. Wrong shape is rejected here. */
const TOKEN_VALUE: Record<TokenPath, z.ZodTypeAny> = {
  density: z.enum(DENSITIES),
  "chrome.nav": z.enum(NAV_SHAPES),
  "chrome.navPosition": z.enum(NAV_POSITIONS),
  "chrome.cta": z.enum(CTA_SHAPES),
  "chrome.eyebrow": z.enum(EYEBROW_STYLES),
  "art.treatment": z.enum(ART_TREATMENTS),
  "palette.background": ColorSchema,
  "palette.ink": ColorSchema,
  "palette.muted": ColorSchema,
  "palette.accent": ColorSchema,
  "palette.accentInk": ColorSchema,
  "palette.line": ColorSchema,
  "palette.soft": ColorSchema,
  "palette.panel": ColorSchema,
  "geometry.radius": z.number(),
  "geometry.radiusLg": z.number(),
  "geometry.sectionPad": z.number(),
  "geometry.sectionPadX": z.number(),
  "geometry.gap": z.number(),
  "geometry.colGap": z.number(),
  "geometry.rule": z.number(),
  "typography.body": z.enum(FONT_STACK_IDS),
  "typography.display": z.enum(FONT_STACK_IDS),
  "typography.displayWeight": z.number(),
  "typography.heroWeight": z.number(),
  "typography.tracking": z.number(),
  "typography.measure": z.number(),
  "hero.height": z.number(),
  "hero.mobileHeight": z.number(),
  "hero.measure": z.number()
};

// ─────────────────────────────────────────────────────────────────────────────
// Operations
// ─────────────────────────────────────────────────────────────────────────────

/** Presentation enums are per section type; the applier checks the pairing. */
export const PresentationValueSchema = z.string().trim().min(1).max(24);

export const SiteSpecOpSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("set_copy"),
    target: CopyTargetSchema,
    /** Empty string clears an optional field. */
    value: z.string().max(1200)
  }),
  z.object({
    op: z.literal("set_token"),
    path: z.enum(TOKEN_PATHS),
    value: z.union([z.number(), z.string()])
  }),
  z.object({
    op: z.literal("set_layout"),
    sectionId: SectionIdSchema,
    layout: z.enum(SECTION_LAYOUTS)
  }),
  z.object({
    op: z.literal("set_presentation"),
    sectionId: SectionIdSchema,
    presentation: PresentationValueSchema
  }),
  z.object({
    op: z.literal("reorder_sections"),
    /** The complete new order. A partial list is rejected — no silent drops. */
    order: z.array(SectionIdSchema).min(1).max(14)
  }),
  z.object({
    op: z.literal("add_section"),
    section: SectionSchema,
    /** Where to insert. Omitted means "at the end". */
    index: z.number().int().min(0).max(14).optional()
  }),
  z.object({
    op: z.literal("remove_section"),
    sectionId: SectionIdSchema
  }),
  z.object({
    op: z.literal("bind_asset"),
    slot: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("hero") }),
      z.object({ kind: z.literal("gallery"), index: z.number().int().min(0).max(11) }),
      z.object({ kind: z.literal("team"), memberId: z.string().uuid() })
    ]),
    /** A row in `builder_site_assets`. Never a URL. */
    assetId: z.string().uuid(),
    alt: ShortTextSchema.pipe(z.string().min(1)),
    /** Which generated image to fall back to if the asset ever disappears. */
    fallbackSeed: z.number().int().min(0).max(64).default(0)
  }),
  z.object({
    op: z.literal("unbind_asset"),
    slot: z.discriminatedUnion("kind", [
      z.object({ kind: z.literal("hero") }),
      z.object({ kind: z.literal("gallery"), index: z.number().int().min(0).max(11) }),
      z.object({ kind: z.literal("team"), memberId: z.string().uuid() })
    ]),
    seed: z.number().int().min(0).max(64).default(0)
  }),
  z.object({
    op: z.literal("set_terminology"),
    key: z.enum([
      "primaryAction",
      "services",
      "team",
      "gallery",
      "hours",
      "story",
      "reviews",
      "contact"
    ]),
    value: ShortTextSchema.pipe(z.string().min(1))
  }),
  z.object({
    op: z.literal("set_nav"),
    items: z.array(SectionIdSchema).max(MAX_NAV_ITEMS)
  }),
  z.object({
    op: z.literal("set_footer"),
    presentation: z.enum(FOOTER_PRESENTATIONS)
  })
]);

export type SiteSpecOp = z.infer<typeof SiteSpecOpSchema>;
export type SiteSpecOpOfType<T extends SiteSpecOp["op"]> = Extract<SiteSpecOp, { op: T }>;

export const SiteSpecOpListSchema = z.array(SiteSpecOpSchema).min(1).max(24);

// ─────────────────────────────────────────────────────────────────────────────
// Application
// ─────────────────────────────────────────────────────────────────────────────

export type ApplyResult =
  | { ok: true; spec: SiteSpec }
  | { ok: false; reason: "invalid_op"; issues: Array<{ path: string; message: string }> }
  /**
   * `message` is a DIAGNOSTIC — it names the field and quotes the value, which
   * makes it useful in a log and in a repair prompt, and useless (or alarming)
   * to an owner. `op` is carried alongside it so the owner-facing sentence can
   * be composed from what was being attempted rather than from this string.
   */
  | { ok: false; reason: "unapplicable"; opIndex: number; message: string; op: SiteSpecOp }
  | { ok: false; reason: "invalid_result"; issues: Array<{ path: string; message: string }> };

/** Which presentation values each section type accepts. */
const PRESENTATIONS_BY_TYPE: Partial<Record<Section["type"], readonly string[]>> = {
  services: ["rows", "cards", "editorial", "packages"],
  gallery: ["mosaic", "portfolio", "filmstrip", "duo"],
  story: ["pullquote", "column"],
  team: ["overlay", "editorial", "plain"],
  hours: ["strip", "card", "cols"],
  booking: ["panel", "plain", "invert"],
  enquiry: ["panel", "plain", "invert"],
  reviews: ["list", "empty"],
  contact: ["panel", "center", "stack", "split"]
};

/** Section types a site cannot lose. */
const REQUIRED_SECTION_TYPES = new Set<Section["type"]>(["hero"]);

const clone = (spec: SiteSpec): SiteSpec => JSON.parse(JSON.stringify(spec)) as SiteSpec;

const findSection = (spec: SiteSpec, id: string): Section | undefined =>
  spec.sections.find((section) => section.id === id);

const setPath = (target: Record<string, any>, path: string, value: unknown) => {
  const parts = path.split(".");
  let node = target;
  for (const part of parts.slice(0, -1)) node = node[part];
  node[parts[parts.length - 1]] = value;
};

/**
 * Apply a batch of operations to a spec.
 *
 * Pure and deterministic. The result is re-validated through the Stage 1
 * validator before it is returned, so a caller can never be handed — and can
 * never persist — a spec that the renderer would not accept.
 */
export const applyOps = (spec: SiteSpec, ops: unknown): ApplyResult => {
  const parsedOps = SiteSpecOpListSchema.safeParse(ops);
  if (!parsedOps.success) {
    return {
      ok: false,
      reason: "invalid_op",
      issues: parsedOps.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message
      }))
    };
  }

  // Work on a copy: on any failure the caller's spec is untouched.
  const draft = clone(spec);

  for (const [index, op] of parsedOps.data.entries()) {
    const failure = applyOne(draft, op);
    if (failure) return { ok: false, reason: "unapplicable", opIndex: index, message: failure, op };
  }

  const validated = validateSiteSpec(draft);
  if (!validated.ok) return { ok: false, reason: "invalid_result", issues: validated.issues };
  return { ok: true, spec: validated.spec };
};

/** Returns null on success, or a human-readable reason the op cannot apply. */
const applyOne = (spec: SiteSpec, op: SiteSpecOp): string | null => {
  switch (op.op) {
    // ── copy ──────────────────────────────────────────────────────────────
    case "set_copy": {
      const value = op.value.trim();
      const target = op.target;

      if (target.field.startsWith("hero.")) {
        const hero = spec.sections.find((section) => section.type === "hero");
        if (!hero || hero.type !== "hero") return "this site has no hero section";
        switch (target.field) {
          case "hero.eyebrow":
            hero.eyebrow = value || undefined;
            return null;
          case "hero.headline":
            if (!value) return "a hero headline cannot be empty";
            hero.headline = value;
            return null;
          case "hero.body":
            hero.body = value || undefined;
            return null;
          case "hero.bandCaption":
            hero.bandCaption = value || undefined;
            return null;
          case "hero.primaryCta":
            if (!value) return "the primary call to action needs a label";
            hero.primaryCta.label = value;
            return null;
          case "hero.secondaryCta":
            if (!hero.secondaryCta) return "this hero has no secondary call to action";
            hero.secondaryCta.label = value;
            return null;
          default:
            return `unsupported copy target ${target.field}`;
        }
      }

      if (target.field === "footer.ctaHeadline") {
        spec.footer.ctaHeadline = value || undefined;
        return null;
      }
      if (target.field === "nav.cta") {
        if (!value) return "the navigation button needs a label";
        spec.nav.cta.label = value;
        return null;
      }
      if (target.field === "seo.title") {
        if (!value) return "the page title cannot be empty";
        spec.meta.seo.title = value;
        return null;
      }
      if (target.field === "seo.description") {
        if (!value) return "the page description cannot be empty";
        spec.meta.seo.description = value;
        return null;
      }

      // Section-scoped copy.
      const section = findSection(spec, (target as { sectionId: string }).sectionId);
      if (!section) return `there is no section called "${(target as { sectionId: string }).sectionId}"`;

      switch (target.field) {
        case "section.eyebrow":
          section.heading.eyebrow = value || undefined;
          return null;
        case "section.title":
          section.heading.title = value || undefined;
          return null;
        case "section.sub":
          section.heading.sub = value || undefined;
          return null;
        case "section.cta":
          if (!("cta" in section) || !section.cta) return "that section has no call to action";
          if (!value) return "a call to action needs a label";
          section.cta.label = value;
          return null;
        case "story.body":
          if (section.type !== "story") return "that is not a story section";
          section.body = value || undefined;
          return null;
        case "story.quote":
          if (section.type !== "story") return "that is not a story section";
          section.quote = value || undefined;
          return null;
        case "story.attribution":
          if (section.type !== "story") return "that is not a story section";
          section.attribution = value || undefined;
          return null;
        case "hours.note":
          if (section.type !== "hours") return "that is not an opening-hours section";
          section.note = value || undefined;
          return null;
        case "bookingStrip.headline":
          if (section.type !== "bookingStrip") return "that is not a booking strip";
          if (!value) return "the booking strip needs a headline";
          section.headline = value;
          return null;
        case "bookingStrip.sub":
          if (section.type !== "bookingStrip") return "that is not a booking strip";
          section.sub = value || undefined;
          return null;
        case "gallery.caption": {
          if (section.type !== "gallery") return "that is not a gallery";
          const index = (target as { index: number }).index;
          if (index >= section.items.length) return "there is no image at that position";
          const captions = section.captions.length
            ? [...section.captions]
            : section.items.map(() => "");
          captions[index] = value;
          section.captions = captions.every((caption) => !caption) ? [] : captions;
          return null;
        }
        default:
          return `unsupported copy target ${(target as { field: string }).field}`;
      }
    }

    // ── design tokens ─────────────────────────────────────────────────────
    case "set_token": {
      const valueSchema = TOKEN_VALUE[op.path];
      const parsed = valueSchema.safeParse(op.value);
      if (!parsed.success) {
        return `"${String(op.value)}" is not a usable value for ${op.path}`;
      }
      setPath(spec.design as unknown as Record<string, any>, op.path, parsed.data);
      return null;
    }

    // ── composition ───────────────────────────────────────────────────────
    case "set_layout": {
      const section = findSection(spec, op.sectionId);
      if (!section) return `there is no section called "${op.sectionId}"`;
      if (!("layout" in section)) return "that section's composition is fixed";
      section.layout = op.layout;
      return null;
    }

    case "set_presentation": {
      const section = findSection(spec, op.sectionId);
      if (!section) return `there is no section called "${op.sectionId}"`;
      if (section.type === "hero") {
        // The hero's composition is its variant, not a presentation.
        const variants = ["full", "split", "editorial"];
        if (!variants.includes(op.presentation)) {
          return `a hero can be ${variants.join(", ")} — not "${op.presentation}"`;
        }
        section.variant = op.presentation as (typeof variants)[number] as typeof section.variant;
        return null;
      }
      const allowed = PRESENTATIONS_BY_TYPE[section.type];
      if (!allowed) return "that section has no presentation to change";
      if (!allowed.includes(op.presentation)) {
        return `a ${section.type} section can be ${allowed.join(", ")} — not "${op.presentation}"`;
      }
      (section as { presentation: string }).presentation = op.presentation;
      return null;
    }

    case "reorder_sections": {
      const current = spec.sections.map((section) => section.id);
      const requested = op.order;
      if (requested.length !== current.length) {
        return "a reorder has to list every section exactly once";
      }
      const missing = current.filter((id) => !requested.includes(id));
      if (missing.length) return `the new order is missing ${missing.join(", ")}`;
      if (new Set(requested).size !== requested.length) return "the new order repeats a section";

      const byId = new Map(spec.sections.map((section) => [section.id, section]));
      spec.sections = requested.map((id) => byId.get(id)!);
      return null;
    }

    case "add_section": {
      if (findSection(spec, op.section.id)) return `a section called "${op.section.id}" already exists`;
      const index = op.index ?? spec.sections.length;
      // The hero opens the page; nothing may be inserted before it.
      const insertAt = Math.max(1, Math.min(index, spec.sections.length));
      spec.sections.splice(insertAt, 0, op.section);
      return null;
    }

    case "remove_section": {
      const section = findSection(spec, op.sectionId);
      if (!section) return `there is no section called "${op.sectionId}"`;
      if (REQUIRED_SECTION_TYPES.has(section.type)) return "the hero cannot be removed";

      spec.sections = spec.sections.filter((candidate) => candidate.id !== op.sectionId);
      // Repair everything that pointed at it, rather than leaving a dangling
      // reference for the validator to reject.
      spec.nav.items = spec.nav.items.filter((id) => id !== op.sectionId);
      repairCtaTargets(spec, op.sectionId);
      return null;
    }

    // ── assets ────────────────────────────────────────────────────────────
    case "bind_asset": {
      const media = { kind: "asset" as const, assetId: op.assetId, alt: op.alt, fallbackSeed: op.fallbackSeed };
      if (op.slot.kind === "hero") {
        const hero = spec.sections.find((section) => section.type === "hero");
        if (!hero || hero.type !== "hero") return "this site has no hero section";
        hero.media = media;
        return null;
      }
      if (op.slot.kind === "gallery") {
        const gallery = spec.sections.find((section) => section.type === "gallery");
        if (!gallery || gallery.type !== "gallery") return "this site has no gallery";
        if (op.slot.index >= gallery.items.length) return "there is no image at that position";
        gallery.items[op.slot.index] = media;
        return null;
      }
      const team = spec.sections.find((section) => section.type === "team");
      if (!team || team.type !== "team") return "this site has no team section";
      team.portraits = { ...team.portraits, [op.slot.memberId]: media };
      return null;
    }

    case "unbind_asset": {
      const generated = { kind: "generated" as const, seed: op.seed };
      if (op.slot.kind === "hero") {
        const hero = spec.sections.find((section) => section.type === "hero");
        if (!hero || hero.type !== "hero") return "this site has no hero section";
        hero.media = generated;
        return null;
      }
      if (op.slot.kind === "gallery") {
        const gallery = spec.sections.find((section) => section.type === "gallery");
        if (!gallery || gallery.type !== "gallery") return "this site has no gallery";
        if (op.slot.index >= gallery.items.length) return "there is no image at that position";
        gallery.items[op.slot.index] = generated;
        return null;
      }
      const team = spec.sections.find((section) => section.type === "team");
      if (!team || team.type !== "team") return "this site has no team section";
      const { [op.slot.memberId]: _removed, ...rest } = team.portraits;
      team.portraits = rest;
      return null;
    }

    // ── vocabulary and chrome ─────────────────────────────────────────────
    case "set_terminology":
      spec.terminology[op.key] = op.value;
      return null;

    case "set_nav": {
      for (const id of op.items) {
        const section = findSection(spec, id);
        if (!section) return `there is no section called "${id}"`;
        if (section.type === "hero" || section.type === "bookingStrip") {
          return `"${id}" is not something the navigation can link to`;
        }
      }
      spec.nav.items = op.items;
      return null;
    }

    case "set_footer":
      spec.footer.presentation = op.presentation;
      return null;

    default:
      return "unsupported operation";
  }
};

/**
 * When a section is removed, anything that pointed at it has to be repaired or
 * the resulting spec would fail validation. Targets fall back to the contact
 * section, or to the site's primary action.
 */
const repairCtaTargets = (spec: SiteSpec, removedId: string) => {
  const fallback = spec.sections.find((section) => section.type === "contact");
  const retarget = (cta: { target: { kind: string; sectionId?: string } }) => {
    if (cta.target.kind !== "section" || cta.target.sectionId !== removedId) return;
    cta.target = fallback
      ? { kind: "section", sectionId: fallback.id }
      : { kind: "booking" };
  };

  retarget(spec.nav.cta as any);
  for (const section of spec.sections) {
    if ("primaryCta" in section && section.primaryCta) retarget(section.primaryCta as any);
    if ("secondaryCta" in section && section.secondaryCta) retarget(section.secondaryCta as any);
    if ("cta" in section && section.cta) retarget(section.cta as any);
  }

  // A removed enquiry/booking section leaves `kind: "enquiry"`/`"booking"`
  // targets pointing at nothing; the validator refuses those, so redirect them.
  const hasEnquiry = spec.sections.some((section) => section.type === "enquiry");
  if (!hasEnquiry) {
    const redirect = (cta: { target: { kind: string } }) => {
      if (cta.target.kind === "enquiry") {
        cta.target = fallback ? ({ kind: "section", sectionId: fallback.id } as any) : ({ kind: "booking" } as any);
      }
    };
    redirect(spec.nav.cta as any);
    for (const section of spec.sections) {
      if ("primaryCta" in section && section.primaryCta) redirect(section.primaryCta as any);
      if ("secondaryCta" in section && section.secondaryCta) redirect(section.secondaryCta as any);
      if ("cta" in section && section.cta) redirect(section.cta as any);
    }
  }
};

// ─────────────────────────────────────────────────────────────────────────────
// Human-readable labels
// ─────────────────────────────────────────────────────────────────────────────

/**
 * A short, deterministic description of what a batch did — "Made the hero
 * darker", "Moved Services above Gallery". Derived from the operations
 * themselves, never from model prose, so the label cannot drift from the change
 * it names. Used for the version label; the stored spec remains the truth.
 */
export const describeOps = (ops: SiteSpecOp[]): string => {
  if (!ops.length) return "No change";
  if (ops.length === 1) return describeOne(ops[0]);

  const kinds = new Set(ops.map((op) => op.op));
  if (kinds.size === 1) {
    const kind = ops[0].op;
    if (kind === "set_copy") return `Rewrote ${ops.length} pieces of copy`;
    if (kind === "set_token") return `Adjusted ${ops.length} style settings`;
    if (kind === "bind_asset") return `Set ${ops.length} images`;
  }
  return `${describeOne(ops[0])}, and ${ops.length - 1} more change${ops.length > 2 ? "s" : ""}`;
};

const TOKEN_LABELS: Partial<Record<TokenPath, string>> = {
  density: "spacing",
  "art.treatment": "photo style",
  "palette.background": "background colour",
  "palette.accent": "accent colour",
  "palette.ink": "text colour",
  "geometry.radius": "corner rounding",
  "typography.display": "heading font",
  "typography.body": "body font"
};

const describeOne = (op: SiteSpecOp): string => {
  switch (op.op) {
    case "set_copy":
      return `Rewrote the ${copyLabel(op.target)}`;
    case "set_token":
      return `Changed the ${TOKEN_LABELS[op.path] ?? op.path.split(".").pop()}`;
    case "set_layout":
      return `Changed the ${op.sectionId} layout`;
    case "set_presentation":
      return `Changed how ${op.sectionId} is presented`;
    case "reorder_sections":
      return "Reordered the page";
    case "add_section":
      return `Added a ${op.section.type} section`;
    case "remove_section":
      return `Removed the ${op.sectionId} section`;
    case "bind_asset":
      return op.slot.kind === "hero" ? "Changed the hero image" : "Changed an image";
    case "unbind_asset":
      return "Removed an image";
    case "set_terminology":
      return `Renamed "${op.key}" to "${op.value}"`;
    case "set_nav":
      return "Changed the navigation";
    case "set_footer":
      return "Changed the footer";
    default:
      return "Made a change";
  }
};

const copyLabel = (target: CopyTarget): string => {
  switch (target.field) {
    case "hero.headline":
      return "headline";
    case "hero.body":
      return "hero text";
    case "hero.eyebrow":
      return "hero label";
    case "hero.primaryCta":
    case "nav.cta":
    case "section.cta":
      return "button";
    case "seo.title":
      return "page title";
    case "seo.description":
      return "page description";
    case "section.title":
      return `${target.sectionId} heading`;
    case "section.sub":
      return `${target.sectionId} text`;
    default:
      return target.field.replace(/\./g, " ");
  }
};

/** Exposed for tests and for the gallery-tile invariant. */
export { GALLERY_TILE_COUNT };

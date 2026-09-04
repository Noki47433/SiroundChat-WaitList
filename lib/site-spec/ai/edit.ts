/**
 * Conversational editing: a sentence in, a list of structured operations out.
 *
 *   user message
 *     → schema-constrained model output (operations, never a document)
 *     → deterministic mapping to SiteSpecOp
 *     → authorization (operational truth stays in Business)
 *     → applyOps → validate
 *     → new draft version
 *     → a reply describing what actually happened
 *
 * The model never receives permission to overwrite a stored Site Spec, and never
 * sees a field it could write HTML or a URL into. The most it can do is propose
 * operations from the closed list below — and every one of those is then
 * authorized, applied and re-validated by code it has no influence over.
 */
import { z } from "zod";

import { callStructured, SITE_SPEC_MODEL, type ModelUsage } from "@/lib/site-spec/ai/client";
import { TOKEN_PATHS, type SiteSpecOp } from "@/lib/site-spec/ops";
import { FOOTER_PRESENTATIONS, SECTION_LAYOUTS } from "@/lib/site-spec/vocabulary";
import type { SiteSpec } from "@/lib/site-spec/schema";

// ─────────────────────────────────────────────────────────────────────────────
// What the model may propose
// ─────────────────────────────────────────────────────────────────────────────

const COPY_FIELDS = [
  "hero.eyebrow",
  "hero.headline",
  "hero.body",
  "hero.primaryCta",
  "hero.secondaryCta",
  "hero.bandCaption",
  "section.eyebrow",
  "section.title",
  "section.sub",
  "section.cta",
  "story.body",
  "story.quote",
  "story.attribution",
  "hours.note",
  "bookingStrip.headline",
  "bookingStrip.sub",
  "gallery.caption",
  "footer.ctaHeadline",
  "nav.cta",
  "seo.title",
  "seo.description"
] as const;

const TERMINOLOGY_KEYS = [
  "primaryAction",
  "services",
  "team",
  "gallery",
  "hours",
  "story",
  "reviews",
  "contact"
] as const;

/**
 * The model-facing operation shape. Flatter than `SiteSpecOp` because strict
 * schema-constrained decoding cannot express optional fields or nested unions —
 * every branch is fully required, with `null` where a field does not apply.
 */
export const ModelEditOpSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("set_copy"),
    field: z.enum(COPY_FIELDS),
    sectionId: z.string().nullable().describe("Required for any field starting with section./story./hours./bookingStrip./gallery."),
    index: z.number().nullable().describe("Only for gallery.caption — which image, from 0."),
    value: z.string().describe("The new text. An empty string clears an optional field.")
  }),
  z.object({
    op: z.literal("set_token"),
    path: z.enum(TOKEN_PATHS),
    stringValue: z.string().nullable().describe("For colours (#rrggbb) and named choices."),
    numberValue: z.number().nullable().describe("For sizes and weights.")
  }),
  z.object({
    op: z.literal("set_layout"),
    sectionId: z.string(),
    layout: z.enum(SECTION_LAYOUTS)
  }),
  z.object({
    op: z.literal("set_presentation"),
    sectionId: z.string(),
    presentation: z.string().describe("A presentation this section type supports.")
  }),
  z.object({
    op: z.literal("reorder_sections"),
    order: z.array(z.string()).describe("EVERY section id, in the new order. Never a partial list.")
  }),
  z.object({
    op: z.literal("remove_section"),
    sectionId: z.string()
  }),
  z.object({
    op: z.literal("bind_asset"),
    slot: z.enum(["hero", "gallery", "team"]),
    index: z.number().nullable().describe("Which gallery position, from 0."),
    memberId: z.string().nullable().describe("Which team member."),
    assetId: z.string().describe("An asset id you were given. Never a URL."),
    alt: z.string().describe("What the picture shows, for people who cannot see it.")
  }),
  z.object({
    op: z.literal("unbind_asset"),
    slot: z.enum(["hero", "gallery", "team"]),
    index: z.number().nullable(),
    memberId: z.string().nullable()
  }),
  z.object({
    op: z.literal("set_terminology"),
    key: z.enum(TERMINOLOGY_KEYS),
    value: z.string()
  }),
  z.object({
    op: z.literal("set_nav"),
    items: z.array(z.string()).describe("Up to four section ids, in order.")
  }),
  z.object({
    op: z.literal("set_footer"),
    presentation: z.enum(FOOTER_PRESENTATIONS)
  })
]);

export type ModelEditOp = z.infer<typeof ModelEditOpSchema>;

export const EditPlanSchema = z.object({
  /**
   * What the model understood. Used for logging and to explain a refusal — the
   * owner-facing reply is composed from what ACTUALLY happened, not from this.
   */
  understanding: z.string(),
  /** Empty when the request cannot be met by editing the website. */
  operations: z.array(ModelEditOpSchema),
  /**
   * Set when the request is not a website change at all — a price correction, a
   * new opening time, something that belongs in Business.
   */
  notAWebsiteChange: z.string().nullable()
});

export type EditPlan = z.infer<typeof EditPlanSchema>;

// ─────────────────────────────────────────────────────────────────────────────
// Mapping to the real operation type
// ─────────────────────────────────────────────────────────────────────────────

const SECTION_SCOPED = new Set<string>([
  "section.eyebrow",
  "section.title",
  "section.sub",
  "section.cta",
  "story.body",
  "story.quote",
  "story.attribution",
  "hours.note",
  "bookingStrip.headline",
  "bookingStrip.sub",
  "gallery.caption"
]);

const NUMERIC_TOKENS = new Set<string>(
  TOKEN_PATHS.filter((path) => path.startsWith("geometry.") || path.startsWith("hero.") ||
    path === "typography.displayWeight" || path === "typography.heroWeight" ||
    path === "typography.tracking" || path === "typography.measure")
);

/**
 * Convert one model operation into a real one, or drop it.
 *
 * Dropping is deliberate and silent to the model but visible to the caller: an
 * operation that cannot be mapped is one the model got wrong, and guessing at
 * what it meant is exactly the behaviour Stage 1 was built to remove.
 */
export const toSiteSpecOp = (op: ModelEditOp): SiteSpecOp | null => {
  switch (op.op) {
    case "set_copy": {
      const needsSection = SECTION_SCOPED.has(op.field);
      if (needsSection && !op.sectionId) return null;
      if (op.field === "gallery.caption") {
        if (op.index == null || op.index < 0) return null;
        return {
          op: "set_copy",
          target: { field: "gallery.caption", sectionId: op.sectionId!, index: Math.floor(op.index) },
          value: op.value
        };
      }
      return {
        op: "set_copy",
        target: (needsSection
          ? { field: op.field, sectionId: op.sectionId! }
          : { field: op.field }) as never,
        value: op.value
      };
    }

    case "set_token": {
      const numeric = NUMERIC_TOKENS.has(op.path);
      const value = numeric ? op.numberValue : op.stringValue;
      if (value == null) return null;
      return { op: "set_token", path: op.path, value };
    }

    case "set_layout":
      return { op: "set_layout", sectionId: op.sectionId, layout: op.layout };

    case "set_presentation":
      return { op: "set_presentation", sectionId: op.sectionId, presentation: op.presentation };

    case "reorder_sections":
      return { op: "reorder_sections", order: op.order };

    case "remove_section":
      return { op: "remove_section", sectionId: op.sectionId };

    case "bind_asset": {
      const slot = toSlot(op.slot, op.index, op.memberId);
      if (!slot) return null;
      return { op: "bind_asset", slot, assetId: op.assetId, alt: op.alt, fallbackSeed: 0 };
    }

    case "unbind_asset": {
      const slot = toSlot(op.slot, op.index, op.memberId);
      if (!slot) return null;
      return { op: "unbind_asset", slot, seed: 0 };
    }

    case "set_terminology":
      return { op: "set_terminology", key: op.key, value: op.value };

    case "set_nav":
      return { op: "set_nav", items: op.items };

    case "set_footer":
      return { op: "set_footer", presentation: op.presentation };

    default:
      return null;
  }
};

type MediaSlot =
  | { kind: "hero" }
  | { kind: "gallery"; index: number }
  | { kind: "team"; memberId: string };

const toSlot = (
  slot: "hero" | "gallery" | "team",
  index: number | null,
  memberId: string | null
): MediaSlot | null => {
  if (slot === "hero") return { kind: "hero" };
  if (slot === "gallery") {
    if (index == null || index < 0) return null;
    return { kind: "gallery", index: Math.floor(index) };
  }
  if (!memberId) return null;
  return { kind: "team", memberId };
};

// ─────────────────────────────────────────────────────────────────────────────
// Prompting
// ─────────────────────────────────────────────────────────────────────────────

export const EDIT_SYSTEM_PROMPT = `You edit an existing website by proposing small, precise operations.

You never rewrite the site. You never return HTML, CSS or a document. You choose from the
operations available and name exactly what changes.

RULES
· Change the least that satisfies the request. "Make the headline shorter" is one set_copy,
  not a redesign.
· "Put X above Y" is a reorder. List EVERY section id in the new order — a partial list is
  rejected.
· "Use this photo for the hero" is bind_asset with an asset id you were given. You cannot
  write an image address; there is no field for one.
· A request to change a price, a duration, an opening time, an address or a phone number is
  NOT a website change. Return no operations and set notAWebsiteChange, explaining that this
  lives in the business record and the website shows whatever is in there.
· Never put a price, duration, opening time, address or phone number into any copy. Those are
  bound from the business record and appear automatically.
· Never invent a fact — an award, a count, a year, a review, a credential — to fill space.
· If a request is broad ("make it feel more premium"), express it as design tokens,
  presentation and layout changes, and copy where it genuinely helps. Do not remove sections
  the owner did not ask you to remove.
· You cannot publish. Publishing is the owner's decision and there is no operation for it.

Set understanding to one short sentence describing what you took the request to mean.`;

// ─────────────────────────────────────────────────────────────────────────────
// The call
// ─────────────────────────────────────────────────────────────────────────────

export type InterpretResult =
  | { ok: true; ops: SiteSpecOp[]; understanding: string; dropped: number; attempts: number; usage: ModelUsage }
  | {
      ok: true;
      ops: [];
      understanding: string;
      notAWebsiteChange: string;
      dropped: 0;
      attempts: number;
      usage: ModelUsage;
    }
  | {
      ok: false;
      reason: "no_client" | "model_error" | "invalid_output" | "timeout";
      message: string;
      attempts: number;
      /** Carried on failures too: a failed interpretation still costs tokens. */
      usage: ModelUsage;
    };

export type InterpretInput = {
  message: string;
  spec: SiteSpec;
  /** Assets the owner actually owns, so the model can only name a real one. */
  assets?: Array<{ id: string; label: string }>;
  /** Recent turns, oldest first, for pronoun resolution ("make it darker still"). */
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  model?: string;
  maxAttempts?: number;
  call?: typeof callStructured;
};

/** A compact description of the current site, so the model edits what exists. */
export const describeSpecForEditing = (
  spec: SiteSpec,
  assets: Array<{ id: string; label: string }> = []
): string => {
  const lines: string[] = [];
  lines.push("THE SITE AS IT STANDS");
  lines.push(`brand: ${spec.meta.brandName ?? "(from the business record)"}`);
  lines.push(
    `style: ${spec.design.density} spacing · ${spec.design.art.treatment} photography · ` +
      `${spec.design.chrome.nav} nav · accent ${spec.design.palette.accent} on ${spec.design.palette.background}`
  );
  lines.push(`the word for the main action: "${spec.terminology.primaryAction}"`);
  lines.push("");
  lines.push("SECTIONS, in order:");
  for (const section of spec.sections) {
    const parts: string[] = [`  ${section.id} (${section.type}`];
    if ("layout" in section) parts.push(`, ${section.layout} layout`);
    if ("presentation" in section) parts.push(`, ${(section as { presentation: string }).presentation}`);
    if (section.type === "hero") parts.push(`, ${section.variant} variant`);
    parts.push(")");
    const title = typeof section.heading.title === "string" ? section.heading.title : null;
    lines.push(parts.join("") + (title ? ` — "${title}"` : ""));
  }

  const hero = spec.sections.find((section) => section.type === "hero");
  if (hero && hero.type === "hero") {
    lines.push("");
    lines.push(`HERO HEADLINE: ${JSON.stringify(hero.headline)}`);
    if (hero.body) lines.push(`HERO TEXT: ${JSON.stringify(hero.body)}`);
  }

  if (assets.length) {
    lines.push("");
    lines.push("IMAGES THIS BUSINESS OWNS (bind by id — there is no way to use any other image):");
    for (const asset of assets) lines.push(`  ${asset.id} — ${asset.label}`);
  } else {
    lines.push("");
    lines.push("This business has uploaded no images yet, so bind_asset cannot be used.");
  }

  return lines.join("\n");
};

/** Ask the model what operations a message means. */
export const interpretEdit = async ({
  message,
  spec,
  assets = [],
  history = [],
  model = SITE_SPEC_MODEL,
  maxAttempts = 2,
  call = callStructured
}: InterpretInput): Promise<InterpretResult> => {
  const context = [
    describeSpecForEditing(spec, assets),
    history.length
      ? "\nEARLIER IN THIS CONVERSATION:\n" +
        history
          .slice(-6)
          .map((turn) => `${turn.role === "user" ? "owner" : "you"}: ${turn.content}`)
          .join("\n")
      : "",
    `\nTHE OWNER SAYS: ${message.trim().slice(0, 800)}`
  ].join("\n");

  const result = await call<EditPlan>({
    schema: EditPlanSchema,
    schemaName: "site_edit_plan",
    system: EDIT_SYSTEM_PROMPT,
    user: context,
    model,
    maxAttempts,
    temperature: 0.2
  });

  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      message: result.message,
      attempts: result.attempts,
      usage: result.usage
    };
  }

  const plan = result.value;
  if (plan.notAWebsiteChange && !plan.operations.length) {
    return {
      ok: true,
      ops: [],
      understanding: plan.understanding,
      notAWebsiteChange: plan.notAWebsiteChange,
      dropped: 0,
      attempts: result.attempts,
      usage: result.usage
    };
  }

  const mapped = plan.operations.map(toSiteSpecOp);
  const ops = mapped.filter((op): op is SiteSpecOp => op !== null);

  return {
    ok: true,
    ops,
    understanding: plan.understanding,
    dropped: mapped.length - ops.length,
    attempts: result.attempts,
    usage: result.usage
  };
};

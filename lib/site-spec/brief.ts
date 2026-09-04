/**
 * The generation brief — a typed, internal description of the site to be built.
 *
 * This replaces the audited "Enhance Prompt" flow, which turned a short user
 * request into a long prose blob, showed it to the owner, and then let a
 * keyword selector score it. Three things are different here:
 *
 *  · It is **structured**, not prose. The model receives fields, not a paragraph
 *    it has to re-parse.
 *  · It is **internal**. The owner never sees it and is never asked to edit it.
 *    Prompt engineering is not part of the product.
 *  · It **separates authority**. Business facts arrive as canonical data that the
 *    model may present but not restate; Knowledge arrives as clearly-labelled
 *    narrative material that may inform tone and story and nothing else.
 *
 * The brief carries no prices, durations or opening times as copy — those reach
 * the page through the Site Spec's binding model at render time. What the brief
 * carries is what the model needs in order to make *design* decisions.
 */
import type { BusinessPayload } from "@/lib/business/load";
import type { ClarificationAnswer } from "@/lib/site-spec/clarify";

// ─────────────────────────────────────────────────────────────────────────────
// Shape
// ─────────────────────────────────────────────────────────────────────────────

/** A long-form excerpt the business uploaded. Narrative only, never operational. */
export type KnowledgeExcerpt = {
  source: string;
  text: string;
};

export type BriefService = {
  id: string;
  name: string;
  /** Owner-written, if any. The model may rewrite presentation copy around it. */
  description: string | null;
  /**
   * Present so the model can judge *shape* — a four-item list reads differently
   * from a twenty-item one, and a wide price range suggests packages rather than
   * a price list. It must not copy these into text; the renderer binds them.
   */
  priceBand: "low" | "mid" | "high" | "hidden";
  durationMin: number;
};

export type GenerationBrief = {
  /** Canonical identity. */
  businessId: string;
  brandName: string;
  locale: string;

  /** What the owner asked for, verbatim and short. */
  request: string;

  /** Answers to the 0–3 clarifications, including any chosen-for-you defaults. */
  decisions: ClarificationAnswer[];

  /** Structural facts about the business, for judging composition. */
  shape: {
    serviceCount: number;
    teamCount: number;
    hasHours: boolean;
    hasLocation: boolean;
    hasSocials: boolean;
    /** True when a real booking engine stands behind a "Book" action. */
    bookingAvailable: boolean;
    /** How many owner-uploaded images exist to build a gallery from. */
    ownedImageCount: number;
    priceSpread: "flat" | "narrow" | "wide" | "unknown";
  };

  /** Names only. Enough to write around; never enough to restate a fact. */
  services: BriefService[];
  team: Array<{ id: string; name: string; sole: string | null }>;

  /** Narrative source material. May shape story, tone and FAQ copy only. */
  knowledge: KnowledgeExcerpt[];

  /** Assets available to bind. */
  assets: Array<{ id: string; kind: string }>;
};

// ─────────────────────────────────────────────────────────────────────────────
// Building
// ─────────────────────────────────────────────────────────────────────────────

const priceBandOf = (cents: number | null, mode: string): BriefService["priceBand"] => {
  if (mode === "hidden" || cents == null) return "hidden";
  if (cents < 2000) return "low";
  if (cents < 8000) return "mid";
  return "high";
};

const priceSpreadOf = (business: BusinessPayload): GenerationBrief["shape"]["priceSpread"] => {
  const prices = business.services
    .filter((service) => service.isActive && service.priceMode !== "hidden")
    .map((service) => service.basePriceCents)
    .filter((cents): cents is number => cents != null);
  if (prices.length < 2) return "unknown";
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  if (min === max) return "flat";
  return max / Math.max(min, 1) >= 4 ? "wide" : "narrow";
};

export type BuildBriefInput = {
  business: BusinessPayload;
  request: string;
  decisions?: ClarificationAnswer[];
  knowledge?: KnowledgeExcerpt[];
  assets?: Array<{ id: string; kind: string }>;
  brandName?: string | null;
  locale?: string;
};

/**
 * Assemble the brief. Pure — the caller does the I/O (loading business data,
 * retrieving Knowledge, listing assets) so this stays testable and so the
 * authority rules below are visible in one place.
 */
export const buildGenerationBrief = ({
  business,
  request,
  decisions = [],
  knowledge = [],
  assets = [],
  brandName,
  locale = "en"
}: BuildBriefInput): GenerationBrief => {
  const services = business.services.filter((service) => service.isActive);
  const team = business.team.filter((member) => member.isActive);

  return {
    businessId: business.businessId,
    brandName: brandName || business.businessName || "Business",
    locale,
    request: request.trim().slice(0, 600),
    decisions,
    shape: {
      serviceCount: services.length,
      teamCount: team.length,
      hasHours: business.hasHours && business.hours.length > 0,
      hasLocation: Boolean(business.location?.address),
      hasSocials: false,
      bookingAvailable: business.capabilities.mode === "neutral",
      ownedImageCount: assets.length,
      priceSpread: priceSpreadOf(business)
    },
    services: services.slice(0, 24).map((service) => ({
      id: service.id,
      name: service.name,
      description: service.description,
      priceBand: priceBandOf(service.basePriceCents, service.priceMode),
      durationMin: service.durationMin
    })),
    team: team.slice(0, 12).map((member) => ({
      id: member.id,
      name: member.name,
      sole: member.serviceIds.length === 1
        ? (services.find((service) => service.id === member.serviceIds[0])?.name ?? null)
        : null
    })),
    knowledge: knowledge.slice(0, 6).map((excerpt) => ({
      source: excerpt.source,
      text: excerpt.text.slice(0, 1200)
    })),
    assets: assets.slice(0, 24)
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Rendering the brief for the model
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The brief as the model sees it.
 *
 * Written as labelled sections rather than JSON so the authority boundary is
 * unmissable: Business data is marked authoritative, Knowledge is marked
 * narrative-only, and the instruction that separates them sits between the two.
 */
export const briefToPrompt = (brief: GenerationBrief): string => {
  const lines: string[] = [];

  lines.push(`BUSINESS: ${brief.brandName}`);
  lines.push(`LANGUAGE: ${brief.locale}`);
  lines.push("");
  lines.push(`WHAT THE OWNER ASKED FOR: ${brief.request}`);

  if (brief.decisions.length) {
    lines.push("");
    lines.push("DECISIONS ALREADY MADE:");
    for (const decision of brief.decisions) {
      const suffix = decision.chosenForYou ? " (chosen for them — they skipped the question)" : "";
      lines.push(`  · ${decision.topic}: ${decision.answerLabel}${suffix}`);
    }
  }

  lines.push("");
  lines.push("SHAPE OF THE BUSINESS (use this to judge composition):");
  lines.push(`  services: ${brief.shape.serviceCount}   price spread: ${brief.shape.priceSpread}`);
  lines.push(`  team members: ${brief.shape.teamCount}`);
  lines.push(`  published opening hours: ${brief.shape.hasHours ? "yes" : "no"}`);
  lines.push(`  physical location: ${brief.shape.hasLocation ? "yes" : "no"}`);
  lines.push(
    `  live booking engine: ${brief.shape.bookingAvailable ? "yes — a Book action is real" : "no — use an enquiry action instead"}`
  );
  lines.push(`  owner-supplied images available: ${brief.shape.ownedImageCount}`);

  if (brief.services.length) {
    lines.push("");
    lines.push("SERVICE NAMES (names only — prices and durations are bound at render time):");
    for (const service of brief.services) {
      lines.push(
        `  · ${service.name}${service.description ? ` — ${service.description}` : ""}`
      );
    }
  }

  if (brief.team.length) {
    lines.push("");
    lines.push("TEAM (names only):");
    lines.push(`  ${brief.team.map((member) => member.name).join(", ")}`);
  }

  if (brief.knowledge.length) {
    lines.push("");
    lines.push(
      "BACKGROUND MATERIAL (the owner's own words — use for story, tone and character ONLY.",
      "It must not override any operational fact, and nothing in it may be restated as a price,",
      "duration, opening time, contact detail or guarantee):"
    );
    for (const excerpt of brief.knowledge) {
      lines.push(`  --- from ${excerpt.source} ---`);
      lines.push(`  ${excerpt.text.replace(/\n+/g, "\n  ")}`);
    }
  }

  return lines.join("\n");
};

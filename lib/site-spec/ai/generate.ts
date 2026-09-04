/**
 * AI site generation: a structured brief in, a validated Site Spec out.
 *
 *   Business + Knowledge + intent
 *     → generation brief
 *     → clarification completeness check
 *     → schema-constrained model output (a Site *Plan*, never HTML)
 *     → deterministic assembly into a Site Spec
 *     → Stage 1 validation
 *     → bounded repair on failure
 *     → draft version only. Generation never publishes.
 */
import { briefToPrompt, type GenerationBrief } from "@/lib/site-spec/brief";
import {
  callStructured,
  SITE_SPEC_MODEL,
  type ModelUsage,
  type StructuredResult
} from "@/lib/site-spec/ai/client";
import { assembleSpecFromPlan, SitePlanSchema, type SitePlan } from "@/lib/site-spec/ai/plan";
import type { SiteSpec } from "@/lib/site-spec/schema";

// ─────────────────────────────────────────────────────────────────────────────
// The rules the model works under
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Copy rules are stated as prohibitions with reasons rather than as style notes,
 * because the failure mode being prevented — a confident invented fact on a real
 * business's public website — is the expensive one.
 */
export const GENERATION_SYSTEM_PROMPT = `You design websites for small businesses. You return a PLAN, never HTML, CSS or code.

WHAT YOU DECIDE
· The visual direction: palette, photographic treatment, type, spacing, chrome.
· The page composition: which sections appear, in what order, in what layout and presentation.
· The words: headline, section headings, supporting lines, button labels, story copy.
· The vocabulary this trade uses — "Book" or "Enquire", "Treatments" or "Packages", "Work" or "Gallery".

WHAT YOU MUST NEVER DO
· Never state a price, a duration, an opening time, an address or a phone number in any copy.
  These are bound from the business's own record at render time and shown automatically.
  Writing them into text produces a website that lies the moment the business changes.
· Never invent an award, a number of years in business, a customer count, a review, a
  testimonial, a qualification, a guarantee, a certification or a team member's biography.
  If you were not given it, it does not go on the page.
· Never write a team member's job title. You are given names only.
· Never use placeholder text such as "Lorem ipsum" or "[Your text here]".

WHEN YOU DO NOT HAVE SOMETHING
Omit the claim, or write something true and neutral. A shorter honest page beats a longer
invented one. "Book online in under a minute" is fine. "Trusted by 5,000 customers" is not,
unless you were told it.

BACKGROUND MATERIAL
Anything under BACKGROUND MATERIAL is the owner's own writing. Use it for story, character and
tone. It never overrides an operational fact, and nothing in it may be restated as a price,
a duration, an opening time, a contact detail or a guarantee.

VOICE
Write like this specific business, not like a website. Vary sentence length. Avoid the
generic AI register — no "Welcome to", no "Discover the difference", no "your journey
starts here", no triplets of adjectives. Two businesses in the same trade should not
produce the same headline.

COMPOSITION
Give the page a shape. Do not stack every section in the same layout with the same
eyebrow-heading-paragraph opening. Use the layouts and presentations available to make some
sections wide, some split, some centred. A page where every section reads identically is a
failed design.

COLOUR
Body text must be clearly readable on the background, and text on the accent must be clearly
readable on the accent. These are checked and a failure is rejected.`;

// ─────────────────────────────────────────────────────────────────────────────
// Generation
// ─────────────────────────────────────────────────────────────────────────────

export type GenerateResult =
  | { ok: true; spec: SiteSpec; plan: SitePlan; attempts: number; usage: ModelUsage }
  | {
      ok: false;
      reason: "no_client" | "model_error" | "invalid_output" | "timeout";
      message: string;
      attempts: number;
      /** Carried on failures too: a failed generation still costs tokens. */
      usage: ModelUsage;
      issues?: Array<{ path: string; message: string }>;
    };

export type GenerateInput = {
  brief: GenerationBrief;
  /** Passed in so generation is reproducible and testable. */
  now: string;
  model?: string;
  maxAttempts?: number;
  /** Injected in tests to exercise the pipeline without a network call. */
  call?: typeof callStructured;
};

/**
 * Generate a site.
 *
 * The `verify` hook is what makes repair informed: a plan that parses but does
 * not assemble into a valid Site Spec is sent back with the *validator's* own
 * issues, so the second attempt corrects a named problem instead of rerolling.
 */
export const generateSiteSpec = async ({
  brief,
  now,
  model = SITE_SPEC_MODEL,
  maxAttempts = 3,
  call = callStructured
}: GenerateInput): Promise<GenerateResult> => {
  // Assembly runs twice on success — once to verify, once to return. It is pure
  // and cheap, and the alternative is smuggling state out of the verify hook.
  const result: StructuredResult<SitePlan> = await call<SitePlan>({
    schema: SitePlanSchema,
    schemaName: "site_plan",
    system: GENERATION_SYSTEM_PROMPT,
    user: briefToPrompt(brief),
    model,
    maxAttempts,
    temperature: 0.8,
    verify: (plan) => {
      const assembled = assembleSpecFromPlan({ plan, brief, now });
      return assembled.ok ? null : assembled.issues;
    }
  });

  if (!result.ok) {
    return {
      ok: false,
      reason: result.reason,
      message: result.message,
      attempts: result.attempts,
      usage: result.usage,
      issues: result.issues
    };
  }

  const assembled = assembleSpecFromPlan({ plan: result.value, brief, now });
  if (!assembled.ok) {
    // The verify hook already passed, so reaching here means assembly is not
    // deterministic — worth failing loudly rather than persisting anything.
    return {
      ok: false,
      reason: "invalid_output",
      message: "The generated design could not be assembled into a valid site.",
      attempts: result.attempts,
      usage: result.usage,
      issues: assembled.issues
    };
  }

  return {
    ok: true,
    spec: assembled.spec,
    plan: result.value,
    attempts: result.attempts,
    usage: result.usage
  };
};

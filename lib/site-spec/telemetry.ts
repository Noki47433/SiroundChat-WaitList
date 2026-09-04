/**
 * What a Site Spec route is allowed to say about itself.
 *
 * A canary is useless if its failures are invisible, so every interesting
 * outcome in the pipeline emits one line. The constraint that shapes this file
 * is the other half of that sentence: the lines must be safe to keep.
 *
 * **Never logged**: the owner's message, Business Knowledge, generated copy,
 * prompts, model responses, auth tokens, storage URLs, or anything else that
 * could carry a customer's or a business's private content. A validation issue
 * names a field and a constraint, which is why *those* are safe and the prompt
 * that produced them is not.
 *
 * **Always logged**: ids, event type, timings, counts, and bounded error
 * metadata — enough to answer "is the canary healthy?" without reading anyone's
 * website.
 *
 * The transport is a structured `console` line, deliberately. That is the
 * repository's existing server telemetry (`[BUILDER_ASSET_LIST_ERROR]`,
 * `[BUILDER_SITE_RENDER_PIPELINE]`, `[BILLING_OWNED_BUSINESSES_ERROR]`, …), it
 * is collected by the platform log drain, and the mission is explicit that this
 * stage should reuse what exists rather than invent an observability platform.
 */

export type SiteSpecEventFields = Record<string, string | number | boolean | null | undefined>;

/** The event vocabulary, in one place so it can be asserted against. */
export const SITE_SPEC_EVENTS = [
  // generation
  "GENERATE_ATTEMPT",
  "GENERATED",
  "GENERATE_FAILED",
  "GENERATE_CONFLICT",
  "GENERATE_DUPLICATE",
  "CLARIFY",
  // editing
  "EDIT",
  "EDIT_CONFLICT",
  "EDIT_DUPLICATE",
  // versions
  "RESTORED",
  "RESTORE_FAILED",
  "UNDO_CONFLICT",
  // publishing
  "PUBLISH_ATTEMPT",
  "PUBLISHED",
  "PUBLISH_FAILED",
  "UNPUBLISHED",
  "UNPUBLISH_FAILED",
  // assets
  "ASSET_UPLOADED",
  "ASSET_UPLOAD_FAILED",
  "ASSET_LIST_FAILED",
  // public runtime
  "BOOKING_RUNTIME",
  "BOOKING_RUNTIME_FAILED",
  "RENDER",
  "RENDER_FAILED",
  // limits and rollout
  "RATE_LIMITED",
  "ROLLOUT_BLOCKED",
  // model economics
  "MODEL_CALL"
] as const;

export type SiteSpecEvent = (typeof SITE_SPEC_EVENTS)[number];

export const logSiteSpecEvent = (event: string, fields: SiteSpecEventFields) => {
  console.info(`[SITE_SPEC_${event}]`, fields);
};

/** The failure half of the same vocabulary, so errors are greppable as errors. */
export const logSiteSpecFailure = (event: string, fields: SiteSpecEventFields) => {
  console.error(`[SITE_SPEC_${event}]`, fields);
};

/** Wall-clock for one operation, in whole milliseconds. */
export const startTimer = () => {
  const began = Date.now();
  return () => Date.now() - began;
};

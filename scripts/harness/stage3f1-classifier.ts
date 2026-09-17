/**
 * Stage 3F.1 — the reliability taxonomy, frozen before the run.
 *
 * Stage 3F measured 5.36% against a <5% gate and six of its "failures" were, on
 * inspection, five correct no-ops and one real defect. I did not reclassify them,
 * because moving a class after seeing which way it pushes the number is the whole
 * thing the no-gaming rule exists to prevent. So the correction belongs here,
 * ahead of the next run, written down and hashed before a single edit is sent.
 *
 * The rule that makes "correct no-op" honest rather than convenient is the proof
 * requirement below: the model saying "that is already the case" counts for
 * nothing. The stored Site Spec, read BEFORE the edit, has to show it.
 *
 * This file is hashed and the hash is recorded in the Stage 3F.1 report, so the
 * report can prove the taxonomy predates the results.
 */

export type OutcomeClass =
  | "applied"
  | "correct_policy_refusal"
  | "duplicate_section_refusal"
  | "stale_write_conflict"
  | "idempotent_replay"
  | "correct_no_op"
  | "timeout"
  | "model_failure"
  | "wrong_mutation";

/** The only three classes that count against the gate. */
export const HARD_FAILURE_CLASSES: ReadonlySet<OutcomeClass> = new Set([
  "timeout",
  "model_failure",
  "wrong_mutation"
]);

export const CLASS_RULES: Record<OutcomeClass, { hard: boolean; rule: string }> = {
  applied: { hard: false, rule: "A valid requested change was applied and a version was written." },
  correct_policy_refusal: {
    hard: false,
    rule: "An operational fact, unsafe request or forbidden instruction was correctly refused."
  },
  duplicate_section_refusal: {
    hard: false,
    rule: "The requested duplicate is already prohibited by product rules."
  },
  stale_write_conflict: { hard: false, rule: "Expected concurrency protection (409 version_conflict)." },
  idempotent_replay: { hard: false, rule: "Expected duplicate-request protection." },
  correct_no_op: {
    hard: false,
    rule:
      "The request was understood, the requested state already existed, the reply says so, AND the " +
      "pre-edit stored spec proves it. Proof is mandatory — see mustProveNoOp."
  },
  timeout: { hard: true, rule: "The owner's request did not complete inside the contract." },
  model_failure: { hard: true, rule: "A safe request could not be fulfilled." },
  wrong_mutation: { hard: true, rule: "The request was applied incorrectly, or unintended state moved." }
};

/**
 * What a "correct no-op" claim must be able to point at.
 *
 * Each entry answers one question about the spec as it stood BEFORE the edit. If
 * a prompt's claim has no predicate here, or the predicate says the state was not
 * already satisfied, the outcome is a hard failure — ambiguity counts against us,
 * never for us.
 */
export const NO_OP_PREDICATES: Record<string, (spec: any) => { satisfied: boolean; observed: string }> = {
  "Make the gallery a mosaic": (spec) => {
    const gallery = spec?.sections?.find((s: any) => s.type === "gallery");
    return {
      satisfied: gallery?.presentation === "mosaic",
      observed: `gallery.presentation = ${gallery?.presentation ?? "(no gallery)"}`
    };
  },
  "Make the gallery a filmstrip instead": (spec) => {
    const gallery = spec?.sections?.find((s: any) => s.type === "gallery");
    return {
      satisfied: gallery?.presentation === "filmstrip",
      observed: `gallery.presentation = ${gallery?.presentation ?? "(no gallery)"}`
    };
  },
  "Show the gallery as a portfolio": (spec) => {
    const gallery = spec?.sections?.find((s: any) => s.type === "gallery");
    return {
      satisfied: gallery?.presentation === "portfolio",
      observed: `gallery.presentation = ${gallery?.presentation ?? "(no gallery)"}`
    };
  },
  "Give the gallery a heading that says Our work": (spec) => {
    const gallery = spec?.sections?.find((s: any) => s.type === "gallery");
    const title = String(gallery?.heading?.title ?? "");
    return {
      satisfied: title.trim().toLowerCase() === "our work",
      observed: `gallery.heading.title = ${JSON.stringify(title)}`
    };
  },
  "Show the services as cards": (spec) => {
    const services = spec?.sections?.find((s: any) => s.type === "services");
    return {
      satisfied: services?.presentation === "cards",
      observed: `services.presentation = ${services?.presentation ?? "(no services)"}`
    };
  },
  "Make the services section full width": (spec) => {
    const services = spec?.sections?.find((s: any) => s.type === "services");
    return {
      satisfied: services?.layout === "wide",
      observed: `services.layout = ${services?.layout ?? "(no services)"}`
    };
  },
  "Put the menu at the top of the page": (spec) => ({
    satisfied: spec?.design?.chrome?.navPosition === "center",
    observed: `chrome.navPosition = ${spec?.design?.chrome?.navPosition ?? "(unset)"}`
  }),
  "Add the gallery to the navigation": (spec) => {
    const items: any[] = spec?.nav?.items ?? spec?.design?.chrome?.navItems ?? [];
    const has = items.some((i: any) =>
      String(i?.sectionId ?? i?.target?.sectionId ?? i?.label ?? "").toLowerCase().includes("galler")
    );
    return { satisfied: has, observed: `nav items = ${JSON.stringify(items.map((i: any) => i?.label ?? i))}` };
  },
  "Make the headings a little larger": (spec) => ({
    // Only "largest" is already-satisfied: from "larger" there is still a step up.
    satisfied: spec?.design?.typography?.headingScale === "largest",
    observed: `typography.headingScale = ${spec?.design?.typography?.headingScale ?? "(unset)"}`
  }),
  "Use a more classic typeface for headings": (spec) => ({
    satisfied: spec?.design?.typography?.display === "serif-display",
    observed: `typography.display = ${spec?.design?.typography?.display ?? "(unset)"}`
  })
};

/**
 * Decide whether a no-op claim is allowed to stand.
 *
 * Returns the evidence string either way, so the report can show what the spec
 * actually said rather than asserting that it was checked.
 */
export const proveNoOp = (
  prompt: string,
  specBeforeEdit: any
): { allowed: boolean; evidence: string } => {
  const predicate = NO_OP_PREDICATES[prompt];
  if (!predicate) {
    return { allowed: false, evidence: "no pre-declared predicate for this prompt — counts as a hard failure" };
  }
  const { satisfied, observed } = predicate(specBeforeEdit);
  return {
    allowed: satisfied,
    evidence: satisfied
      ? `pre-edit spec confirms: ${observed}`
      : `pre-edit spec CONTRADICTS the no-op claim: ${observed}`
  };
};

/** Phrases that indicate the model is claiming the state already exists. */
export const NO_OP_REPLY_PATTERN =
  /already (has|is|set|been|includes|contains)|no change(s)? (is|are)? ?(needed|required)|nothing to change/i;

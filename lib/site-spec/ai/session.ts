/**
 * The website conversation, end to end.
 *
 * Two entry points — generate a site, and edit one — each of which runs the full
 * pipeline and returns a reply written from **what actually happened**, not from
 * what the model said it would do. That distinction is the whole reason the
 * reply is composed here rather than taken from the model: if an operation was
 * refused, the owner is told it was refused.
 *
 * Neither entry point can publish. There is no publish operation, and both paths
 * end at `saveDraftSpec`, which moves the draft pointer and nothing else.
 */
import type { BusinessPayload } from "@/lib/business/load";
import { buildGenerationBrief, type GenerationBrief, type KnowledgeExcerpt } from "@/lib/site-spec/brief";
import { decideRemaining, nextClarifications, summariseDecisions, type ClarificationAnswer, type ClarificationQuestion } from "@/lib/site-spec/clarify";
import { emptyModelUsage, SITE_SPEC_MODEL, type ModelUsage } from "@/lib/site-spec/ai/client";
import { generateSiteSpec } from "@/lib/site-spec/ai/generate";
import {
  EDIT_MODEL_TIMEOUT_MS,
  interpretEdit,
  type InterpretResult
} from "@/lib/site-spec/ai/edit";
import { authorizeOps, type OpRejection, type OpWarning } from "@/lib/site-spec/authorize";
import { applyOps, type SiteSpecOp } from "@/lib/site-spec/ops";
import { ALREADY_TRUE_REPLIES, describeObservedChange, describeUnchanged } from "@/lib/site-spec/describe-change";
import { sameWebsite } from "@/lib/site-spec/semantic-fingerprint";
import {
  checkExpectations,
  describeExpectationFailures,
  summariseExpectationFailures,
  type Expectation
} from "@/lib/site-spec/expectations";
import { saveDraftSpec, type SiteVersion } from "@/lib/site-spec/store";
import type { SiteSpec } from "@/lib/site-spec/schema";

type SupabaseLike = {
  rpc: (fn: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: unknown }>;
  from: (table: string) => any;
};

// ─────────────────────────────────────────────────────────────────────────────
// Starting a site
// ─────────────────────────────────────────────────────────────────────────────

export type StartResult =
  | { status: "needs_clarification"; brief: GenerationBrief; questions: ClarificationQuestion[] }
  | { status: "ready"; brief: GenerationBrief; decisions: ClarificationAnswer[] };

/**
 * What to do with a new request: ask up to three questions, or go straight to
 * generating. Zero questions is the expected outcome whenever the business
 * record and the request already settle the material decisions.
 */
export const startSite = ({
  business,
  request,
  knowledge = [],
  assets = [],
  answered = [],
  brandName,
  locale
}: {
  business: BusinessPayload;
  request: string;
  knowledge?: KnowledgeExcerpt[];
  assets?: Array<{ id: string; kind: string }>;
  answered?: ClarificationAnswer[];
  brandName?: string | null;
  locale?: string;
}): StartResult => {
  const brief = buildGenerationBrief({
    business,
    request,
    decisions: answered,
    knowledge,
    assets,
    brandName,
    locale
  });

  const questions = nextClarifications(brief, answered);
  if (questions.length) return { status: "needs_clarification", brief, questions };
  return { status: "ready", brief, decisions: answered };
};

export type GenerationOutcome =
  | {
      ok: true;
      spec: SiteSpec;
      version: SiteVersion;
      reply: string;
      decisions: ClarificationAnswer[];
      usage: ModelUsage;
    }
  | { ok: false; reply: string; reason: string; recoverable: boolean; usage: ModelUsage };

/**
 * Generate the first draft and persist it as a version.
 *
 * `now` is passed in rather than read from the clock so a generation can be
 * reproduced exactly in a test.
 */
export const runGeneration = async ({
  supabase,
  siteId,
  business,
  request,
  answered = [],
  knowledge = [],
  assets = [],
  brandName,
  locale,
  now,
  expectedParentVersionId = null,
  generate = generateSiteSpec
}: {
  supabase: SupabaseLike;
  siteId: string;
  business: BusinessPayload;
  request: string;
  answered?: ClarificationAnswer[];
  knowledge?: KnowledgeExcerpt[];
  assets?: Array<{ id: string; kind: string }>;
  brandName?: string | null;
  locale?: string;
  now: string;
  /**
   * The draft the owner was looking at when they asked, or null for a site that
   * has none. Regenerating over a draft that has since moved is refused for the
   * same reason an edit is: it would discard a change nobody was told about.
   */
  expectedParentVersionId?: string | null;
  generate?: typeof generateSiteSpec;
}): Promise<GenerationOutcome> => {
  const initial = buildGenerationBrief({
    business,
    request,
    decisions: answered,
    knowledge,
    assets,
    brandName,
    locale
  });

  // Anything still unanswered is decided here and recorded as chosen-for-you,
  // so the brief is always complete and the owner can always see what was picked.
  const decisions = decideRemaining(initial, answered);
  const brief = buildGenerationBrief({
    business,
    request,
    decisions,
    knowledge,
    assets,
    brandName,
    locale
  });

  const generated = await generate({ brief, now });
  if (!generated.ok) {
    return {
      ok: false,
      usage: generated.usage,
      reason: generated.reason,
      recoverable: generated.reason !== "no_client",
      reply:
        generated.reason === "no_client"
          ? "Website generation isn't available in this environment yet."
          : "I couldn't get a design together just then. Try again and I'll have another go."
    };
  }

  const saved = await saveDraftSpec(supabase, siteId, generated.spec, {
    source: "generated",
    label: "First draft",
    expectedParentVersionId
  });
  if (!saved.ok) {
    return {
      ok: false,
      usage: generated.usage,
      reason: saved.reason,
      recoverable: saved.reason !== "conflict",
      reply:
        saved.reason === "conflict"
          ? "Your website changed somewhere else while I was designing this, so I haven't replaced it. Reload and try again."
          : "I designed the site but couldn't save it. Nothing has changed — try once more."
    };
  }

  const summary = summariseDecisions(decisions);
  return {
    ok: true,
    spec: generated.spec,
    version: saved.value,
    decisions,
    usage: generated.usage,
    reply: summary
      ? `Here's a first version — ${summary.toLowerCase()}. Tell me what to change.`
      : "Here's a first version. Tell me what to change."
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Editing a site
// ─────────────────────────────────────────────────────────────────────────────

export type EditOutcome = {
  /** True when the draft moved. False means the draft is exactly as it was. */
  changed: boolean;
  /**
   * Set when the save was refused because someone else changed the site first.
   * Distinct from an ordinary failure: nothing was wrong with the edit, it was
   * simply computed against a draft that is no longer current.
   */
  conflict?: boolean;
  /** Why an edit failed, for server-side logs. Never shown to the owner raw. */
  diagnostics?: { stage: "apply" | "model" | "save"; detail: string };
  reply: string;
  ops: SiteSpecOp[];
  rejections: OpRejection[];
  warnings: OpWarning[];
  spec?: SiteSpec;
  version?: SiteVersion;
  /** The version to go back to, if the owner undoes this change. */
  undoToVersionId?: string | null;
  /** Latency and tokens across every model call this edit made, repairs included. */
  usage: ModelUsage;
  /**
   * Stage 3F.2. True when the edit was understood and applied cleanly but the
   * website would be exactly the same afterwards — so nothing was written, and
   * the owner was told the site already looks that way.
   */
  noOp?: boolean;
  /** Whether the one bounded repair ran, and whether its result is what applied. */
  repair?: { attempted: boolean; succeeded: boolean };
  /** The model the edit was interpreted with. Not a secret; reported for cost. */
  model?: string;
  /** Typed outcome checks the model stated, and how many did not come true. */
  expectations?: { stated: number; failed: number };
};

/**
 * Interpret a message, authorize it, apply it, and save a new draft version.
 *
 * Every failure path leaves the draft untouched — an edit either lands whole or
 * does not land at all.
 */
type EditTrace = {
  repair: { attempted: boolean; succeeded: boolean };
  /** Typed outcome checks stated by the model, and how many did not come true. */
  expectations: { stated: number; failed: number };
};

/**
 * The diagnostics the owner's edit route returns (Stage 3F.2 · Phase E).
 *
 * One function so the shape is testable and cannot grow by accident. Every value
 * is a number, a boolean, a closed stage name or the configured model id — never
 * the prompt, the owner's words, generated copy, the model's understanding, the
 * failure detail, customer data, a token or a key.
 */
export const editDiagnostics = (outcome: EditOutcome, totalMs: number) => ({
  model: outcome.model ?? null,
  promptTokens: outcome.usage.promptTokens,
  completionTokens: outcome.usage.completionTokens,
  attempts: outcome.usage.attempts,
  repairAttempted: outcome.repair?.attempted ?? false,
  repaired: outcome.repair?.succeeded ?? false,
  modelMs: outcome.usage.durationMs,
  totalMs,
  noOp: outcome.noOp ?? false,
  /** How many typed expectations the model stated for this edit, and how many failed. */
  expectationsStated: outcome.expectations?.stated ?? 0,
  expectationsFailed: outcome.expectations?.failed ?? 0,
  stage: outcome.diagnostics?.stage ?? null
});

export const runEdit = async (input: Parameters<typeof runEditPipeline>[0]): Promise<EditOutcome> => {
  const trace: EditTrace = {
    repair: { attempted: false, succeeded: false },
    expectations: { stated: 0, failed: 0 }
  };
  const outcome = await runEditPipeline(input, trace);
  return { ...outcome, repair: trace.repair, model: SITE_SPEC_MODEL, expectations: trace.expectations };
};

const runEditPipeline = async ({
  supabase,
  siteId,
  spec,
  business,
  message,
  assets = [],
  history = [],
  expectedParentVersionId = null,
  interpret = interpretEdit,
  deadlineMs = EDIT_MODEL_TIMEOUT_MS
}: {
  supabase: SupabaseLike;
  siteId: string;
  spec: SiteSpec;
  business: BusinessPayload;
  message: string;
  assets?: Array<{ id: string; label: string }>;
  history?: Array<{ role: "user" | "assistant"; content: string }>;
  /** The draft version `spec` came from. The save is refused if it has moved. */
  expectedParentVersionId?: string | null;
  interpret?: typeof interpretEdit;
  /** Overrides the 25-second edit ceiling. Tests use it; product code does not. */
  deadlineMs?: number;
}, trace: EditTrace): Promise<EditOutcome> => {
  // Accumulated across the first interpretation and any repair attempt, because
  // "what did this edit cost" is a question about the whole request.
  const usage = emptyModelUsage();
  const record = (next: ModelUsage) => {
    usage.attempts += next.attempts;
    usage.durationMs += next.durationMs;
    usage.promptTokens += next.promptTokens;
    usage.completionTokens += next.completionTokens;
  };

  // One edit gets ONE ceiling's worth of model time in total. The bounded repair
  // is worth having, but not at the cost of the owner waiting through a second
  // full timeout — so it only runs if there is budget left.
  const deadline = Date.now() + deadlineMs;

  /**
   * The ceiling has to belong to the EDIT, not to one network call.
   *
   * `timeoutMs` reaches the provider SDK, which applies it per request — and the
   * SDK is allowed to retry. Three attempts at twenty-five seconds is
   * seventy-five, before a repair pass, and Stage 3E measured exactly that: an
   * edit answering after fifty seconds against a "hard" twenty-five second
   * ceiling, having written a version the owner had stopped waiting for.
   *
   * A deadline is only a deadline if something enforces it from outside the work
   * it bounds. This does. Whatever is still running loses the race, and because
   * every write happens after this point in the function, losing the race means
   * nothing was written — the abandoned work has nothing left to do but finish
   * quietly and be discarded.
   */
  const withinDeadline = async <T,>(work: Promise<T>, onExpiry: () => T): Promise<T> => {
    const remaining = deadline - Date.now();
    if (remaining <= 0) return onExpiry();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const expiry = new Promise<T>((resolve) => {
      timer = setTimeout(() => resolve(onExpiry()), remaining);
    });
    try {
      return await Promise.race([work, expiry]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  };

  const timedOutInterpretation = (): InterpretResult => ({
    ok: false,
    reason: "timeout",
    message: "the edit deadline passed before the model answered",
    attempts: 0,
    usage: emptyModelUsage()
  });

  let interpreted = await withinDeadline(
    interpret({ message, spec, assets, history }),
    timedOutInterpretation
  );
  record(interpreted.usage);

  if (!interpreted.ok) {
    return {
      changed: false,
      usage,
      ops: [],
      rejections: [],
      warnings: [],
      diagnostics: { stage: "model", detail: interpreted.reason },
      reply:
        interpreted.reason === "timeout"
          ? "That took too long to work out — your site is exactly as it was. Try again?"
          : "I couldn't work out what to change there. Your site is untouched — try saying it another way."
    };
  }

  // The model recognised the request as something that belongs in Business.
  if ("notAWebsiteChange" in interpreted && interpreted.notAWebsiteChange) {
    return {
      changed: false,
      usage,
      ops: [],
      rejections: [],
      warnings: [],
      reply: interpreted.notAWebsiteChange
    };
  }

  // A fact true of every site, which no operation can move ("put the menu at the
  // top"). The model only names WHICH fact; the words are ours.
  if ("alreadyTrue" in interpreted && interpreted.alreadyTrue) {
    return {
      changed: false,
      noOp: true,
      usage,
      ops: [],
      rejections: [],
      warnings: [],
      reply: ALREADY_TRUE_REPLIES[interpreted.alreadyTrue]
    };
  }

  // Every operation the model proposed was unmappable — a shape that does not
  // exist, or one missing a field it needs. Stage 3G found five sites in a row
  // answering "I'm not sure what to change there" to a request the model had
  // understood perfectly ("add a caption to the gallery section"), because the
  // malformed operations were dropped in silence and the list was then empty, so
  // the bounded repair — which exists for exactly this — never ran. It runs now,
  // told what was wrong, and only then does the owner get that sentence.
  if (!interpreted.ops.length && interpreted.dropped > 0) {
    const remaining = deadline - Date.now();
    if (remaining > 3_000) {
      trace.repair.attempted = true;
      const retry = await withinDeadline(
        interpret({
          message: `${message}\n\n(Your previous attempt was rejected: ${describeDroppedOps(("droppedOps" in interpreted && interpreted.droppedOps) || [])})`,
          spec,
          assets,
          history,
          timeoutMs: remaining
        }),
        timedOutInterpretation
      );
      record(retry.usage);
      if (retry.ok && retry.ops.length) {
        trace.repair.succeeded = true;
        interpreted = retry;
      }
    }
  }

  if (!interpreted.ops.length) {
    return {
      changed: false,
      usage,
      ops: [],
      rejections: [],
      warnings: [],
      diagnostics: interpreted.dropped > 0 ? { stage: "model", detail: `dropped ${interpreted.dropped} operation(s)` } : undefined,
      reply: "I'm not sure what to change there. Can you tell me which part of the page you mean?"
    };
  }

  // Authorization runs on every edit, model-authored or not.
  const decision = authorizeOps(interpreted.ops, { spec, business });

  if (!decision.authorized.length) {
    return {
      changed: false,
      usage,
      ops: [],
      rejections: decision.rejected,
      warnings: decision.warnings,
      reply: decision.rejected.map((rejection) => rejection.message).join(" ")
    };
  }

  let applied = applyOps(spec, decision.authorized, { assets });
  let authorized = decision.authorized;
  // An explicit, checkable constraint in the owner's own words ("shorter"),
  // checked the way contrast is: before anything is saved.
  const expectations: Expectation[] = ("expectations" in interpreted && interpreted.expectations) || [];
  /**
   * Stage 3G.2. Two post-conditions now, checked the same way and repaired the
   * same way: what the OWNER asked for in words the code understands ("shorter"),
   * and what the MODEL said would be true, in the closed vocabulary of
   * lib/site-spec/expectations.ts. Neither can authorise anything — both can only
   * turn a save into a repair, and then into an honest refusal.
   */
  trace.expectations.stated = expectations.length;
  const unmetExpectations = (from: SiteSpec, to: SiteSpec) => {
    const failures = checkExpectations(expectations, from, to);
    trace.expectations.failed = failures.length;
    return failures;
  };
  let unmet = applied.ok ? unmetLengthRequest(message, spec, authorized) : null;
  let broken = applied.ok ? unmetExpectations(spec, applied.spec) : [];

  // ONE bounded repair. Generation already feeds validation issues back to the
  // model; editing needs the same, because ordinary requests ("make it feel more
  // premium") routinely land one token outside what the renderer accepts, and
  // refusing outright makes the product look broken when it is merely strict.
  const remaining = deadline - Date.now();
  // A refusal the owner is told in plain words — "you already have a gallery",
  // "the page is full" — is a product rule, not a malformed answer, and no
  // second attempt can legitimately get past it. Stage 3F.2's rehearsal spent a
  // second model call on every duplicate request (ten per cohort run) and added
  // seconds to the reply for nothing. Only repairable failures are repaired.
  const final = !applied.ok && applied.reason === "unapplicable" && ownerReadableRefusal(applied) !== null;
  if (((!applied.ok && !final) || unmet || broken.length) && remaining > 3_000) {
    trace.repair.attempted = true;
    const feedback = !applied.ok
      ? `${describeFailure(applied)} ${repairAdvice(applied)}`
      : unmet
        ? unmet.feedback
        : `${describeExpectationFailures(broken)}. Propose operations that actually bring this about, or say plainly that it cannot be done.`;
    const retry = await withinDeadline(
      interpret({
        message: `${message}\n\n(Your previous attempt was rejected: ${feedback})`,
        spec,
        assets,
        history,
        timeoutMs: remaining
      }),
      timedOutInterpretation
    );
    record(retry.usage);

    if (retry.ok && retry.ops.length) {
      const retryDecision = authorizeOps(retry.ops, { spec, business });
      if (retryDecision.authorized.length) {
        const second = applyOps(spec, retryDecision.authorized, { assets });
        const stillBroken = second.ok ? unmetExpectations(spec, second.spec) : [];
        if (second.ok && !unmetLengthRequest(message, spec, retryDecision.authorized) && !stillBroken.length) {
          trace.repair.succeeded = true;
          unmet = null;
          broken = [];
          applied = second;
          authorized = retryDecision.authorized;
          decision.rejected.push(...retryDecision.rejected);
          decision.warnings.push(...retryDecision.warnings);
        }
      }
    }
  }

  if (!applied.ok) {
    return {
      changed: false,
      usage,
      ops: authorized,
      rejections: decision.rejected,
      warnings: decision.warnings,
      diagnostics: { stage: "apply", detail: describeFailure(applied) },
      reply: explainApplyFailure(applied)
    };
  }

  // The model said something would be true of the site and it is not. Saving it
  // would be a change nobody asked for, reported as the one that was.
  if (applied.ok && !unmet && broken.length) {
    return {
      changed: false,
      usage,
      ops: authorized,
      rejections: decision.rejected,
      warnings: decision.warnings,
      diagnostics: { stage: "apply", detail: `expectation not met: ${summariseExpectationFailures(broken).slice(0, 200)}` },
      reply:
        "I couldn't make that change come out the way you asked, so I've left the site as it was. " +
        "Try saying it a different way, or tell me exactly what you'd like it to look like."
    };
  }

  // The owner asked for it shorter, and it is not. Saving it would be a change
  // they did not ask for, reported as the one they did.
  if (applied.ok && unmet) {
    return {
      changed: false,
      usage,
      ops: authorized,
      rejections: decision.rejected,
      warnings: decision.warnings,
      diagnostics: { stage: "apply", detail: "length request not met" },
      reply: unmet.reply
    };
  }

  // THE NO-OP GUARD (Stage 3F.2).
  //
  // "The operations applied" and "the website changed" are different claims, and
  // until this line they were treated as one: in the Stage 3F.1 run, 40 of 134
  // edits that reported a change wrote a version byte-identical to its parent and
  // told the owner "Changed the heading font." So the site is compared, by the
  // same semantic fingerprint the measurement uses, BEFORE anything is written.
  // If nothing a visitor could see would differ, no version is created, the
  // draft pointer does not move, and the owner is told the site already looks
  // that way — in terms of what it IS, not of what was attempted.
  if (sameWebsite(spec, applied.spec)) {
    return {
      changed: false,
      noOp: true,
      usage,
      ops: authorized,
      rejections: decision.rejected,
      warnings: decision.warnings,
      reply: composeReply(describeUnchanged(authorized, spec).replace(/\.$/, ""), decision.rejected, decision.warnings)
    };
  }

  // The reply, and the history label, describe what actually changed — read off
  // the difference between the two specs, never off the operation names.
  const label = describeObservedChange(spec, applied.spec).replace(/\.$/, "");
  const saved = await saveDraftSpec(supabase, siteId, applied.spec, {
    source: "edit",
    label,
    expectedParentVersionId
  });
  if (!saved.ok) {
    // A conflict is not a fault, and pretending it is would be the worst of the
    // available lies: the owner would be told to retry a change that would then
    // silently discard whatever the other session had just accepted.
    if (saved.reason === "conflict") {
      return {
        changed: false,
        usage,
        conflict: true,
        ops: authorized,
        rejections: decision.rejected,
        warnings: decision.warnings,
        diagnostics: { stage: "save", detail: "stale draft" },
        reply:
          "Your website changed somewhere else while I was working on this, so I haven't applied it — that would have undone the other change. Reload and ask me again."
      };
    }
    return {
      changed: false,
      usage,
      ops: authorized,
      rejections: decision.rejected,
      warnings: decision.warnings,
      diagnostics: { stage: "save", detail: saved.reason },
      reply: "I made that change but couldn't save it. Nothing has changed — try again."
    };
  }

  return {
    changed: true,
    usage,
    ops: authorized,
    rejections: decision.rejected,
    warnings: decision.warnings,
    spec: applied.spec,
    version: saved.value,
    undoToVersionId: saved.value.parentVersionId,
    reply: composeReply(label, decision.rejected, decision.warnings)
  };
};

// ─────────────────────────────────────────────────────────────────────────────
// Replies
// ─────────────────────────────────────────────────────────────────────────────

/**
 * The owner-facing sentence. Built from the operations that actually applied,
 * plus anything that was refused — so the reply can never claim a change the
 * system did not make.
 */
const composeReply = (label: string, rejections: OpRejection[], warnings: OpWarning[]): string => {
  const parts: string[] = [`${label}.`];

  if (rejections.length) {
    parts.push(rejections.map((rejection) => rejection.message).join(" "));
  }
  if (warnings.length) {
    parts.push(warnings[0].message);
  }

  return parts.join(" ");
};

/** The failure, in terms a model can act on. Not shown to the owner. */
const describeFailure = (result: Extract<ReturnType<typeof applyOps>, { ok: false }>): string => {
  if (result.reason === "unapplicable") return `operation ${result.opIndex} could not apply — ${result.message}.`;
  if (result.reason === "invalid_op") {
    return `the operations were malformed: ${result.issues.map((i) => `${i.path}: ${i.message}`).join("; ")}.`;
  }
  if (result.reason === "invalid_result") {
    return `the resulting site failed validation: ${result.issues.map((i) => `${i.path}: ${i.message}`).join("; ")}.`;
  }
  return "the change could not be applied.";
};

// ─────────────────────────────────────────────────────────────────────────────
// Checkable requests
// ─────────────────────────────────────────────────────────────────────────────

/** Words that make a copy request a request about LENGTH. Deliberately narrow. */
const SHORTER = /\b(shorter|shorten|more concise|briefer)\b/i;

/** The current text a copy target points at, for the fields a length request can mean. */
const readCopy = (spec: SiteSpec, op: Extract<SiteSpecOp, { op: "set_copy" }>): string | undefined => {
  const target = op.target as { field: string; sectionId?: string };
  const hero = spec.sections.find((section) => section.type === "hero") as any;
  switch (target.field) {
    case "hero.headline":
      return typeof hero?.headline === "string" ? hero.headline : undefined;
    case "hero.body":
      return typeof hero?.body === "string" ? hero.body : undefined;
    case "hero.eyebrow":
      return typeof hero?.eyebrow === "string" ? hero.eyebrow : undefined;
    case "hero.primaryCta":
      return typeof hero?.primaryCta?.label === "string" ? hero.primaryCta.label : undefined;
    case "hero.secondaryCta":
      return typeof hero?.secondaryCta?.label === "string" ? hero.secondaryCta.label : undefined;
    case "nav.cta":
      return typeof (spec as any)?.nav?.cta?.label === "string" ? (spec as any).nav.cta.label : undefined;
    case "section.cta": {
      const section = spec.sections.find((s) => s.id === target.sectionId) as any;
      return typeof section?.cta?.label === "string" ? section.cta.label : undefined;
    }
    case "section.title":
    case "section.sub": {
      const section = spec.sections.find((s) => s.id === target.sectionId) as any;
      const value = target.field === "section.title" ? section?.heading?.title : section?.heading?.sub;
      return typeof value === "string" ? value : undefined;
    }
    default:
      return undefined;
  }
};

/**
 * "Make the headline shorter" is a request with a measurable meaning, and the
 * Stage 3F.2 rehearsal showed the model meeting it by WORDS and missing it by
 * characters. Stage 3G then found the check reaching only headlines and section
 * text: asked to shorten the BUTTON at the top, the model rewrote the headline
 * instead and nothing noticed, because no CTA label was readable here. Every
 * label a "shorter" request can mean is readable now — "Relax with Our Treatment" (24) became "Experience True
 * Relaxation" (26), three runs out of three, and the owner was told the headline
 * had been rewritten. So when the owner asks for shorter, a rewrite that is not
 * shorter goes back through the one bounded repair with the real counts, and if
 * it still is not shorter nothing is saved and the owner is told so.
 *
 * Nothing is relaxed: this can only turn a save into a refusal.
 */
const unmetLengthRequest = (
  message: string,
  spec: SiteSpec,
  ops: SiteSpecOp[]
): { feedback: string; reply: string } | null => {
  if (!SHORTER.test(message)) return null;
  for (const op of ops) {
    if (op.op !== "set_copy") continue;
    const current = readCopy(spec, op);
    const next = op.value.trim();
    if (current === undefined || !next) continue;
    if (next.length >= current.length) {
      const what = op.target.field === "hero.headline"
        ? "headline"
        : op.target.field.endsWith("Cta") || op.target.field.endsWith(".cta")
          ? "button label"
          : "text";
      return {
        feedback:
          `the owner asked for the ${what} to be SHORTER. It is ${current.length} characters now and your ` +
          `version is ${next.length}. Write one with at most ${current.length - 1} characters — count them.`,
        reply: `I couldn't find a shorter ${what} I was happy with, so I left it as it was. If you tell me the words you'd like, I'll use them.`
      };
    }
  }
  return null;
};

/**
 * What was wrong with operations that could not be mapped at all.
 *
 * Named by shape rather than passed through: the model gets the fields its own
 * operation was missing, which is what it needs to try again, and nothing here
 * can reach an owner.
 */
const describeDroppedOps = (dropped: Array<{ op: string; [key: string]: unknown }>): string => {
  if (!dropped.length) return "none of your operations could be used. Propose a corrected set.";
  const reasons = dropped.map((op) => {
    if (op.op === "set_copy" && String(op.field) === "gallery.caption" && op.index == null) {
      return `set_copy gallery.caption needs "index" — which photo. A line under a section's heading is set_copy "section.sub" with that section's id.`;
    }
    if (op.op === "set_copy" && String(op.field).startsWith("section.") && !op.sectionId) {
      return `set_copy ${op.field} needs "sectionId".`;
    }
    if (op.op === "bind_asset") return `bind_asset needs a slot, and an asset id you were given.`;
    return `${op.op} was missing a field it needs, or named something that does not exist.`;
  });
  return `${[...new Set(reasons)].join(" ")} Propose a corrected set of operations that uses the fields listed above.`;
};

/**
 * What the repair attempt is asked to do about the failure.
 *
 * It used to end every repair with "Propose a corrected, smaller set of
 * operations" — and a contrast failure is exactly the case where the fix is one
 * operation MORE: keep the warmer accent and change the text colour on it. The
 * Stage 3F.2 replay showed the repair re-proposing the identical failing colour
 * twice in three runs. Nothing here loosens a check; it says which pair failed
 * and that changing the partner colour is allowed.
 */
const repairAdvice = (result: Extract<ReturnType<typeof applyOps>, { ok: false }>): string => {
  const issues = result.reason === "invalid_result" ? result.issues : [];
  if (issues.some((issue) => /accentInk/.test(issue.path) || /accentInk/.test(issue.message))) {
    return (
      "Keep the change the owner asked for if you can, and ALSO set palette.accentInk so the text on " +
      "the accent colour reaches 3:1 — a dark accentInk on a light accent, a light one on a dark accent. " +
      "If no such pair exists, choose a different accent that passes."
    );
  }
  if (issues.some((issue) => /contrast/i.test(issue.message))) {
    return (
      "Keep the change the owner asked for if you can, and ALSO adjust the partner colour so body text " +
      "(palette.ink on palette.background) reaches 4.5:1. If no such pair exists, choose values that pass."
    );
  }
  if (result.reason === "unapplicable" && result.op.op === "reorder_sections") {
    return "Return the reorder again with EVERY section id exactly once, starting from CURRENT ORDER.";
  }
  return "Propose a corrected set of operations.";
};

/**
 * What the owner is told when an operation could not be applied.
 *
 * Composed from the KIND of change that was attempted, never from the internal
 * diagnostic — a measured Stage 2.5 run produced the reply
 * `I couldn't do that — "#F5EFE6},{" is not a usable value for palette.background.`
 * which names an internal path and shows the owner a mangled model artefact.
 * The diagnostic still goes to the log, where it belongs.
 */
const describeAttempt = (op: SiteSpecOp): string => {
  switch (op.op) {
    case "set_token":
      return op.path.startsWith("palette.")
        ? "that colour change"
        : "that look-and-feel change";
    case "set_copy":
      return "that wording change";
    case "set_layout":
    case "set_presentation":
    case "reorder_sections":
    case "remove_section":
      return "that layout change";
    case "bind_asset":
    case "unbind_asset":
      return "that image change";
    case "set_terminology":
      return "that wording change";
    case "set_nav":
      return "that menu change";
    case "set_footer":
      return "that footer change";
    default:
      return "that change";
  }
};

/**
 * Refusals an owner can act on, said plainly.
 *
 * Most applier messages are written for a repair prompt and a log — precise,
 * internal, and no help at all to the person who just asked for something. But a
 * few refusals are not failures of understanding at all: the request was
 * understood perfectly and declined for a reason the owner would immediately
 * accept if anyone told them. "You already have a gallery" is a complete answer.
 * "It didn't come through in a form I can use" is the system apologising for the
 * owner's own page.
 *
 * Curated rather than pass-through: only these shapes are spoken, so an applier
 * message can never become the route by which internal wording reaches a page.
 */
const ownerReadableRefusal = (
  result: Extract<ReturnType<typeof applyOps>, { ok: false; reason: "unapplicable" }>
): string | null => {
  if (result.op.op !== "insert_section") return null;
  const kind = result.op.section === "booking" ? "booking section" : "gallery";
  if (/already has a/.test(result.message)) {
    return `Your site already has a ${kind}, so I haven't added a second one. If you'd like it to look different, or to move somewhere else on the page, just say so.`;
  }
  if (/as many sections as it can hold/.test(result.message)) {
    return `Your page is already as long as it can be, so I haven't added the ${kind}. Remove a section you no longer need and ask me again.`;
  }
  return null;
};

const explainApplyFailure = (result: Extract<ReturnType<typeof applyOps>, { ok: false }>): string => {
  if (result.reason === "unapplicable") {
    const readable = ownerReadableRefusal(result);
    if (readable) return readable;
    return `I couldn't make ${describeAttempt(result.op)} — it didn't come through in a form I can use. Your site is exactly as it was, so try saying it another way.`;
  }
  if (result.reason === "invalid_result") {
    const first = result.issues[0];
    // Contrast is the one a person can act on, so name it specifically.
    if (first && /contrast/i.test(first.message)) {
      return "That combination would leave text too faint to read, so I've left the site as it was. Try a stronger contrast.";
    }
    return "That change would have left the site in a state I can't render, so I've left it as it was.";
  }
  return "I couldn't apply that change. Your site is exactly as it was.";
};

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
import { emptyModelUsage, type ModelUsage } from "@/lib/site-spec/ai/client";
import { generateSiteSpec } from "@/lib/site-spec/ai/generate";
import { interpretEdit } from "@/lib/site-spec/ai/edit";
import { authorizeOps, type OpRejection, type OpWarning } from "@/lib/site-spec/authorize";
import { applyOps, describeOps, type SiteSpecOp } from "@/lib/site-spec/ops";
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
};

/**
 * Interpret a message, authorize it, apply it, and save a new draft version.
 *
 * Every failure path leaves the draft untouched — an edit either lands whole or
 * does not land at all.
 */
export const runEdit = async ({
  supabase,
  siteId,
  spec,
  business,
  message,
  assets = [],
  history = [],
  expectedParentVersionId = null,
  interpret = interpretEdit
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
}): Promise<EditOutcome> => {
  // Accumulated across the first interpretation and any repair attempt, because
  // "what did this edit cost" is a question about the whole request.
  const usage = emptyModelUsage();
  const record = (next: ModelUsage) => {
    usage.attempts += next.attempts;
    usage.durationMs += next.durationMs;
    usage.promptTokens += next.promptTokens;
    usage.completionTokens += next.completionTokens;
  };

  const interpreted = await interpret({ message, spec, assets, history });
  record(interpreted.usage);

  if (!interpreted.ok) {
    return {
      changed: false,
      usage,
      ops: [],
      rejections: [],
      warnings: [],
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

  if (!interpreted.ops.length) {
    return {
      changed: false,
      usage,
      ops: [],
      rejections: [],
      warnings: [],
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

  let applied = applyOps(spec, decision.authorized);
  let authorized = decision.authorized;

  // ONE bounded repair. Generation already feeds validation issues back to the
  // model; editing needs the same, because ordinary requests ("make it feel more
  // premium") routinely land one token outside what the renderer accepts, and
  // refusing outright makes the product look broken when it is merely strict.
  if (!applied.ok) {
    const retry = await interpret({
      message: `${message}\n\n(Your previous attempt was rejected: ${describeFailure(applied)} Propose a corrected, smaller set of operations.)`,
      spec,
      assets,
      history
    });
    record(retry.usage);

    if (retry.ok && retry.ops.length) {
      const retryDecision = authorizeOps(retry.ops, { spec, business });
      if (retryDecision.authorized.length) {
        const second = applyOps(spec, retryDecision.authorized);
        if (second.ok) {
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

  const label = describeOps(authorized);
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

const explainApplyFailure = (result: Extract<ReturnType<typeof applyOps>, { ok: false }>): string => {
  if (result.reason === "unapplicable") {
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

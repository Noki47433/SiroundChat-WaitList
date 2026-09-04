/**
 * Start or generate a website from a short request.
 *
 * Two shapes of response:
 *   · `needs_clarification` — up to three questions, asked before any model work
 *   · `generated` — a new DRAFT version. This endpoint cannot publish.
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { retrieveRelevantChunks } from "@/lib/ai/retrieve";
import {
  claimRequestOnce,
  duplicateRequestResponse,
  guardSiteRequest,
  limitModelWork,
  loadAssetChoices,
  logSiteSpecEvent,
  startTimer
} from "@/lib/site-spec/api/guard";
import { CLARIFICATION_TOPICS, type ClarificationAnswer } from "@/lib/site-spec/clarify";
import { runGeneration, startSite } from "@/lib/site-spec/ai/session";
import { getSiteSpecState } from "@/lib/site-spec/store";

export const runtime = "nodejs";

const PayloadSchema = z.object({
  siteId: z.string().uuid(),
  request: z.string().trim().min(1).max(600),
  /**
   * The draft the client was looking at, or null for a site with none.
   * Regenerating over a draft that has moved is refused, exactly as an edit is.
   */
  baseVersionId: z.string().uuid().nullable().default(null),
  /** Opaque per-submission key so a duplicate delivery is recognisable. */
  requestId: z.string().trim().min(8).max(64).optional(),
  answers: z
    .array(
      z.object({
        topic: z.enum(CLARIFICATION_TOPICS),
        optionId: z.string().trim().min(1).max(40),
        answerLabel: z.string().trim().min(1).max(120),
        chosenForYou: z.boolean()
      })
    )
    .max(3)
    .default([]),
  /** Set once the owner has seen the questions and wants to proceed regardless. */
  proceed: z.boolean().default(false)
});

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = PayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "That request didn't make sense." }, { status: 400 });
  }

  const guard = await guardSiteRequest(parsed.data.siteId);
  if (!guard.ok) return guard.response;
  const { context } = guard;

  const answers = parsed.data.answers as ClarificationAnswer[];
  const assets = await loadAssetChoices(context.supabase, context.siteId);

  // Ask before spending anything, unless the owner has chosen to proceed.
  if (!parsed.data.proceed) {
    const start = startSite({
      business: context.business,
      request: parsed.data.request,
      assets: assets.map((asset) => ({ id: asset.id, kind: "image" })),
      answered: answers
    });
    if (start.status === "needs_clarification") {
      logSiteSpecEvent("CLARIFY", {
        siteId: context.siteId,
        asked: start.questions.length,
        alreadyAnswered: answers.length
      });
      return NextResponse.json({ status: "needs_clarification", questions: start.questions });
    }
  }

  // Same two guards as an edit. Generation needs the request claim more than an
  // edit does: a first draft has no parent version, so a duplicate delivery has
  // nothing else standing between it and a second full generation.
  const state = await getSiteSpecState(context.supabase, context.siteId);
  const currentDraftId = state.ok ? state.value.draftVersionId : null;
  if (currentDraftId !== parsed.data.baseVersionId) {
    logSiteSpecEvent("GENERATE_CONFLICT", {
      siteId: context.siteId,
      claimed: parsed.data.baseVersionId,
      current: currentDraftId
    });
    return NextResponse.json(
      {
        error: "version_conflict",
        status: "failed",
        currentVersionId: currentDraftId,
        reply:
          "Your website changed somewhere else while you were writing that. Reload so we're both looking at the same site, then ask again."
      },
      { status: 409 }
    );
  }

  if (!(await claimRequestOnce("generate", context.businessId, parsed.data.requestId))) {
    logSiteSpecEvent("GENERATE_DUPLICATE", { siteId: context.siteId });
    return duplicateRequestResponse();
  }

  const limited = await limitModelWork(context.businessId, "generate");
  if (limited) return limited;

  // Knowledge informs story and tone only; the authority rules live in the brief.
  const knowledge = await retrieveRelevantChunks({
    businessId: context.businessId,
    query: parsed.data.request,
    limit: 4
  }).catch(() => ({ chunks: [] }));

  const elapsed = startTimer();
  const outcome = await runGeneration({
    supabase: context.supabase,
    siteId: context.siteId,
    business: context.business,
    request: parsed.data.request,
    answered: answers,
    knowledge: (knowledge.chunks ?? []).map((chunk: any) => ({
      source: chunk.documentName ?? chunk.source ?? "your documents",
      text: String(chunk.content ?? chunk.text ?? "")
    })),
    assets: assets.map((asset) => ({ id: asset.id, kind: "image" })),
    now: new Date().toISOString(),
    expectedParentVersionId: currentDraftId
  });
  const durationMs = elapsed();

  if (!outcome.ok) {
    logSiteSpecEvent("GENERATE_FAILED", {
      siteId: context.siteId,
      businessId: context.businessId,
      durationMs,
      modelMs: outcome.usage.durationMs,
      modelAttempts: outcome.usage.attempts,
      promptTokens: outcome.usage.promptTokens,
      completionTokens: outcome.usage.completionTokens,
      reason: outcome.reason
    });
    if (outcome.reason === "conflict") {
      return NextResponse.json({ status: "failed", error: "version_conflict", reply: outcome.reply }, { status: 409 });
    }
    return NextResponse.json({ status: "failed", reply: outcome.reply }, { status: outcome.recoverable ? 503 : 501 });
  }

  logSiteSpecEvent("GENERATED", {
    siteId: context.siteId,
    businessId: context.businessId,
    durationMs,
    modelMs: outcome.usage.durationMs,
    modelAttempts: outcome.usage.attempts,
    repaired: outcome.usage.attempts > 1,
    promptTokens: outcome.usage.promptTokens,
    completionTokens: outcome.usage.completionTokens,
    versionNumber: outcome.version.versionNumber,
    sections: outcome.spec.sections.length,
    decisions: outcome.decisions.length
  });

  return NextResponse.json({
    status: "generated",
    reply: outcome.reply,
    spec: outcome.spec,
    decisions: outcome.decisions,
    version: { id: outcome.version.id, number: outcome.version.versionNumber, label: outcome.version.label }
  });
}

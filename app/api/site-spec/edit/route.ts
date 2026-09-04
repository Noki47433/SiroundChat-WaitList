/**
 * One conversational edit.
 *
 * Interprets the message as structured operations, authorizes them, applies them
 * and saves a new DRAFT version. The published site is never touched here.
 *
 * Stage 2.5 added two guards around that, both about not losing work:
 *
 *  · **`baseVersionId` is required.** The client says which draft it is editing.
 *    If the draft has moved — another tab, another owner, a slow request that
 *    overtook a fast one — the edit is refused with 409 rather than applied on
 *    top. It is checked twice: cheaply before the model is called, and again
 *    atomically inside the version-creating function, because the model call
 *    itself takes seconds and the world can move during it.
 *  · **`requestId` claims the request once.** A retry or a double-click gets the
 *    same 409 instead of a second model call and a second version.
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import {
  claimRequestOnce,
  duplicateRequestResponse,
  guardSiteRequest,
  limitModelWork,
  loadAssetChoices,
  logSiteSpecEvent,
  startTimer
} from "@/lib/site-spec/api/guard";
import { runEdit } from "@/lib/site-spec/ai/session";
import { getDraftVersion } from "@/lib/site-spec/store";

export const runtime = "nodejs";

const PayloadSchema = z.object({
  siteId: z.string().uuid(),
  message: z.string().trim().min(1).max(800),
  /** The draft the client is looking at. Required — an edit always has a parent. */
  baseVersionId: z.string().uuid(),
  /** Opaque per-submission key so a duplicate delivery is recognisable. */
  requestId: z.string().trim().min(8).max(64).optional(),
  history: z
    .array(
      z.object({
        role: z.enum(["user", "assistant"]),
        content: z.string().max(800)
      })
    )
    .max(12)
    .default([])
});

/** The one answer a stale edit gets, wherever it was detected. */
const conflictResponse = (currentVersionId: string | null) =>
  NextResponse.json(
    {
      error: "version_conflict",
      changed: false,
      currentVersionId,
      reply:
        "Your website changed somewhere else while I was working on this, so I haven't applied it — that would have undone the other change. Reload and ask me again."
    },
    { status: 409 }
  );

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = PayloadSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "That request didn't make sense." }, { status: 400 });
  }

  const guard = await guardSiteRequest(parsed.data.siteId);
  if (!guard.ok) return guard.response;
  const { context } = guard;

  const draft = await getDraftVersion(context.supabase, context.siteId);
  if (!draft.ok) {
    return NextResponse.json({ error: "That website can't be read right now." }, { status: 409 });
  }
  if (!draft.value) {
    return NextResponse.json({ error: "There's no draft to edit yet." }, { status: 409 });
  }

  // Cheap pre-check: refuse a stale edit before spending a model call on it.
  if (draft.value.id !== parsed.data.baseVersionId) {
    logSiteSpecEvent("EDIT_CONFLICT", {
      siteId: context.siteId,
      stage: "precheck",
      claimed: parsed.data.baseVersionId,
      current: draft.value.id
    });
    return conflictResponse(draft.value.id);
  }

  if (!(await claimRequestOnce("edit", context.businessId, parsed.data.requestId))) {
    logSiteSpecEvent("EDIT_DUPLICATE", { siteId: context.siteId });
    return duplicateRequestResponse();
  }

  const limited = await limitModelWork(context.businessId, "edit");
  if (limited) return limited;

  const elapsed = startTimer();
  const outcome = await runEdit({
    supabase: context.supabase,
    siteId: context.siteId,
    spec: draft.value.spec,
    business: context.business,
    message: parsed.data.message,
    assets: await loadAssetChoices(context.supabase, context.siteId),
    history: parsed.data.history,
    expectedParentVersionId: draft.value.id
  });
  const durationMs = elapsed();

  logSiteSpecEvent("EDIT", {
    siteId: context.siteId,
    businessId: context.businessId,
    durationMs,
    modelMs: outcome.usage.durationMs,
    modelAttempts: outcome.usage.attempts,
    repaired: outcome.usage.attempts > 1,
    promptTokens: outcome.usage.promptTokens,
    completionTokens: outcome.usage.completionTokens,
    changed: outcome.changed,
    conflict: outcome.conflict ?? false,
    operations: outcome.ops.length,
    rejected: outcome.rejections.length,
    warnings: outcome.warnings.length,
    stage: outcome.diagnostics?.stage ?? null,
    // Field names and constraints only — never the owner's words or copy.
    failure: outcome.diagnostics?.detail?.slice(0, 300) ?? null
  });

  // The atomic guard fired: someone landed a change during the model call.
  if (outcome.conflict) {
    const now = await getDraftVersion(context.supabase, context.siteId);
    return conflictResponse(now.ok ? (now.value?.id ?? null) : null);
  }

  return NextResponse.json({
    changed: outcome.changed,
    reply: outcome.reply,
    spec: outcome.spec ?? draft.value.spec,
    version: outcome.version
      ? { id: outcome.version.id, number: outcome.version.versionNumber, label: outcome.version.label }
      : null,
    undoToVersionId: outcome.undoToVersionId ?? null,
    // Reasons only — never the private context that produced them.
    rejections: outcome.rejections.map((rejection) => ({ reason: rejection.reason, message: rejection.message }))
  });
}

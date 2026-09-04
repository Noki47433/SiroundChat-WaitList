/**
 * Undo, and version restore.
 *
 * Restores a previous valid version by appending it forward — the deterministic
 * Stage 1 path. No model is involved, and the published site does not move.
 *
 * Stage 2.5: undo takes the same `baseVersionId` claim as an edit. "Go back one
 * step" is defined relative to the draft the owner can see, so performing it
 * against a draft that has since moved would step back over somebody else's
 * change — the same silent loss the edit guard exists to prevent, arriving by a
 * different door. Restoring a *named* version is unaffected by that reasoning
 * and is still allowed while the draft is moving, because the owner asked for
 * that exact version rather than for "one back from here".
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { guardSiteRequest, logSiteSpecEvent, logSiteSpecFailure } from "@/lib/site-spec/api/guard";
import { getSiteSpecState, restoreVersion, undoLastChange } from "@/lib/site-spec/store";

export const runtime = "nodejs";

const PayloadSchema = z.object({
  siteId: z.string().uuid(),
  /** Omitted means "go back one step". */
  versionId: z.string().uuid().optional(),
  /** The draft the client is looking at. Checked for a step-back undo. */
  baseVersionId: z.string().uuid().nullable().default(null)
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

  if (!parsed.data.versionId && parsed.data.baseVersionId) {
    const state = await getSiteSpecState(context.supabase, context.siteId);
    const current = state.ok ? state.value.draftVersionId : null;
    if (current !== parsed.data.baseVersionId) {
      logSiteSpecEvent("UNDO_CONFLICT", {
        siteId: context.siteId,
        claimed: parsed.data.baseVersionId,
        current
      });
      return NextResponse.json(
        {
          error: "version_conflict",
          currentVersionId: current,
          reply:
            "Your website moved on since that change, so going back one step would undo something else. Reload to see where it is now."
        },
        { status: 409 }
      );
    }
  }

  const result = parsed.data.versionId
    ? await restoreVersion(context.supabase, context.siteId, parsed.data.versionId)
    : await undoLastChange(context.supabase, context.siteId);

  if (!result.ok) {
    if (result.reason === "not_found") {
      return NextResponse.json({ error: "There's nothing earlier to go back to." }, { status: 409 });
    }
    logSiteSpecFailure("RESTORE_FAILED", {
      siteId: context.siteId,
      businessId: context.businessId,
      reason: result.reason
    });
    return NextResponse.json({ error: "Couldn't undo that." }, { status: 500 });
  }

  logSiteSpecEvent("RESTORED", {
    siteId: context.siteId,
    businessId: context.businessId,
    versionNumber: result.value.versionNumber,
    restoredFrom: result.value.restoredFromVersionId,
    explicit: Boolean(parsed.data.versionId)
  });

  return NextResponse.json({
    spec: result.value.spec,
    version: { id: result.value.id, number: result.value.versionNumber, label: result.value.label },
    reply: "Put that back."
  });
}

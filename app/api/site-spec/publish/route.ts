/**
 * Publish — the one place the live website changes, and always by explicit
 * owner action. No AI path reaches this route.
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { guardSiteRequest, logSiteSpecEvent, logSiteSpecFailure } from "@/lib/site-spec/api/guard";
import { publishSite, unpublishSite } from "@/lib/site-spec/store";

export const runtime = "nodejs";

const PayloadSchema = z.object({
  siteId: z.string().uuid(),
  versionId: z.string().uuid().optional(),
  action: z.enum(["publish", "unpublish"]).default("publish")
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

  if (parsed.data.action === "unpublish") {
    const result = await unpublishSite(context.supabase, context.siteId);
    if (!result.ok) {
      logSiteSpecFailure("UNPUBLISH_FAILED", {
        siteId: context.siteId,
        businessId: context.businessId,
        reason: result.reason
      });
      return NextResponse.json({ error: "Couldn't take the site down." }, { status: 500 });
    }
    logSiteSpecEvent("UNPUBLISHED", { siteId: context.siteId });
    return NextResponse.json({ published: false, reply: "Your site is offline again." });
  }

  logSiteSpecEvent("PUBLISH_ATTEMPT", {
    siteId: context.siteId,
    businessId: context.businessId,
    explicitVersion: Boolean(parsed.data.versionId)
  });

  const result = await publishSite(context.supabase, context.siteId, parsed.data.versionId);
  if (!result.ok) {
    // An invalid draft is the interesting failure: say so rather than 500ing.
    // The published pointer has not moved either way, so whatever customers were
    // being served a moment ago is still exactly what they are served now.
    logSiteSpecFailure("PUBLISH_FAILED", {
      siteId: context.siteId,
      businessId: context.businessId,
      reason: result.reason,
      issues: result.reason === "invalid_spec" ? result.issues.length : null
    });
    if (result.reason === "invalid_spec") {
      return NextResponse.json(
        { error: "That version can't be published — something in it isn't valid." },
        { status: 409 }
      );
    }
    return NextResponse.json({ error: "Couldn't publish just then." }, { status: 500 });
  }

  logSiteSpecEvent("PUBLISHED", {
    siteId: context.siteId,
    businessId: context.businessId,
    versionNumber: result.value.publishedVersion.versionNumber
  });

  return NextResponse.json({
    published: true,
    publishedAt: result.value.publishedAt,
    slug: context.slug,
    version: {
      id: result.value.publishedVersion.id,
      number: result.value.publishedVersion.versionNumber
    },
    reply: "That's live now."
  });
}

/**
 * The shared preamble for every Site Spec route.
 *
 * Five rules, each of which exists because of something an audit found:
 *
 *  · **The business comes from the session, never from the request.** A site id
 *    in a request body is a claim, not a fact, so it is checked against the
 *    business the session actually owns before anything else happens.
 *  · **No service-role client.** Every query runs as the signed-in user, so the
 *    row-level security proved in Stage 1.5 is the second lock rather than a
 *    layer that gets bypassed for convenience.
 *  · **Model work is rate limited.** Generation and editing cost money and time;
 *    they are bounded per business using the repo's existing limiter.
 *  · **Rollout is server-authoritative** (Stage 2.5). A business that is not on
 *    the Site Spec model cannot reach any of this by guessing a URL, and the
 *    check fails closed so this code is safe to deploy before the flag exists.
 *  · **A mutating request can be claimed once** (Stage 2.5). A retry or a
 *    double-click must not spend a second model call or append a second version.
 */
import "server-only";
import { NextResponse } from "next/server";

import { loadBusiness, type BusinessPayload } from "@/lib/business/load";
import { requireBusinessUser } from "@/lib/server/business-auth";
import { resolveRolloutState, type SiteSpecRolloutState } from "@/lib/site-spec/rollout";
import { claimRequestOnce } from "@/lib/site-spec/idempotency";
import { logSiteSpecEvent, logSiteSpecFailure } from "@/lib/site-spec/telemetry";
import { enforceRateLimit, RateLimitError } from "@/lib/utils/rate-limit";

export type SiteSpecContext = {
  userId: string;
  businessId: string;
  siteId: string;
  slug: string | null;
  supabase: any;
  business: BusinessPayload;
  rollout: SiteSpecRolloutState;
};

export type GuardResult =
  | { ok: true; context: SiteSpecContext }
  | { ok: false; response: NextResponse };

/** The same answer for "does not exist" and "not yours" and "not rolled out". */
const notFound = () => NextResponse.json({ error: "Site not found" }, { status: 404 });

/**
 * Resolve and authorize a request against one site.
 *
 * `siteId` is accepted from the caller but only ever used as a lookup key that
 * is *filtered by the session's own business* — an id belonging to anyone else
 * simply does not resolve.
 */
export const guardSiteRequest = async (siteId: string): Promise<GuardResult> => {
  const { context, response } = await requireBusinessUser({ entitlement: "website_builder" });
  if (response) return { ok: false, response };

  // Rollout before anything expensive. A business that is off is indistinguish-
  // able from a business whose site does not exist — the flag is not a hint.
  const rollout = await resolveRolloutState(context.supabase, context.businessId);
  if (rollout === "off") {
    logSiteSpecEvent("ROLLOUT_BLOCKED", { businessId: context.businessId, surface: "route" });
    return { ok: false, response: notFound() };
  }

  const { data: site, error } = await context.supabase
    .from("builder_sites")
    .select("id, business_id, slug")
    .eq("id", siteId)
    .eq("business_id", context.businessId)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Could not load that website." }, { status: 500 })
    };
  }
  if (!site) {
    // Deliberately the same answer whether the site does not exist or belongs to
    // someone else — a 403 here would confirm the id is real.
    return { ok: false, response: notFound() };
  }

  const business = await loadBusiness(context.supabase, context.businessId);

  return {
    ok: true,
    context: {
      userId: context.userId,
      businessId: context.businessId,
      siteId: site.id,
      slug: site.slug ?? null,
      supabase: context.supabase,
      business,
      rollout
    }
  };
};

/**
 * Bound an expensive model operation per business.
 *
 * Generation is slower and costlier than an edit, so the two have separate
 * budgets rather than sharing one.
 */
export const limitModelWork = async (
  businessId: string,
  kind: "generate" | "edit"
): Promise<NextResponse | null> => {
  const config =
    kind === "generate"
      ? { limit: 12, windowInSeconds: 60 * 60 }
      : { limit: 60, windowInSeconds: 60 * 10 };

  try {
    await enforceRateLimit({ key: `site-spec:${kind}:${businessId}`, ...config });
    return null;
  } catch (error) {
    if (error instanceof RateLimitError) {
      logSiteSpecEvent("RATE_LIMITED", { businessId, kind });
      return NextResponse.json(
        {
          error:
            kind === "generate"
              ? "That's a lot of new websites in one go. Give it a few minutes."
              : "That's a lot of changes very quickly. Give it a moment and carry on."
        },
        { status: 429 }
      );
    }
    throw error;
  }
};

/** The response a duplicate delivery gets. Never a fabricated success. */
export const duplicateRequestResponse = () =>
  NextResponse.json(
    {
      error: "duplicate_request",
      reply: "That one's already gone through — I've left your site as it is."
    },
    { status: 409 }
  );

/**
 * Telemetry lives in `lib/site-spec/telemetry` so the public booking route can
 * emit events without importing this module's `server-only` auth chain.
 * Re-exported here because every authenticated route already imports the guard.
 */
export { claimRequestOnce };

export {
  logSiteSpecEvent,
  logSiteSpecFailure,
  startTimer,
  type SiteSpecEventFields
} from "@/lib/site-spec/telemetry";

/** The site's own images, labelled for the conversation. Ids only — never URLs to the model. */
export const loadAssetChoices = async (
  supabase: any,
  siteId: string
): Promise<Array<{ id: string; label: string }>> => {
  const { data, error } = await supabase
    .from("builder_site_assets")
    .select("id, kind, created_at")
    .eq("site_id", siteId)
    .order("created_at", { ascending: false })
    .limit(40);

  if (error) {
    logSiteSpecFailure("ASSET_LIST_FAILED", { siteId, code: (error as any)?.code ?? null });
    return [];
  }
  if (!data) return [];
  return (data as Array<{ id: string; kind: string | null }>).map((asset, index) => ({
    id: asset.id,
    label: `${asset.kind ?? "image"} ${index + 1}`
  }));
};

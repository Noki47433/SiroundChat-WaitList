/**
 * The booking runtime boundary for a published website.
 *
 * A visitor to a published site has no session, so the staff availability
 * endpoint cannot serve them. This is the narrow public boundary that can — and
 * it is deliberately the *only* thing website code knows about booking:
 *
 *   website booking panel
 *     → this route (scoped by published slug)
 *     → the existing availability service
 *     → canonical services, team, schedules, breaks, closures, current bookings
 *     → real slots
 *
 * What this route does NOT do, on purpose:
 *   · It never creates, holds or modifies a booking. It is read-only. Taking the
 *     booking stays with the existing SurroundChat channels.
 *   · It contains no slot logic of its own. Every rule — including "a service must
 *     fit entirely inside the availability window" — comes from
 *     `lib/booking/availability-service`, exactly as the assistant gets it.
 *   · It accepts no business id from the caller. The business is derived from a
 *     published site slug, so it can only ever expose a site that is already public.
 *
 * SERVICE-ROLE REVIEW: this route uses the admin client because a public visitor
 * has no session to run RLS against. It is scoped by `slug` + `status='published'`
 * + a `published_version_id`, so it can only read a business that has chosen to
 * publish, and it returns availability only — never customer or booking data.
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { listEligibleWorkers, resolveWorkerDaySlots } from "@/lib/booking/availability-service";
import { resolveRolloutState } from "@/lib/site-spec/rollout";
import { logSiteSpecEvent, logSiteSpecFailure } from "@/lib/site-spec/telemetry";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { enforceRateLimit, RateLimitError } from "@/lib/utils/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Query = z.object({
  slug: z.string().trim().min(1).max(120),
  serviceId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/)
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = Query.safeParse({
    slug: url.searchParams.get("slug"),
    serviceId: url.searchParams.get("serviceId"),
    date: url.searchParams.get("date")
  });
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid query." }, { status: 400 });
  }

  try {
    await enforceRateLimit({
      key: `site-spec:availability:${parsed.data.slug}`,
      limit: 120,
      windowInSeconds: 60
    });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json({ error: "Too many requests." }, { status: 429 });
    }
    throw error;
  }

  const admin = getSupabaseAdminClient() as any;

  // Only a published Site Spec site can expose availability this way.
  const { data: site } = await admin
    .from("builder_sites")
    .select("business_id, published_version_id")
    .eq("slug", parsed.data.slug)
    .eq("status", "published")
    .maybeSingle();

  if (!site?.published_version_id) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }
  const businessId = site.business_id as string;

  // A business whose rollout flag went back to `off` keeps its published Site
  // Spec rows, but stops being served by the Site Spec renderer — so this
  // endpoint must stop answering for it too, or a cached page would keep
  // pulling live availability through a path that is supposed to be dark.
  if ((await resolveRolloutState(admin, businessId)) === "off") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  // The service must belong to this business and be bookable.
  const { data: service } = await admin
    .from("service")
    .select("id, name, base_duration_min, is_active")
    .eq("id", parsed.data.serviceId)
    .eq("business_id", businessId)
    .maybeSingle();

  if (!service || service.is_active === false) {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const { data: location } = await admin
    .from("location")
    .select("id, timezone")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("is_primary", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!location) {
    return NextResponse.json({ available: false, slots: [], reason: "no_location" });
  }

  const now = new Date();
  const common = {
    businessId,
    locationId: location.id as string,
    serviceId: service.id as string,
    dateISO: parsed.data.date,
    now
  };

  // Union across everyone who can perform the service — the same "any available"
  // rule the assistant offers, not a website-specific one.
  //
  // The failure rule for this whole block is one sentence: an engine that cannot
  // answer must produce an ERROR, never an empty list. "No times today" and "we
  // could not find out" look identical to a visitor otherwise, and the second
  // one dressed as the first is how a website quietly turns customers away.
  const slots: Array<{ startAtIso: string; endAtIso: string }> = [];
  try {
    const workers = await listEligibleWorkers(admin, businessId, common.locationId, common.serviceId);
    const seen = new Set<number>();
    for (const worker of workers) {
      const workerSlots = await resolveWorkerDaySlots(admin, { ...common, teamMemberId: worker.id });
      for (const slot of workerSlots) {
        const instant = new Date(slot.startAtIso).getTime();
        if (seen.has(instant)) continue;
        seen.add(instant);
        slots.push({ startAtIso: slot.startAtIso, endAtIso: slot.endAtIso });
      }
    }
  } catch (error) {
    logSiteSpecFailure("BOOKING_RUNTIME_FAILED", {
      businessId,
      serviceId: common.serviceId,
      // Bounded metadata: the shape of the failure, never the query or the data.
      detail: String((error as Error)?.message ?? error).slice(0, 200)
    });
    return NextResponse.json(
      { error: "availability_unavailable", available: false, slots: [] },
      { status: 503 }
    );
  }

  slots.sort((a, b) => new Date(a.startAtIso).getTime() - new Date(b.startAtIso).getTime());

  logSiteSpecEvent("BOOKING_RUNTIME", {
    businessId,
    serviceId: common.serviceId,
    slots: slots.length
  });

  return NextResponse.json({
    available: slots.length > 0,
    timezone: location.timezone ?? null,
    service: { id: service.id, name: service.name, durationMin: service.base_duration_min },
    // Capped: a page shows a handful of times, not a calendar dump.
    slots: slots.slice(0, 12)
  });
}

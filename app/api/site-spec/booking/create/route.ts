/**
 * The public booking write boundary for a published Site Spec website.
 *
 * A visitor has no session, so the existing `POST /api/booking/create` — which
 * begins with `requireBusinessUser` — cannot serve them. That route is the
 * staff/dashboard door. This is the customer door, and it is deliberately the
 * only new production surface this mission adds.
 *
 * What it does NOT do, on purpose:
 *   · It contains **no slot logic of its own**. Every rule — opening hours,
 *     worker schedules, breaks, closures, lead time, existing bookings, and
 *     "a service must fit entirely inside availability" — comes from
 *     `lib/booking/availability{,-service}`, the same engine the assistant and
 *     the availability panel use. There is no second calculator.
 *   · It accepts **no business id, location id or tenant hint from the caller**.
 *     The tenant is derived from a published slug, so a request can only ever
 *     reach a business that has chosen to publish, and a forged id changes
 *     nothing because there is no field to put it in.
 *   · It never trusts the slot the browser is holding. Availability is
 *     **re-derived at write time**, because `create_booking` is the authority on
 *     eligibility, snapshots and the overlap race but deliberately not on
 *     availability — a page left open over lunch must not be able to book a time
 *     that has since closed.
 *
 * SERVICE-ROLE REVIEW: uses the admin client because a public visitor has no
 * session. Scoped by `slug` + `status='published'` + `published_version_id` +
 * the rollout flag + the neutral booking state, then by the canonical engine.
 * It writes exactly one row, through the existing `create_booking` RPC.
 */
import { NextResponse } from "next/server";
import { z } from "zod";

import { buildAvailabilityInput } from "@/lib/booking/availability-service";
import { resolveDayAvailability } from "@/lib/booking/availability";
import { createBooking, createBookingAnyAvailable, BookingCommandError } from "@/lib/booking/command";
import { generateManageToken } from "@/lib/booking/manage-token";
import { getBookingState, writeTargetForState } from "@/lib/booking/migration-state";
import { claimRequestOnce } from "@/lib/site-spec/idempotency";
import { resolveRolloutState } from "@/lib/site-spec/rollout";
import { logSiteSpecEvent, logSiteSpecFailure } from "@/lib/site-spec/telemetry";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { enforceRateLimit, RateLimitError } from "@/lib/utils/rate-limit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const Body = z.object({
  slug: z.string().trim().min(1).max(120),
  serviceId: z.string().uuid(),
  /** Omitted or "any" means "whoever is free" — resolved by the canonical engine. */
  teamMemberId: z.string().uuid().nullable().optional(),
  /** The local date the slot was offered for, "YYYY-MM-DD". */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startAt: z.string().datetime({ offset: true }),
  customerName: z.string().trim().min(1).max(120),
  customerPhone: z.string().trim().min(3).max(40),
  customerEmail: z.string().email().max(160).nullable().optional(),
  notes: z.string().trim().max(500).nullable().optional(),
  /** Opaque per-submission key so a double-click cannot become two bookings. */
  requestId: z.string().trim().min(8).max(64).optional()
});

/** One shape for every refusal, so nothing about the tenant leaks through a 404. */
const notFound = () => NextResponse.json({ error: "Not found." }, { status: 404 });

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = Body.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: "That booking request didn't make sense." }, { status: 400 });
  }
  const input = parsed.data;

  // Bound before any work: booking is a write, and a public one.
  try {
    await enforceRateLimit({ key: `site-spec:book:${input.slug}`, limit: 20, windowInSeconds: 60 * 10 });
  } catch (error) {
    if (error instanceof RateLimitError) {
      return NextResponse.json(
        { error: "Too many booking attempts just now. Please try again shortly." },
        { status: 429, headers: { "Retry-After": String(error.retryAfterSeconds) } }
      );
    }
    throw error;
  }

  const admin = getSupabaseAdminClient() as any;

  // ── the tenant, derived from a published site and nothing else ────────────
  const { data: site } = await admin
    .from("builder_sites")
    .select("id, business_id, published_version_id")
    .eq("slug", input.slug)
    .eq("status", "published")
    .maybeSingle();
  if (!site?.published_version_id) return notFound();
  const businessId = site.business_id as string;

  if ((await resolveRolloutState(admin, businessId)) === "off") return notFound();

  // Only a business on the neutral write path books here. A legacy business's
  // website must not quietly start writing into the neutral table.
  const bookingState = await getBookingState(admin, businessId);
  if (writeTargetForState(bookingState) !== "booking") {
    logSiteSpecEvent("BOOKING_CREATE_BLOCKED", { businessId, reason: "not_neutral", state: bookingState });
    return NextResponse.json(
      { error: "Online booking isn't available for this business yet." },
      { status: 409 }
    );
  }

  // ── the service and location, both resolved from the business, never given ──
  const { data: service } = await admin
    .from("service")
    .select("id, is_active")
    .eq("id", input.serviceId)
    .eq("business_id", businessId)
    .maybeSingle();
  if (!service || service.is_active === false) return notFound();

  const { data: location } = await admin
    .from("location")
    .select("id, timezone")
    .eq("business_id", businessId)
    .eq("is_active", true)
    .order("is_primary", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (!location) return notFound();

  // A repeated submission must not become a second booking.
  if (!(await claimRequestOnce("book", businessId, input.requestId))) {
    logSiteSpecEvent("BOOKING_CREATE_DUPLICATE", { businessId, serviceId: input.serviceId });
    return NextResponse.json(
      { error: "duplicate_request", message: "That booking has already gone through." },
      { status: 409 }
    );
  }

  const now = new Date();
  const requestedAt = new Date(input.startAt);
  if (!Number.isFinite(requestedAt.getTime()) || requestedAt.getTime() <= now.getTime()) {
    return NextResponse.json({ error: "That time has already passed." }, { status: 409 });
  }

  const elapsed = Date.now();
  const manage = generateManageToken();

  try {
    let created:
      | { ok: true; id: string; status: string; startAt: string; endAt: string; durationMin: number;
          serviceName: string; priceMode: string; priceCents: number | null; currency: string;
          holdExpiresAt: string | null; assignedTeamMemberId?: string }
      | { ok: false; error: string };

    if (input.teamMemberId) {
      // ── REVALIDATE: is this exact start still genuinely on offer? ──────────
      // `create_booking` checks eligibility and the overlap race, but not
      // availability. Without this, a stale page could book a closed day.
      const ai = await buildAvailabilityInput(admin, {
        businessId,
        locationId: location.id,
        teamMemberId: input.teamMemberId,
        serviceId: input.serviceId,
        dateISO: input.date,
        now
      });
      const offered = ai
        ? resolveDayAvailability(ai, input.date).some(
            (slot) => new Date(slot.startAtIso).getTime() === requestedAt.getTime()
          )
        : false;
      if (!offered) {
        logSiteSpecEvent("BOOKING_CREATE_CONFLICT", { businessId, reason: "not_available", serviceId: input.serviceId });
        return NextResponse.json(
          { error: "slot_unavailable", message: "That time isn't available any more. Please pick another." },
          { status: 409 }
        );
      }

      created = await createBooking(admin, {
        businessId,
        locationId: location.id,
        teamMemberId: input.teamMemberId,
        serviceId: input.serviceId,
        startAtIso: input.startAt,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail ?? null,
        notes: input.notes ?? null,
        source: "widget",
        manageTokenHash: manage.hash
      });
    } else {
      // The helper re-derives availability per candidate worker itself, so the
      // revalidation above is already covered for this branch.
      created = await createBookingAnyAvailable(admin, {
        businessId,
        locationId: location.id,
        serviceId: input.serviceId,
        startAtIso: input.startAt,
        dateISO: input.date,
        now,
        customerName: input.customerName,
        customerPhone: input.customerPhone,
        customerEmail: input.customerEmail ?? null,
        notes: input.notes ?? null,
        source: "widget",
        manageTokenHash: manage.hash
      });
    }

    if (!created.ok) {
      logSiteSpecEvent("BOOKING_CREATE_CONFLICT", {
        businessId,
        reason: created.error,
        durationMs: Date.now() - elapsed
      });
      return NextResponse.json(
        {
          error: "slot_unavailable",
          message:
            created.error === "no_worker_available"
              ? "Nobody is free at that time any more. Please pick another."
              : "That time was just taken. Please pick another."
        },
        { status: 409 }
      );
    }

    // Ids, timings and status only — never the customer's name, phone or token.
    logSiteSpecEvent("BOOKING_CREATED", {
      businessId,
      bookingId: created.id,
      serviceId: input.serviceId,
      status: created.status,
      durationMin: created.durationMin,
      anyAvailable: !input.teamMemberId,
      durationMs: Date.now() - elapsed
    });

    return NextResponse.json({
      ok: true,
      booking: {
        id: created.id,
        status: created.status,
        startAt: created.startAt,
        endAt: created.endAt,
        durationMin: created.durationMin,
        serviceName: created.serviceName,
        priceMode: created.priceMode,
        priceCents: created.priceCents,
        currency: created.currency,
        timezone: location.timezone ?? null
      },
      // Returned exactly once. Only its hash is stored.
      manageUrl: `/manage-booking/${manage.token}`
    });
  } catch (error) {
    const detail = error instanceof BookingCommandError ? "command" : "unexpected";
    logSiteSpecFailure("BOOKING_CREATE_FAILED", {
      businessId,
      serviceId: input.serviceId,
      stage: detail,
      durationMs: Date.now() - elapsed
    });
    // Honest failure. Nothing is half-written: `create_booking` is one statement.
    return NextResponse.json(
      { error: "booking_failed", message: "We couldn't complete that booking just now. Please try again." },
      { status: 503 }
    );
  }
}

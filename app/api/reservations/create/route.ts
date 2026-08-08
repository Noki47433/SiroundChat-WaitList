import { NextResponse } from "next/server";
import { z } from "zod";
import { getBusinessEntitlementAccess } from "@/lib/server/billing-access";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createReservationRecord, ReservationOperationError } from "@/lib/reservations/operations";
import { checkRateLimit } from "@/lib/utils/rate-limit";

export const runtime = "nodejs";

const CreateSchema = z.object({
  restaurantId: z.string().uuid(),
  customerName: z.string().min(1).max(120),
  customerPhone: z.string().max(40).optional().nullable(),
  customerEmail: z.string().email().optional().nullable(),
  partySize: z.number().int().positive().max(1000),
  startAtISO: z.string().min(1).max(40),
  notes: z.string().max(2000).optional().nullable(),
  source: z.enum(["chatbot", "widget"]).optional(),
  // P0 SEC-2: every reservation must attach to a real, server-created conversation.
  // The conversation is the unforgeable tenant context — the request body's restaurantId
  // is NOT trusted on its own.
  conversationId: z.string().uuid()
});

const getRequestIp = (request: Request) => {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  if (first) return first;
  const realIp = request.headers.get("x-real-ip");
  return realIp?.trim() || "unknown";
};

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const {
    restaurantId,
    customerName,
    customerPhone,
    customerEmail,
    partySize,
    startAtISO,
    notes,
    source,
    conversationId
  } = parsed.data;

  const admin = getSupabaseAdminClient();

  // P0 SEC-2: derive the authoritative business from the server-created conversation and
  // reject any mismatch BEFORE any bootstrap, DB write, entitlement lookup, or SMS. Without
  // this, an anonymous caller could create confirmed bookings (and trigger owner SMS / Twilio
  // cost) against any business simply by sending its UUID.
  const { data: conversation, error: conversationError } = await (admin as any)
    .from("chat_conversations")
    .select("id, business_id")
    .eq("id", conversationId)
    .maybeSingle();

  if (conversationError) {
    return NextResponse.json({ error: "Failed to verify conversation" }, { status: 500 });
  }
  if (!conversation || !conversation.business_id) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }
  if (conversation.business_id !== restaurantId) {
    return NextResponse.json(
      { error: "Conversation does not belong to this business" },
      { status: 403 }
    );
  }

  const authoritativeBusinessId = conversation.business_id as string;

  // Supplemental abuse throttle (shared limiter — NOT the security boundary, which is the
  // conversation binding above). Keyed by business + IP.
  const ip = getRequestIp(request);
  const limit = await checkRateLimit({
    key: `reservation-create:${authoritativeBusinessId}:${ip}`,
    limit: 8,
    windowInSeconds: 60
  });
  if (!limit.allowed) {
    const retryAfter = Math.max(1, Math.ceil((limit.resetAt - Date.now()) / 1000));
    return NextResponse.json(
      { error: "Too many reservation attempts. Try again shortly." },
      { status: 429, headers: { "Retry-After": String(retryAfter) } }
    );
  }

  try {
    const billingAccess = await getBusinessEntitlementAccess(authoritativeBusinessId, "reservations");
    if (!billingAccess.allowed) {
      return NextResponse.json(
        {
          error: "UPGRADE_REQUIRED",
          requiredEntitlement: "reservations",
          recommendedPlan: billingAccess.recommendedPlanId,
          message: billingAccess.accessActive
            ? billingAccess.upgrade.description
            : "This business does not have active billing for reservations right now."
        },
        { status: 403 }
      );
    }

    const createdBy = source === "widget" ? "widget" : "chatbot";
    const result = await createReservationRecord({
      adminClient: admin as any,
      restaurantId: authoritativeBusinessId,
      customerName,
      customerPhone,
      customerEmail,
      partySize,
      startAtISO,
      notes,
      source: "website",
      createdBy,
      status: "confirmed",
      conversationId,
      sendSmsAlert: true
    });

    return NextResponse.json({ reservation: result.reservation });
  } catch (error) {
    if (error instanceof ReservationOperationError) {
      return NextResponse.json(
        {
          error: error.message,
          code: error.code,
          ...(error.details ?? {})
        },
        { status: error.status }
      );
    }

    return NextResponse.json({ error: "Failed to create reservation" }, { status: 500 });
  }
}

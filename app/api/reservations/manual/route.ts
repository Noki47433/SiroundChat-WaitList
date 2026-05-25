import { NextResponse } from "next/server";
import { z } from "zod";
import { createReservationRecord, ReservationOperationError } from "@/lib/reservations/operations";
import { ensureRestaurantBootstrap, localDateTimeStringToUtcDate } from "@/lib/reservations/service";
import { requireBusinessUser } from "@/lib/server/business-auth";
import { getSupabaseAdminClientIfAvailable } from "@/lib/supabase/admin";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const ManualReservationSchema = z.object({
  customerName: z.string().trim().min(1, "Guest name is required.").max(120, "Guest name is too long."),
  customerPhone: z.string().trim().min(1, "Phone number is required.").max(40, "Phone number is too long."),
  partySize: z.coerce.number().int().min(1, "Guests must be at least 1.").max(99, "Guests must be below 100."),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Select a valid date."),
  time: z.string().regex(/^\d{2}:\d{2}$/, "Select a valid time."),
  notes: z.string().trim().max(400, "Notes must be 400 characters or less.").optional().nullable(),
  actionType: z.string().optional(),
});

export async function POST(request: Request) {
  const { context, response } = await requireBusinessUser({ entitlement: "reservation_management" });
  if (response) return response;

  const payload = await request.json().catch(() => null);
  const parsed = ManualReservationSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = getSupabaseAdminClientIfAvailable();
  if (!admin) {
    return NextResponse.json({ error: "Reservations are unavailable right now." }, { status: 500 });
  }

  const actionType = parsed.data.actionType ?? "restaurant_reservation";
  const isRestaurantFlow = actionType === "restaurant_reservation";

  // ── Non-restaurant flow (barber, clinic, gym, etc.) ──────────────────────
  // Skip restaurant bootstrap and capacity checks. Insert directly with the
  // correct action_type so the ops dashboard query (which filters by action_type)
  // can find the row.
  if (!isRestaurantFlow) {
    // Build a UTC ISO from the local date+time. Use Europe/Belgrade as default
    // if we cannot determine the business timezone without a restaurant record.
    const startAt = localDateTimeStringToUtcDate(
      parsed.data.date,
      parsed.data.time,
      "Europe/Belgrade"
    );
    if (!startAt) {
      return NextResponse.json({ error: "Invalid reservation date or time." }, { status: 400 });
    }

    const now = new Date().toISOString();
    const insertPayload = {
      business_id: context.businessId,
      restaurant_id: null,
      action_type: actionType,
      customer_name: parsed.data.customerName.trim(),
      customer_phone: parsed.data.customerPhone.trim() || null,
      customer_email: null,
      notes: parsed.data.notes ?? null,
      special_request: parsed.data.notes ?? null,
      party_size: parsed.data.partySize,
      start_at: startAt.toISOString(),
      end_at: startAt.toISOString(),
      datetime: startAt.toISOString(),
      status: "confirmed",
      source: "manual",
      created_by: "dashboard",
      conversation_id: null,
      source_conversation_id: null,
      created_at: now,
    };

    const { data: created, error: createError } = await admin
      .from("reservations")
      .insert(insertPayload)
      .select("*")
      .single();

    if (createError || !created) {
      return NextResponse.json({ error: createError?.message ?? "Failed to create reservation." }, { status: 500 });
    }

    return NextResponse.json({ reservation: created });
  }

  // ── Restaurant flow ───────────────────────────────────────────────────────
  const restaurant = await ensureRestaurantBootstrap(admin as any, context.businessId, context.userId);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  const startAt = localDateTimeStringToUtcDate(
    parsed.data.date,
    parsed.data.time,
    restaurant.timezone ?? "Europe/Belgrade"
  );
  if (!startAt) {
    return NextResponse.json({ error: "Invalid reservation date or time." }, { status: 400 });
  }

  try {
    const created = await createReservationRecord({
      adminClient: admin as any,
      restaurantId: context.businessId,
      customerName: parsed.data.customerName,
      customerPhone: parsed.data.customerPhone,
      partySize: parsed.data.partySize,
      startAtISO: startAt.toISOString(),
      notes: parsed.data.notes ?? null,
      source: "manual",
      createdBy: "dashboard",
      status: "confirmed",
      sendSmsAlert: false,
      enforceLeadAndMaxDays: false
    });

    return NextResponse.json({ reservation: created.reservation });
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

    return NextResponse.json({ error: "Failed to create reservation." }, { status: 500 });
  }
}

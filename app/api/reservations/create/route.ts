import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { insertAnalyticsEvent } from "@/lib/analytics/events";
import { createNotificationIfNotExists } from "@/lib/notifications/engine";
import { log } from "@/lib/utils/log";
import { scheduleReservationFollowups } from "@/lib/automations/scheduler";
import { resolveCustomerIdentity } from "@/lib/chatbot/customer-identity";
import { logActivity } from "@/lib/activity/log";

const PHONE_REGEX = /^\+?[0-9][0-9\s().-]{6,}$/;

const ReservationSchema = z.object({
  key: z.string().uuid(),
  conversation_id: z.string().uuid(),
  customer_name: z.string().min(1),
  customer_phone: z.string().min(1),
  customer_email: z.string().email().optional().nullable(),
  party_size: z.number().int().positive().optional().nullable(),
  datetime: z.string().min(1),
  notes: z.string().optional().nullable()
});

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = ReservationSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const {
    key,
    conversation_id,
    customer_name,
    customer_phone,
    customer_email,
    party_size,
    datetime,
    notes
  } = parsed.data;

  const normalizedPhone = customer_phone.trim();
  const parsedDate = new Date(datetime);
  if (Number.isNaN(parsedDate.getTime())) {
    return NextResponse.json({ error: "Invalid datetime" }, { status: 400 });
  }
  if (parsedDate.getTime() <= Date.now()) {
    return NextResponse.json({ error: "Datetime must be in the future" }, { status: 400 });
  }

  const phoneDigits = normalizedPhone.replace(/\D/g, "");
  if (!PHONE_REGEX.test(normalizedPhone) || phoneDigits.length < 7) {
    return NextResponse.json({ error: "Invalid phone number" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();

  const { data: businessRows, error: bizError, count } = await (admin as any)
    .from("businesses")
    .select("id", { count: "exact" })
    .eq("widget_key", key);

  if (bizError) {
    return NextResponse.json({ error: bizError.message }, { status: 500 });
  }

  const bizCount = count ?? businessRows?.length ?? 0;
  if (bizCount > 1) {
    return NextResponse.json({ error: "Duplicate widget key" }, { status: 409 });
  }

  const businessId = businessRows?.[0]?.id as string | undefined;
  if (!businessId) {
    return NextResponse.json({ error: "Widget not found" }, { status: 404 });
  }

  const { data: conversation, error: convoError } = await (admin as any)
    .from("chat_conversations")
    .select("id")
    .eq("id", conversation_id)
    .eq("business_id", businessId)
    .maybeSingle();

  if (convoError) {
    return NextResponse.json({ error: convoError.message }, { status: 500 });
  }

  if (!conversation?.id) {
    return NextResponse.json({ error: "Conversation not found" }, { status: 404 });
  }

  const { data: reservation, error: reservationError } = await (admin as any)
    .from("reservations")
    .insert({
      business_id: businessId,
      conversation_id,
      customer_name: customer_name.trim(),
      customer_phone: normalizedPhone,
      customer_email: customer_email?.trim() ?? null,
      party_size: party_size ?? null,
      datetime: parsedDate.toISOString(),
      notes: notes?.trim() ?? null
    })
    .select("id,business_id,conversation_id,customer_name,datetime")
    .single();

  if (reservationError || !reservation) {
    try {
      await insertAnalyticsEvent(admin as any, {
        businessId,
        siteId: null,
        type: "reservation_failed",
        metadata: { conversation_id, reason: reservationError?.message ?? "insert_failed" }
      });
    } catch (error) {
      log("error", "Failed to log reservation_failed event", { error });
    }
    return NextResponse.json({ error: reservationError?.message ?? "Failed to create reservation" }, { status: 500 });
  }

  try {
    await insertAnalyticsEvent(admin as any, {
      businessId,
      siteId: null,
      type: "reservation_created",
      metadata: { reservation_id: reservation.id, conversation_id }
    });
    await (admin as any).from("analytics_events").insert({
      business_id: businessId,
      conversation_id,
      type: "reservation_completed",
      metadata: { reservation_id: reservation.id, conversation_id },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    log("error", "Failed to log reservation_created event", { error });
  }

  let customerId: string | null = null;
  try {
    const customer = await resolveCustomerIdentity(admin as any, {
      businessId,
      conversationId: conversation_id,
      name: customer_name,
      email: customer_email ?? null,
      phone: normalizedPhone,
      channel: "web_chat",
      messageText: `Reservation created by ${customer_name}`
    });
    customerId = customer?.id ?? null;
  } catch (error) {
    log("warn", "Failed to resolve customer for reservation followups", { error });
  }

  try {
    await scheduleReservationFollowups(admin as any, reservation as any, customerId);
  } catch (error) {
    log("error", "Failed to schedule reservation followups", { error, reservationId: reservation.id });
  }

  try {
    await createNotificationIfNotExists(
      businessId,
      {
        title: "🎉 New reservation created",
        body: "SiroundChat created a new reservation. Review details now.",
        severity: "celebration",
        category: "revenue",
        cta_label: "View reservations",
        cta_url: "/dashboard/reservations",
        data: { reservation_id: reservation.id, conversation_id }
      },
      "reservation",
      reservation.id
    );
  } catch (error) {
    log("error", "Failed to create reservation notification", { error });
  }

  await logActivity({
    businessId,
    actorType: "system",
    eventType: "booking_created",
    summary: `Booking created for ${reservation.customer_name}`,
    meta: { reservation_id: reservation.id, conversation_id }
  });

  return NextResponse.json({ success: true, reservation_id: reservation.id });
}

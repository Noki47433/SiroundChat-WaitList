import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessUser } from "@/lib/server/business-auth";
import { getSupabaseAdminClientIfAvailable } from "@/lib/supabase/admin";
import {
  computeUsedCapacityForInterval,
  ensureRestaurantBootstrap,
  getOrCreateReservationSettings,
  loadCapacityRelevantReservations,
  validateLeadAndMaxDays
} from "@/lib/reservations/service";

export const dynamic = "force-dynamic";

const UpdateSchema = z
  .object({
    party_size: z.number().int().positive().optional(),
    start_at: z.string().min(1).optional(),
    duration_min: z.number().int().positive().max(480).optional(),
    notes: z.string().nullable().optional(),
    status: z
      .enum(["pending", "confirmed", "seated", "completed", "canceled", "no_show"])
      .optional(),
    cancel_reason: z.string().nullable().optional()
  })
  .strict();

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { context, response } = await requireBusinessUser({ entitlement: "reservation_management" });
  if (response) return response;

  const payload = await request.json().catch(() => null);
  const parsed = UpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const reservationId = params.id;
  const { data: current, error: currentError } = await (context.supabase as any)
    .from("reservations")
    .select("*")
    .eq("id", reservationId)
    .maybeSingle();

  if (currentError) {
    return NextResponse.json({ error: currentError.message }, { status: 500 });
  }

  if (!current?.id) {
    return NextResponse.json({ error: "Reservation not found" }, { status: 404 });
  }

  // Non-restaurant appointments have restaurant_id = NULL. For those we skip the restaurant
  // bootstrap, settings lookup, and capacity checks — just do a simple status update.
  const isRestaurantFlow = Boolean(current.restaurant_id);
  const restaurantId = (current.restaurant_id as string) || null;

  // Compute next time/size values (needed for updatePayload regardless of flow type).
  const currentStart = new Date(current.start_at as string);
  const currentEnd = new Date(current.end_at as string);
  const validCurrentTimes = !Number.isNaN(currentStart.getTime()) && !Number.isNaN(currentEnd.getTime());
  const existingDuration = validCurrentTimes
    ? Math.max(15, Math.round((currentEnd.getTime() - currentStart.getTime()) / 60_000))
    : 60;
  const nextDuration = parsed.data.duration_min ?? existingDuration;
  const nextStart = parsed.data.start_at ? new Date(parsed.data.start_at) : currentStart;
  const nextEnd = new Date(nextStart.getTime() + nextDuration * 60_000);
  const nextPartySize = parsed.data.party_size ?? Number(current.party_size ?? 1);
  const changesTimeOrParty =
    parsed.data.party_size !== undefined || parsed.data.start_at !== undefined || parsed.data.duration_min !== undefined;

  if (isRestaurantFlow) {
    const admin = getSupabaseAdminClientIfAvailable();
    if (!admin) {
      console.error("[RESERVATION_UPDATE_CONFIG_MISSING]", { reservationId, userId: context.userId });
      return NextResponse.json({ error: "Reservations are unavailable right now." }, { status: 500 });
    }
    const restaurant = await ensureRestaurantBootstrap(admin as any, restaurantId as string, context.userId);
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }

    const settings = await getOrCreateReservationSettings(context.supabase as any, restaurantId as string);

    if (!validCurrentTimes) {
      return NextResponse.json({ error: "Reservation has invalid time range" }, { status: 400 });
    }

    if (parsed.data.start_at && Number.isNaN(nextStart.getTime())) {
      return NextResponse.json({ error: "Invalid start_at" }, { status: 400 });
    }

    if (changesTimeOrParty) {
      const leadMaxValidation = validateLeadAndMaxDays(nextStart, settings);
      if (!leadMaxValidation.ok) {
        return NextResponse.json({ error: leadMaxValidation.message, code: leadMaxValidation.code }, { status: 400 });
      }

      const overlaps = await loadCapacityRelevantReservations(context.supabase as any, {
        restaurantId: restaurantId as string,
        intervalStart: nextStart,
        intervalEnd: nextEnd,
        settings
      });

      const usedCapacity = computeUsedCapacityForInterval(overlaps, nextStart, nextEnd, settings, reservationId);
      if (usedCapacity + nextPartySize > restaurant.total_capacity) {
        return NextResponse.json(
          {
            error: "Not enough capacity at that time.",
            code: "capacity_conflict",
            remainingCapacity: Math.max(restaurant.total_capacity - usedCapacity, 0)
          },
          { status: 409 }
        );
      }
    }
  }

  const updatePayload: Record<string, unknown> = {};

  if (parsed.data.party_size !== undefined) {
    updatePayload.party_size = nextPartySize;
  }

  if (changesTimeOrParty) {
    updatePayload.start_at = nextStart.toISOString();
    updatePayload.end_at = nextEnd.toISOString();
    updatePayload.datetime = nextStart.toISOString();
  }

  if (parsed.data.notes !== undefined) {
    updatePayload.notes = parsed.data.notes?.trim() || null;
  }

  if (parsed.data.status) {
    updatePayload.status = parsed.data.status;

    if (parsed.data.status === "canceled") {
      updatePayload.canceled_at = new Date().toISOString();
      updatePayload.canceled_by = "staff";
      updatePayload.cancel_reason = parsed.data.cancel_reason?.trim() || null;
    }

    if (parsed.data.status === "seated") {
      updatePayload.seated_at = new Date().toISOString();
    }

    if (parsed.data.status === "completed") {
      updatePayload.completed_at = new Date().toISOString();
    }

    if (parsed.data.status === "no_show") {
      updatePayload.no_show_at = new Date().toISOString();
    }
  }

  if (!Object.keys(updatePayload).length) {
    return NextResponse.json({ reservation: current });
  }

  // Build the update query. For restaurant rows we also filter by restaurant_id to be precise.
  // For non-restaurant rows (restaurant_id IS NULL) we only filter by id — the RLS policy
  // already ensures the calling user owns this business.
  let updateQuery = (context.supabase as any)
    .from("reservations")
    .update(updatePayload)
    .eq("id", reservationId);

  if (isRestaurantFlow && restaurantId) {
    updateQuery = updateQuery.eq("restaurant_id", restaurantId);
  }

  const { data: updated, error: updateError } = await updateQuery.select("*").single();

  if (updateError || !updated) {
    return NextResponse.json({ error: updateError?.message ?? "Failed to update reservation" }, { status: 500 });
  }

  return NextResponse.json({ reservation: updated });
}

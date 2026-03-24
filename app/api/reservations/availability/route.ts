import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  computeUsedCapacityForInterval,
  ensureRestaurantBootstrap,
  generateSlotsForDate,
  getOrCreateReservationSettings,
  loadCapacityRelevantReservations,
  validateLeadAndMaxDays
} from "@/lib/reservations/service";

const QuerySchema = z.object({
  restaurantId: z.string().uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  partySize: z.coerce.number().int().positive(),
  durationMin: z.coerce.number().int().positive().max(480).optional()
});

export async function GET(request: Request) {
  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    restaurantId: url.searchParams.get("restaurantId"),
    date: url.searchParams.get("date"),
    partySize: url.searchParams.get("partySize"),
    durationMin: url.searchParams.get("durationMin") || undefined
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { restaurantId, date, partySize } = parsed.data;
  const admin = getSupabaseAdminClient();

  const restaurant = await ensureRestaurantBootstrap(admin as any, restaurantId);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  const settings = await getOrCreateReservationSettings(admin as any, restaurantId);
  const durationMin = parsed.data.durationMin ?? settings.default_duration_min;
  const slots = generateSlotsForDate({
    date,
    timeZone: restaurant.timezone ?? "Europe/Belgrade",
    intervalMin: settings.slot_interval_min,
    durationMin,
    startHour: 9,
    endHour: 23
  });

  if (!slots.length) {
    return NextResponse.json({ error: "Invalid date" }, { status: 400 });
  }

  const firstSlot = slots[0];
  const lastSlot = slots[slots.length - 1];
  const reservations = await loadCapacityRelevantReservations(admin as any, {
    restaurantId,
    intervalStart: firstSlot.startAt,
    intervalEnd: lastSlot.endAt,
    settings
  });

  const responseSlots = slots.map((slot) => {
    const usedCapacity = computeUsedCapacityForInterval(reservations, slot.startAt, slot.endAt, settings);
    const remainingCapacity = Math.max(restaurant.total_capacity - usedCapacity, 0);
    const leadAndMaxCheck = validateLeadAndMaxDays(slot.startAt, settings);
    const available = leadAndMaxCheck.ok && usedCapacity + partySize <= restaurant.total_capacity;

    return {
      startAtISO: slot.startAt.toISOString(),
      endAtISO: slot.endAt.toISOString(),
      available,
      remainingCapacity
    };
  });

  return NextResponse.json({
    date,
    intervalMin: settings.slot_interval_min,
    slots: responseSlots
  });
}

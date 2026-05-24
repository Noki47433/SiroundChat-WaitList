import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessUser } from "@/lib/server/business-auth";
import { getSupabaseAdminClientIfAvailable } from "@/lib/supabase/admin";
import {
  ensureRestaurantBootstrap,
  getOrCreateReservationSettings,
  normalizeReservationSettings,
  type ReservationSettingsRow
} from "@/lib/reservations/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const SettingsUpdateSchema = z
  .object({
    restaurantId: z.string().uuid().optional(),
    total_capacity: z.number().int().positive().max(10000).optional(),
    slot_interval_min: z.number().int().positive().max(120).optional(),
    default_duration_min: z.number().int().positive().max(480).optional(),
    lead_time_min: z.number().int().min(0).max(1440).optional(),
    max_days_ahead: z.number().int().positive().max(365).optional(),
    buffer_before_min: z.number().int().min(0).max(240).optional(),
    buffer_after_min: z.number().int().min(0).max(240).optional(),
    auto_archive_after_hours: z.number().int().positive().max(720).optional(),
    lane_count: z.number().int().positive().max(100).optional()
  })
  .strict();

const resolveRestaurantId = (request: Request, fallbackBusinessId: string, bodyRestaurantId?: string) => {
  const url = new URL(request.url);
  const queryRestaurantId = url.searchParams.get("restaurantId") || undefined;
  return bodyRestaurantId ?? queryRestaurantId ?? fallbackBusinessId;
};

const parseUpdatePayload = (payload: z.infer<typeof SettingsUpdateSchema>) => {
  const patch: Partial<ReservationSettingsRow> = {};

  if (payload.slot_interval_min !== undefined) patch.slot_interval_min = payload.slot_interval_min;
  if (payload.default_duration_min !== undefined) patch.default_duration_min = payload.default_duration_min;
  if (payload.lead_time_min !== undefined) patch.lead_time_min = payload.lead_time_min;
  if (payload.max_days_ahead !== undefined) patch.max_days_ahead = payload.max_days_ahead;
  if (payload.buffer_before_min !== undefined) patch.buffer_before_min = payload.buffer_before_min;
  if (payload.buffer_after_min !== undefined) patch.buffer_after_min = payload.buffer_after_min;
  if (payload.auto_archive_after_hours !== undefined) patch.auto_archive_after_hours = payload.auto_archive_after_hours;
  if (payload.lane_count !== undefined) patch.lane_count = payload.lane_count;

  return patch;
};

export async function GET(request: Request) {
  const { context, response } = await requireBusinessUser({ entitlement: "reservation_management" });
  if (response) return response;

  const restaurantId = resolveRestaurantId(request, context.businessId);
  if (restaurantId !== context.businessId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getSupabaseAdminClientIfAvailable();
  if (!admin) {
    console.error("[RESERVATIONS_SETTINGS_GET_CONFIG_MISSING]", { restaurantId, userId: context.userId });
    return NextResponse.json({ error: "Reservations are unavailable right now." }, { status: 500 });
  }
  const restaurant = await ensureRestaurantBootstrap(admin as any, restaurantId, context.userId);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  const settings = await getOrCreateReservationSettings(context.supabase as any, restaurantId);

  return NextResponse.json({
    restaurantId,
    totalCapacity: restaurant.total_capacity,
    timezone: restaurant.timezone,
    settings
  });
}

export async function PUT(request: Request) {
  const { context, response } = await requireBusinessUser({ entitlement: "reservation_management" });
  if (response) return response;

  const payload = await request.json().catch(() => null);
  const parsed = SettingsUpdateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const restaurantId = resolveRestaurantId(request, context.businessId, parsed.data.restaurantId);
  if (restaurantId !== context.businessId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const admin = getSupabaseAdminClientIfAvailable();
  if (!admin) {
    console.error("[RESERVATIONS_SETTINGS_PUT_CONFIG_MISSING]", { restaurantId, userId: context.userId });
    return NextResponse.json({ error: "Reservations are unavailable right now." }, { status: 500 });
  }
  const restaurant = await ensureRestaurantBootstrap(admin as any, restaurantId, context.userId);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  await getOrCreateReservationSettings(context.supabase as any, restaurantId);

  let nextTotalCapacity = restaurant.total_capacity;
  if (parsed.data.total_capacity !== undefined && parsed.data.total_capacity !== restaurant.total_capacity) {
    const { data: updatedRestaurant, error: capacityError } = await (admin as any)
      .from("restaurants")
      .update({ total_capacity: parsed.data.total_capacity })
      .eq("id", restaurantId)
      .select("total_capacity")
      .single();

    if (capacityError) {
      return NextResponse.json({ error: capacityError.message ?? "Failed to update capacity" }, { status: 500 });
    }

    nextTotalCapacity = Number(updatedRestaurant?.total_capacity ?? parsed.data.total_capacity);
  }

  const patch = parseUpdatePayload(parsed.data);
  if (!Object.keys(patch).length) {
    const current = await getOrCreateReservationSettings(context.supabase as any, restaurantId);
    return NextResponse.json({
      restaurantId,
      totalCapacity: nextTotalCapacity,
      timezone: restaurant.timezone,
      settings: current
    });
  }

  const { data: updated, error: updateError } = await (context.supabase as any)
    .from("reservation_settings")
    .update(patch)
    .eq("restaurant_id", restaurantId)
    .select("*")
    .single();

  if (updateError || !updated) {
    return NextResponse.json({ error: updateError?.message ?? "Failed to update settings" }, { status: 500 });
  }

  return NextResponse.json({
    restaurantId,
    totalCapacity: nextTotalCapacity,
    timezone: restaurant.timezone,
    settings: normalizeReservationSettings(restaurantId, updated)
  });
}

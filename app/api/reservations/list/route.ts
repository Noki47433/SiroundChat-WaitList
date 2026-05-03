import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessUser } from "@/lib/server/business-auth";
import { getSupabaseAdminClientIfAvailable } from "@/lib/supabase/admin";
import {
  assignLaneIndexes,
  ensureRestaurantBootstrap,
  getOrCreateReservationSettings
} from "@/lib/reservations/service";

export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  restaurantId: z.string().uuid().optional(),
  from: z.string().min(1),
  to: z.string().min(1),
  includeArchived: z
    .string()
    .optional()
    .transform((value) => value === "true")
});

export async function GET(request: Request) {
  const { context, response } = await requireBusinessUser();
  if (response) return response;

  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    restaurantId: url.searchParams.get("restaurantId") ?? undefined,
    from: url.searchParams.get("from"),
    to: url.searchParams.get("to"),
    includeArchived: url.searchParams.get("includeArchived") ?? undefined
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const restaurantId = parsed.data.restaurantId ?? context.businessId;
  if (restaurantId !== context.businessId) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const from = new Date(parsed.data.from);
  const to = new Date(parsed.data.to);

  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from.getTime() >= to.getTime()) {
    return NextResponse.json({ error: "Invalid from/to range" }, { status: 400 });
  }

  const admin = getSupabaseAdminClientIfAvailable();
  if (!admin) {
    console.error("[RESERVATIONS_LIST_CONFIG_MISSING]", { restaurantId, userId: context.userId });
    return NextResponse.json({ error: "Reservations are unavailable right now." }, { status: 500 });
  }
  const restaurant = await ensureRestaurantBootstrap(admin as any, restaurantId, context.userId);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  const settings = await getOrCreateReservationSettings(context.supabase as any, restaurantId);

  let query = (context.supabase as any)
    .from("reservations")
    .select("*")
    .eq("restaurant_id", restaurantId)
    .lt("start_at", to.toISOString())
    .gt("end_at", from.toISOString())
    .order("start_at", { ascending: true });

  if (!parsed.data.includeArchived) {
    const archiveCutoff = new Date(Date.now() - settings.auto_archive_after_hours * 60 * 60 * 1000).toISOString();
    query = query.gte("end_at", archiveCutoff);
  }

  const { data: rows, error: listError } = await query;
  if (listError) {
    return NextResponse.json({ error: listError.message }, { status: 500 });
  }

  const reservations = (rows ?? []) as Array<{
    id: string;
    start_at: string;
    end_at: string;
    party_size: number;
    status: string;
    customer_name: string;
    customer_phone?: string | null;
    customer_email?: string | null;
    notes?: string | null;
  }>;

  const laneMap = assignLaneIndexes(reservations, settings.lane_count);
  const withLane = reservations.map((reservation) => ({
    ...reservation,
    lane_index: laneMap.get(reservation.id) ?? settings.lane_count
  }));

  const displayPayload = withLane.map((reservation) => ({
    reservation_id: reservation.id,
    restaurant_id: restaurantId,
    lane_index: reservation.lane_index,
    layout_version: 1,
    computed_at: new Date().toISOString()
  }));

  if (displayPayload.length) {
    await (context.supabase as any).from("reservation_display").upsert(displayPayload, { onConflict: "reservation_id" });
  }

  return NextResponse.json({
    reservations: withLane,
    laneCount: settings.lane_count,
    overflowLaneIndex: settings.lane_count,
    intervalMin: settings.slot_interval_min,
    totalCapacity: restaurant.total_capacity,
    timezone: restaurant.timezone ?? "Europe/Belgrade"
  });
}

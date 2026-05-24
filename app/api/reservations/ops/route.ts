import { NextResponse } from "next/server";
import { z } from "zod";
import { requireBusinessUser } from "@/lib/server/business-auth";
import { getSupabaseAdminClientIfAvailable } from "@/lib/supabase/admin";
import { ensureRestaurantBootstrap, getOrCreateReservationSettings } from "@/lib/reservations/service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const QuerySchema = z.object({
  q: z.string().optional(),
  status: z.enum(["all", "pending", "confirmed", "completed", "canceled", "no_show", "seated"]).optional(),
  source: z.enum(["all", "website", "whatsapp", "instagram", "manual"]).optional(),
  dateFrom: z.string().optional(),
  dateTo: z.string().optional(),
  partySize: z.string().optional(),
  actionType: z.string().optional(),
});

const resolveSource = (row: { source?: string | null; created_by?: string | null }) => {
  if (row.source === "website" || row.source === "whatsapp" || row.source === "instagram" || row.source === "manual") {
    return row.source;
  }

  if (row.created_by === "dashboard" || row.created_by === "phone") {
    return "manual";
  }

  return "website";
};

export async function GET(request: Request) {
  const { context, response } = await requireBusinessUser({ entitlement: "reservation_management" });
  if (response) return response;

  const url = new URL(request.url);
  const parsed = QuerySchema.safeParse({
    q: url.searchParams.get("q") ?? undefined,
    status: url.searchParams.get("status") ?? undefined,
    source: url.searchParams.get("source") ?? undefined,
    dateFrom: url.searchParams.get("dateFrom") ?? undefined,
    dateTo: url.searchParams.get("dateTo") ?? undefined,
    partySize: url.searchParams.get("partySize") ?? undefined,
    actionType: url.searchParams.get("actionType") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const admin = getSupabaseAdminClientIfAvailable();
  if (!admin) {
    return NextResponse.json({ error: "Reservations are unavailable right now." }, { status: 500 });
  }

  const requestedActionType = parsed.data.actionType ?? "restaurant_reservation";
  const isRestaurantFlow = requestedActionType === "restaurant_reservation";

  let restaurant: Awaited<ReturnType<typeof ensureRestaurantBootstrap>> | null = null;
  let settings: Awaited<ReturnType<typeof getOrCreateReservationSettings>> | null = null;

  if (isRestaurantFlow) {
    restaurant = await ensureRestaurantBootstrap(admin as any, context.businessId, context.userId);
    if (!restaurant) {
      return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
    }
    settings = await getOrCreateReservationSettings(context.supabase as any, context.businessId);
  }

  let query = (context.supabase as any)
    .from("reservations")
    .select(
      "id,restaurant_id,business_id,conversation_id,source,source_conversation_id,start_at,end_at,datetime,party_size,customer_name,customer_phone,customer_email,notes,special_request,status,created_by,created_at,updated_at,canceled_at,completed_at,seated_at,no_show_at"
    )
    .eq("business_id", context.businessId)
    .eq("action_type", requestedActionType)
    .order("created_at", { ascending: false })
    .limit(500);

  if (parsed.data.dateFrom) {
    query = query.gte("start_at", new Date(parsed.data.dateFrom).toISOString());
  }

  if (parsed.data.dateTo) {
    const dateTo = new Date(parsed.data.dateTo);
    dateTo.setHours(23, 59, 59, 999);
    query = query.lte("start_at", dateTo.toISOString());
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const search = parsed.data.q?.trim().toLowerCase();
  const partySizeFilter = parsed.data.partySize ? Number(parsed.data.partySize) : null;

  const baseRows = (data ?? []).map((row: any) => ({
    ...row,
    source: resolveSource(row)
  }));

  const filteredByNonStatus = baseRows.filter((row: any) => {
    if (parsed.data.source && parsed.data.source !== "all" && row.source !== parsed.data.source) {
      return false;
    }

    if (partySizeFilter && Number(row.party_size) !== partySizeFilter) {
      return false;
    }

    if (search) {
      const haystack = [row.customer_name, row.customer_phone].filter(Boolean).join(" ").toLowerCase();
      if (!haystack.includes(search)) {
        return false;
      }
    }

    return true;
  });

  const summary = filteredByNonStatus.reduce(
    (acc: Record<string, number>, row: any) => {
      if (typeof acc[row.status] !== "number") acc[row.status] = 0;
      acc[row.status] += 1;
      return acc;
    },
    { pending: 0, confirmed: 0, completed: 0, canceled: 0, seated: 0, no_show: 0 }
  );

  const reservations =
    parsed.data.status && parsed.data.status !== "all"
      ? filteredByNonStatus.filter((row: any) => row.status === parsed.data.status)
      : filteredByNonStatus;

  return NextResponse.json({
    reservations,
    summary: {
      pending: summary.pending ?? 0,
      confirmed: summary.confirmed ?? 0,
      completed: summary.completed ?? 0,
      canceled: summary.canceled ?? 0
    },
    settings: {
      restaurantId: context.businessId,
      totalCapacity: restaurant?.total_capacity ?? 0,
      timezone: restaurant?.timezone ?? "Europe/Belgrade",
      slotIntervalMin: settings?.slot_interval_min ?? 15,
      defaultDurationMin: settings?.default_duration_min ?? 90,
    }
  });
}

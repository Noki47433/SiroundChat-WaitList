import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import {
  computeUsedCapacityForInterval,
  ensureRestaurantBootstrap,
  getOrCreateReservationSettings,
  loadCapacityRelevantReservations,
  validateLeadAndMaxDays
} from "@/lib/reservations/service";

const CreateSchema = z.object({
  restaurantId: z.string().uuid(),
  customerName: z.string().min(1),
  customerPhone: z.string().min(1).optional().nullable(),
  customerEmail: z.string().email().optional().nullable(),
  partySize: z.number().int().positive(),
  startAtISO: z.string().min(1),
  notes: z.string().optional().nullable(),
  source: z.enum(["chatbot", "widget"]).optional(),
  conversationId: z.string().uuid().optional().nullable()
});

const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 5;
const createRateLimit = new Map<string, number[]>();

const getRequestIp = (request: Request) => {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }

  const realIp = request.headers.get("x-real-ip");
  if (realIp?.trim()) return realIp.trim();
  return "unknown";
};

const isRateLimited = (ip: string) => {
  const now = Date.now();
  const windowStart = now - RATE_LIMIT_WINDOW_MS;
  const attempts = (createRateLimit.get(ip) ?? []).filter((stamp) => stamp >= windowStart);

  if (attempts.length >= RATE_LIMIT_MAX) {
    createRateLimit.set(ip, attempts);
    return true;
  }

  attempts.push(now);
  createRateLimit.set(ip, attempts);
  return false;
};

export async function POST(request: Request) {
  const ip = getRequestIp(request);
  if (isRateLimited(ip)) {
    return NextResponse.json({ error: "Too many reservation attempts. Try again in a minute." }, { status: 429 });
  }

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

  const startAt = new Date(startAtISO);
  if (Number.isNaN(startAt.getTime())) {
    return NextResponse.json({ error: "Invalid startAtISO" }, { status: 400 });
  }

  const admin = getSupabaseAdminClient();
  const restaurant = await ensureRestaurantBootstrap(admin as any, restaurantId);
  if (!restaurant) {
    return NextResponse.json({ error: "Restaurant not found" }, { status: 404 });
  }

  const settings = await getOrCreateReservationSettings(admin as any, restaurantId);
  const endAt = new Date(startAt.getTime() + settings.default_duration_min * 60_000);

  const leadMaxValidation = validateLeadAndMaxDays(startAt, settings);
  if (!leadMaxValidation.ok) {
    return NextResponse.json({ error: leadMaxValidation.message, code: leadMaxValidation.code }, { status: 400 });
  }

  const overlaps = await loadCapacityRelevantReservations(admin as any, {
    restaurantId,
    intervalStart: startAt,
    intervalEnd: endAt,
    settings
  });
  const usedCapacity = computeUsedCapacityForInterval(overlaps, startAt, endAt, settings);

  if (usedCapacity + partySize > restaurant.total_capacity) {
    return NextResponse.json(
      {
        error: "Not enough capacity at that time.",
        code: "capacity_conflict",
        remainingCapacity: Math.max(restaurant.total_capacity - usedCapacity, 0)
      },
      { status: 409 }
    );
  }

  const createdBy = source === "widget" ? "widget" : "chatbot";

  const insertPayload: Record<string, unknown> = {
    restaurant_id: restaurantId,
    business_id: restaurantId,
    conversation_id: conversationId ?? null,
    start_at: startAt.toISOString(),
    end_at: endAt.toISOString(),
    datetime: startAt.toISOString(),
    party_size: partySize,
    customer_name: customerName.trim(),
    customer_phone: customerPhone?.trim() || null,
    customer_email: customerEmail?.trim() || null,
    notes: notes?.trim() || null,
    status: "confirmed",
    created_by: createdBy
  };

  const { data: created, error: createError } = await (admin as any)
    .from("reservations")
    .insert(insertPayload)
    .select("*")
    .single();

  if (createError || !created) {
    return NextResponse.json({ error: createError?.message ?? "Failed to create reservation" }, { status: 500 });
  }

  return NextResponse.json({ reservation: created });
}

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createReservationRecord, ReservationOperationError } from "@/lib/reservations/operations";

export const runtime = "nodejs";

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

  const admin = getSupabaseAdminClient();
  try {
    const createdBy = source === "widget" ? "widget" : "chatbot";
    const result = await createReservationRecord({
      adminClient: admin as any,
      restaurantId,
      customerName,
      customerPhone,
      customerEmail,
      partySize,
      startAtISO,
      notes,
      source: "website",
      createdBy,
      status: "confirmed",
      conversationId: conversationId ?? null,
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

import { NextResponse } from "next/server";
import { z } from "zod";
import { getSupabaseAdminClient } from "@/lib/supabase/admin";
import { createGenericRequestRecord, RequestOperationError } from "@/lib/reservations/request-operations";
import { ACTION_TYPES } from "@/lib/config/industry-presets";

export const runtime = "nodejs";

const CreateSchema = z.object({
  businessId: z.string().uuid(),
  actionType: z.enum(ACTION_TYPES),
  customerName: z.string().min(1).max(120),
  customerPhone: z.string().max(40).optional().nullable(),
  customerEmail: z.string().email().optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
  collectedFields: z.record(z.string(), z.unknown()).optional().nullable(),
  conversationId: z.string().uuid().optional().nullable(),
  source: z.enum(["website", "whatsapp", "manual"]).optional(),
});

export async function POST(request: Request) {
  const payload = await request.json().catch(() => null);
  const parsed = CreateSchema.safeParse(payload);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { businessId, actionType, customerName, customerPhone, customerEmail, notes, collectedFields, conversationId, source } =
    parsed.data;

  const admin = getSupabaseAdminClient();

  try {
    const result = await createGenericRequestRecord({
      adminClient: admin as any,
      businessId,
      actionType,
      customerName,
      customerPhone,
      customerEmail,
      notes,
      collectedFields: collectedFields ?? null,
      conversationId: conversationId ?? null,
      source: source ?? "website",
      sendSmsAlert: true,
    });

    return NextResponse.json({ request: result.request });
  } catch (error) {
    if (error instanceof RequestOperationError) {
      return NextResponse.json({ error: error.message, code: error.code }, { status: error.status });
    }
    return NextResponse.json({ error: "Failed to create request" }, { status: 500 });
  }
}
